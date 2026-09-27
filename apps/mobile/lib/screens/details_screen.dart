import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/media_item.dart';
import '../services/storage_service.dart';
import '../services/tmdb_service.dart';
import '../theme/app_theme.dart';
import '../widgets/media_card.dart';
import 'player_screen.dart';

class DetailsScreen extends StatefulWidget {
  final int mediaId;
  final String mediaType;

  const DetailsScreen({
    super.key,
    required this.mediaId,
    required this.mediaType,
  });

  @override
  State<DetailsScreen> createState() => _DetailsScreenState();
}

class _DetailsScreenState extends State<DetailsScreen> {
  bool _isLoading = true;
  String? _error;
  MediaItem? _item;
  List<CastItem> _cast = [];
  List<MediaItem> _recommendations = [];
  List<String> _genres = [];
  int? _runtime;
  int _numberOfSeasons = 1;
  bool _isInWatchlist = false;

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final data = await TmdbService.getDetails(widget.mediaId, widget.mediaType);
      final item = data['item'] as MediaItem;

      if (mounted) {
        setState(() {
          _item = item;
          _cast = data['cast'] as List<CastItem>;
          _recommendations = data['recommendations'] as List<MediaItem>;
          _genres = data['genres'] as List<String>;
          _runtime = data['runtime'] as int?;
          _numberOfSeasons = data['numberOfSeasons'] as int? ?? 1;
          _isInWatchlist = StorageService.isInWatchlist(item.id);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  void _toggleWatchlist() {
    if (_item == null) return;
    StorageService.toggleWatchlist(_item!);
    setState(() {
      _isInWatchlist = !_isInWatchlist;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _isInWatchlist ? 'Added to Watchlist' : 'Removed from Watchlist',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        duration: const Duration(seconds: 2),
        backgroundColor: AppColors.surfaceElevated,
      ),
    );
  }

  String _formatRuntime(int? minutes) {
    if (minutes == null || minutes <= 0) return '';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return h > 0 ? '${h}h ${m}m' : '${m}m';
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    if (_error != null || _item == null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(backgroundColor: Colors.transparent),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline_rounded, color: AppColors.red, size: 48),
                const SizedBox(height: 16),
                Text(
                  'Error loading media details',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  _error ?? 'Unknown error',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _loadDetails,
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                  child: const Text('Try Again', style: TextStyle(color: Colors.white)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final item = _item!;
    final runtimeStr = _formatRuntime(_runtime);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // Collapsible Backdrop App Bar
          SliverAppBar(
            expandedHeight: 320,
            pinned: true,
            backgroundColor: AppColors.background,
            leading: CircleAvatar(
              backgroundColor: Colors.black.withOpacity(0.6),
              radius: 18,
              child: IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: Colors.white, size: 20),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            actions: [
              CircleAvatar(
                backgroundColor: Colors.black.withOpacity(0.6),
                radius: 18,
                child: IconButton(
                  icon: Icon(
                    _isInWatchlist ? Icons.bookmark_added_rounded : Icons.bookmark_border_rounded,
                    color: _isInWatchlist ? AppColors.primary : Colors.white,
                    size: 20,
                  ),
                  onPressed: _toggleWatchlist,
                ),
              ),
              const SizedBox(width: 12),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  CachedNetworkImage(
                    imageUrl: item.backdropUrl,
                    fit: BoxFit.cover,
                    placeholder: (context, url) => Container(color: AppColors.surfaceCard),
                    errorWidget: (context, url, error) => CachedNetworkImage(
                      imageUrl: item.posterUrl,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withOpacity(0.4),
                          Colors.transparent,
                          AppColors.background.withOpacity(0.8),
                          AppColors.background,
                        ],
                        stops: const [0.0, 0.4, 0.8, 1.0],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Content body
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    item.displayTitle,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Metadata Badges
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.emerald.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppColors.emerald.withOpacity(0.5)),
                        ),
                        child: Text(
                          '${item.matchPercent}% Match',
                          style: const TextStyle(
                            color: AppColors.emerald,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(item.year, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                      if (runtimeStr.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        const Text('•', style: TextStyle(color: AppColors.textMuted)),
                        const SizedBox(width: 8),
                        Text(runtimeStr, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                      ],
                      if (item.isTv) ...[
                        const SizedBox(width: 8),
                        const Text('•', style: TextStyle(color: AppColors.textMuted)),
                        const SizedBox(width: 8),
                        Text(
                          '$_numberOfSeasons ${_numberOfSeasons > 1 ? 'Seasons' : 'Season'}',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                        ),
                      ],
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppColors.textMuted),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: const Text(
                          '4K HD',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (ctx) => PlayerScreen(
                                  item: item,
                                  initialSeason: 1,
                                  initialEpisode: 1,
                                ),
                              ),
                            );
                          },
                          icon: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 24),
                          label: const Text(
                            'Watch Now',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 6,
                            shadowColor: AppColors.primary.withOpacity(0.5),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      OutlinedButton(
                        onPressed: _toggleWatchlist,
                        style: OutlinedButton.styleFrom(
                          backgroundColor: AppColors.surfaceCard,
                          side: BorderSide(
                            color: _isInWatchlist ? AppColors.primary : AppColors.border,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Icon(
                          _isInWatchlist ? Icons.check_rounded : Icons.add_rounded,
                          color: _isInWatchlist ? AppColors.primary : Colors.white,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Genres Chips
                  if (_genres.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _genres.map((g) {
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceCard,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.border.withOpacity(0.6)),
                          ),
                          child: Text(
                            g,
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        );
                      }).toList(),
                    ),
                  const SizedBox(height: 18),

                  // Overview / Synopsis
                  const Text(
                    'Synopsis',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    item.overview.isNotEmpty ? item.overview : 'No description available.',
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                      height: 1.55,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Cast & Crew
                  if (_cast.isNotEmpty) ...[
                    const Text(
                      'Cast & Characters',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 110,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _cast.length,
                        itemBuilder: (context, index) {
                          final c = _cast[index];
                          return Container(
                            width: 80,
                            margin: const EdgeInsets.only(right: 12),
                            child: Column(
                              children: [
                                CircleAvatar(
                                  radius: 30,
                                  backgroundColor: AppColors.surfaceCard,
                                  backgroundImage: CachedNetworkImageProvider(c.profileUrl),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  c.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                Text(
                                  c.character,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // Recommendations
                  if (_recommendations.isNotEmpty) ...[
                    const Text(
                      'More Like This',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 210,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _recommendations.length,
                        itemBuilder: (context, index) {
                          return MediaCard(item: _recommendations[index]);
                        },
                      ),
                    ),
                    const SizedBox(height: 32),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
