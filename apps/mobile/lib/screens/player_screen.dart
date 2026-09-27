import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
        ),
      )
      ..loadRequest(Uri.parse(_currentStreamUrl));
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
    _controller.loadRequest(Uri.parse(_currentStreamUrl));
    _saveProgress();
  }

  void _changeEpisode(int season, int episode) {
    setState(() {
      _currentSeason = season;
      _currentEpisode = episode;
      _isLoading = true;
    });
    _controller.loadRequest(Uri.parse(_currentStreamUrl));
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
