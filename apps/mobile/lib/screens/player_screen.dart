import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';
import '../config/app_config.dart';
import '../models/media_item.dart';
import '../services/storage_service.dart';
import '../services/tmdb_service.dart';
import '../theme/app_theme.dart';

class PlayerScreen extends StatefulWidget {
  final MediaItem item;
  final int initialSeason;
  final int initialEpisode;

  const PlayerScreen({
    super.key,
    required this.item,
    this.initialSeason = 1,
    this.initialEpisode = 1,
  });

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  late WebViewController _controller;
  bool _isLoading = true;
  bool _isLandscape = false;
  late StreamServer _selectedServer;
  late int _currentSeason;
  late int _currentEpisode;
  List<EpisodeItem> _episodes = [];
  bool _isLoadingEpisodes = false;

  @override
  void initState() {
    super.initState();
    _currentSeason = widget.initialSeason;
    _currentEpisode = widget.initialEpisode;

    // Pick preferred or default server
    final preferredId = StorageService.getPreferredServer();
    _selectedServer = streamServers.firstWhere(
      (s) => s.id == preferredId,
      orElse: () => streamServers.first,
    );

    _initWebViewController();

    if (widget.item.isTv) {
      _loadEpisodes();
    }

    _saveProgress();
  }

  void _saveProgress() {
    StorageService.saveProgress(
      item: widget.item,
      season: _currentSeason,
      episode: _currentEpisode,
      serverId: _selectedServer.id,
    );
  }

  String get _currentStreamUrl {
    final tmdbId = widget.item.id.toString();
    final imdbId = widget.item.imdbId;

    if (widget.item.isTv) {
      return _selectedServer.getTvUrl(tmdbId, imdbId, _currentSeason, _currentEpisode);
    } else {
      return _selectedServer.getMovieUrl(tmdbId, imdbId);
    }
  }

  void _initWebViewController() {
    late final PlatformWebViewControllerCreationParams params;
    if (WebViewPlatform.instance is WebKitWebViewPlatform) {
      params = WebKitWebViewControllerCreationParams(
        allowsInlineMediaPlayback: true,
        mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
      );
    } else {
      params = const PlatformWebViewControllerCreationParams();
    }

    _controller = WebViewController.fromPlatformCreationParams(params)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            if (mounted) setState(() => _isLoading = true);
          },
          onPageFinished: (String url) {
            if (mounted) setState(() => _isLoading = false);
          },
          onWebResourceError: (WebResourceError error) {
            // Non-critical resource errors are ignored for embeds
          },
          onNavigationRequest: (NavigationRequest request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.prevent;

            // Allow local HTML strings and data URIs for direct video playback
            if (request.url.startsWith('about:') || request.url.startsWith('data:')) {
              return NavigationDecision.navigate;
            }

            // Block non-web schemes (e.g. itms-appss, intent, etc.)
            if (uri.scheme != 'http' && uri.scheme != 'https') {
              return NavigationDecision.prevent;
            }

            // Always allow trusted streaming domains & CDNs
            const allowedSubstrings = [
              'vidsrc',
              'vidlink',
              '2embed',
              'autoembed',
              'superembed',
              'multiembed',
              'tmdb',
              'themoviedb',
              'googleapis',
              'gstatic',
              'cloudflare',
              'bunny',
              'm3u8',
              'movieplayerfree.vercel.app',
              'nextgen',
              'quietmidnight',
            ];

            final host = uri.host.toLowerCase();
            final isAllowed = allowedSubstrings.any((sub) => host.contains(sub));

            if (isAllowed) {
              return NavigationDecision.navigate;
            }

            // Block rogue ad redirects
            debugPrint('[AdBlock] Blocked popup/redirect to: ${request.url}');
            return NavigationDecision.prevent;
          },
        ),
      );

    _loadCurrentStream();
  }

  Future<void> _loadCurrentStream() async {
    if (_selectedServer.id == 'direct-hls') {
      if (mounted) setState(() => _isLoading = true);
      try {
        final uri = Uri.parse(_currentStreamUrl);
        final response = await http.get(uri).timeout(const Duration(seconds: 8));
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          if (data['success'] == true && data['streamUrl'] != null) {
            final streamUrl = data['streamUrl'];
            final subs = (data['subtitles'] as List<dynamic>?) ?? [];
            final trackTags = subs.map((sub) {
              final label = sub['label']?.toString() ?? 'Sub';
              final srclang = sub['lang']?.toString() ?? 'en';
              final src = sub['url']?.toString() ?? '';
              final isDefault = srclang.toLowerCase() == 'en' ? 'default' : '';
              return '<track label="$label" kind="subtitles" srclang="$srclang" src="$src" $isDefault>';
            }).join('\n    ');

            final htmlContent = '''
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; object-fit: contain; }
  </style>
</head>
<body>
  <video id="player" controls autoplay playsinline webkit-playsinline crossorigin="anonymous" src="$streamUrl">
    $trackTags
  </video>
</body>
</html>
''';
            await _controller.loadHtmlString(htmlContent, baseUrl: 'https://movieplayerfree.vercel.app');
            if (mounted) setState(() => _isLoading = false);
            return;
          }
        }
      } catch (e) {
        debugPrint('[DirectPlayer] Direct stream resolution failed, falling back: $e');
      }

      // Fallback to VidSrc.pm if direct resolution is unavailable
      if (mounted) {
        final fallbackServer = streamServers.firstWhere(
          (s) => s.id == 'vidsrc-pm',
          orElse: () => streamServers[1],
        );
        setState(() => _selectedServer = fallbackServer);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Direct stream not indexed for this title — using VidSrc mirror'),
            duration: Duration(seconds: 3),
          ),
        );
      }
    }

    _controller.loadRequest(Uri.parse(_currentStreamUrl));
  }

  Future<void> _loadEpisodes() async {
    setState(() => _isLoadingEpisodes = true);
    try {
      final episodes = await TmdbService.getSeasonEpisodes(widget.item.id, _currentSeason);
      if (mounted) {
        setState(() {
          _episodes = episodes;
          _isLoadingEpisodes = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingEpisodes = false);
    }
  }

  void _switchServer(StreamServer server) {
    if (_selectedServer.id == server.id) return;
    setState(() {
      _selectedServer = server;
      _isLoading = true;
    });
    StorageService.setPreferredServer(server.id);
    _loadCurrentStream();
    _saveProgress();
  }

  void _showLanguageModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.translate_rounded, color: AppColors.primary, size: 24),
                    const SizedBox(width: 10),
                    const Text(
                      'Audio Language & Subtitles',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  'AUDIO TRACKS & DUBBED SERVERS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.0,
                    color: AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 8),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Text('🇺🇸', style: TextStyle(fontSize: 24)),
                  title: const Text('English (Original HD)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  subtitle: const Text('VidLink • 0 Ads • 1080p Stream', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  trailing: _selectedServer.id == 'vidlink'
                      ? const Icon(Icons.check_circle_rounded, color: AppColors.primary)
                      : null,
                  onTap: () {
                    final srv = streamServers.firstWhere((s) => s.id == 'vidlink', orElse: () => streamServers[0]);
                    Navigator.pop(ctx);
                    _switchServer(srv);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Text('🇮🇳', style: TextStyle(fontSize: 24)),
                  title: const Text('Hindi Dubbed & Multi-Audio', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  subtitle: const Text('SuperEmbed • Multi-Language Dubs', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  trailing: _selectedServer.id == 'superembed'
                      ? const Icon(Icons.check_circle_rounded, color: AppColors.primary)
                      : null,
                  onTap: () {
                    final srv = streamServers.firstWhere((s) => s.id == 'superembed', orElse: () => streamServers[0]);
                    Navigator.pop(ctx);
                    _switchServer(srv);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Text('🌐', style: TextStyle(fontSize: 24)),
                  title: const Text('International Multi-Audio', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  subtitle: const Text('VidSrc.su • Spanish, French & German tracks', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  trailing: _selectedServer.id == 'vidsrc-su'
                      ? const Icon(Icons.check_circle_rounded, color: AppColors.primary)
                      : null,
                  onTap: () {
                    final srv = streamServers.firstWhere((s) => s.id == 'vidsrc-su', orElse: () => streamServers[0]);
                    Navigator.pop(ctx);
                    _switchServer(srv);
                  },
                ),
                const Divider(color: AppColors.border, height: 24),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.subtitles_rounded, color: AppColors.secondary, size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'To enable or change Subtitles, tap the [CC] icon at the bottom-right corner inside the video player.',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _changeEpisode(int season, int episode) {
    setState(() {
      _currentSeason = season;
      _currentEpisode = episode;
      _isLoading = true;
    });
    _loadCurrentStream();
    _saveProgress();
  }

  void _toggleOrientation() {
    if (_isLandscape) {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
      ]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      setState(() => _isLandscape = false);
    } else {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      setState(() => _isLandscape = true);
    }
  }

  @override
  void dispose() {
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isTv = widget.item.isTv;

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        top: !_isLandscape,
        bottom: !_isLandscape,
        left: _isLandscape,
        right: _isLandscape,
        child: Column(
          children: [
            // Video Player Area
            Expanded(
              flex: _isLandscape ? 1 : 0,
              child: SizedBox(
                height: _isLandscape ? null : 230,
                width: double.infinity,
                child: Stack(
                  children: [
                    WebViewWidget(controller: _controller),
                    if (_isLoading)
                      Container(
                        color: Colors.black.withOpacity(0.7),
                        child: const Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CircularProgressIndicator(color: AppColors.primary),
                              SizedBox(height: 12),
                              Text(
                                'Loading player & stream...',
                                style: TextStyle(color: Colors.white70, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      ),
                    // Floating Controls Overlay (Back + Fullscreen)
                    Positioned(
                      top: 10,
                      left: 10,
                      child: CircleAvatar(
                        backgroundColor: Colors.black.withOpacity(0.65),
                        radius: 18,
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 16),
                          onPressed: () {
                            if (_isLandscape) {
                              _toggleOrientation();
                            } else {
                              Navigator.of(context).pop();
                            }
                          },
                        ),
                      ),
                    ),
                    Positioned(
                      top: 10,
                      right: 10,
                      child: CircleAvatar(
                        backgroundColor: Colors.black.withOpacity(0.65),
                        radius: 18,
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          icon: Icon(
                            _isLandscape ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                          onPressed: _toggleOrientation,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Controls & Server Switching (Hidden in landscape for full-bleed video)
            if (!_isLandscape)
              Expanded(
                child: Container(
                  color: AppColors.background,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    children: [
                      // Title & Subtitle Info
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.item.displayTitle,
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  isTv
                                      ? 'Season $_currentSeason • Episode $_currentEpisode'
                                      : '${widget.item.year} • HD Stream',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.secondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.translate_rounded, color: AppColors.primary),
                            tooltip: 'Audio Language & Subtitles',
                            onPressed: _showLanguageModal,
                          ),
                          IconButton(
                            icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary),
                            tooltip: 'Reload Stream',
                            onPressed: () {
                              setState(() => _isLoading = true);
                              _controller.reload();
                            },
                          ),
                        ],
                      ),
                      const Divider(color: AppColors.border, height: 24),

                      // Streaming Server Pills
                      const Text(
                        'STREAMING SERVERS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.0,
                          color: AppColors.textMuted,
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 38,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: streamServers.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (context, index) {
                            final server = streamServers[index];
                            final isSelected = _selectedServer.id == server.id;
                            return ChoiceChip(
                              label: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(server.name),
                                  const SizedBox(width: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? Colors.white.withOpacity(0.2)
                                          : AppColors.primary.withOpacity(0.2),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      server.badge,
                                      style: TextStyle(
                                        fontSize: 9,
                                        color: isSelected ? Colors.white : AppColors.secondary,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              selected: isSelected,
                              onSelected: (_) => _switchServer(server),
                              selectedColor: AppColors.primary,
                              backgroundColor: AppColors.surfaceCard,
                              labelStyle: TextStyle(
                                color: isSelected ? Colors.white : AppColors.textSecondary,
                                fontSize: 12,
                                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              ),
                              side: BorderSide(
                                color: isSelected ? AppColors.primary : AppColors.border,
                              ),
                            );
                          },
                        ),
                      ),

                      // TV Series Episode Selector
                      if (isTv) ...[
                        const Divider(color: AppColors.border, height: 28),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'EPISODES',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.0,
                                color: AppColors.textMuted,
                              ),
                            ),
                            // Season Dropdown
                            DropdownButton<int>(
                              value: _currentSeason,
                              dropdownColor: AppColors.surfaceCard,
                              underline: const SizedBox.shrink(),
                              icon: const Icon(Icons.arrow_drop_down, color: AppColors.primary),
                              items: List.generate(
                                widget.item.numberOfSeasons ?? 1,
                                (i) => DropdownMenuItem(
                                  value: i + 1,
                                  child: Text(
                                    'Season ${i + 1}',
                                    style: const TextStyle(fontSize: 13, color: Colors.white),
                                  ),
                                ),
                              ),
                              onChanged: (val) {
                                if (val != null && val != _currentSeason) {
                                  setState(() => _currentSeason = val);
                                  _loadEpisodes();
                                  _changeEpisode(val, 1);
                                }
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),

                        if (_isLoadingEpisodes)
                          const Center(
                            child: Padding(
                              padding: EdgeInsets.all(24.0),
                              child: CircularProgressIndicator(color: AppColors.primary),
                            ),
                          )
                        else
                          ListView.separated(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: _episodes.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final ep = _episodes[index];
                              final isCurrent = ep.episodeNumber == _currentEpisode;
                              return ListTile(
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  side: BorderSide(
                                    color: isCurrent ? AppColors.primary : AppColors.border.withOpacity(0.5),
                                  ),
                                ),
                                tileColor: isCurrent
                                    ? AppColors.primary.withOpacity(0.15)
                                    : AppColors.surfaceCard,
                                leading: Container(
                                  width: 32,
                                  height: 32,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: isCurrent ? AppColors.primary : AppColors.surfaceElevated,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Text(
                                    '${ep.episodeNumber}',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: isCurrent ? Colors.white : AppColors.textSecondary,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                                title: Text(
                                  ep.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: isCurrent ? Colors.white : AppColors.textPrimary,
                                    fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                                    fontSize: 14,
                                  ),
                                ),
                                subtitle: ep.overview.isNotEmpty
                                    ? Text(
                                        ep.overview,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 11,
                                        ),
                                      )
                                    : null,
                                trailing: isCurrent
                                    ? const Icon(Icons.play_circle_fill_rounded, color: AppColors.primary)
                                    : const Icon(Icons.play_arrow_outlined, color: AppColors.textMuted, size: 20),
                                onTap: () => _changeEpisode(_currentSeason, ep.episodeNumber),
                              );
                            },
                          ),
                      ],
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
