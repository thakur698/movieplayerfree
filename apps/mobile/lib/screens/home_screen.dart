import 'package:flutter/material.dart';
import '../models/media_item.dart';
import '../services/storage_service.dart';
import '../services/tmdb_service.dart';
import '../theme/app_theme.dart';
import '../widgets/hero_banner.dart';
import '../widgets/media_row.dart';
import 'player_screen.dart';

class HomeScreen extends StatefulWidget {
  final Function(int tabIndex)? onNavigateTab;

  const HomeScreen({super.key, this.onNavigateTab});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  String? _error;

  MediaItem? _featuredItem;
  List<MediaItem> _trendingMovies = [];
  List<MediaItem> _trendingTv = [];
  List<MediaItem> _popularMovies = [];
  List<MediaItem> _popularTv = [];
  List<MediaItem> _topRated = [];
  List<MediaItem> _animeList = [];
  List<ContinueWatchingItem> _continueWatching = [];

  @override
  void initState() {
    super.initState();
    _loadHomeData();
  }

  Future<void> _loadHomeData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final futures = await Future.wait([
        TmdbService.getTrending(mediaType: 'all', timeWindow: 'day'),
        TmdbService.getPopularMovies(),
        TmdbService.getPopularTv(),
        TmdbService.getTopRated(mediaType: 'movie'),
        TmdbService.getAnime(),
      ]);

      final trendingAll = futures[0];
      final popMovies = futures[1];
      final popTv = futures[2];
      final topRated = futures[3];
      final anime = futures[4];

      if (mounted) {
        setState(() {
          _featuredItem = trendingAll.isNotEmpty ? trendingAll.first : null;
          _trendingMovies = trendingAll.where((item) => !item.isTv).toList();
          _trendingTv = trendingAll.where((item) => item.isTv).toList();
          _popularMovies = popMovies;
          _popularTv = popTv;
          _topRated = topRated;
          _animeList = anime;
          _continueWatching = StorageService.getHistory();
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

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: AppColors.primary),
              SizedBox(height: 16),
              Text(
                'Loading CineStream...',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
              ),
            ],
          ),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.signal_wifi_connected_no_internet_4_rounded,
                    color: AppColors.gold, size: 54),
                const SizedBox(height: 16),
                const Text(
                  'Connection or Setup Issue',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: _loadHomeData,
                  icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                  label: const Text('Retry', style: TextStyle(color: Colors.white)),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        onRefresh: _loadHomeData,
        color: AppColors.primary,
        backgroundColor: AppColors.surfaceCard,
        child: CustomScrollView(
          slivers: [
            // Top App Bar
            SliverAppBar(
              floating: true,
              backgroundColor: AppColors.background.withOpacity(0.9),
              title: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.primary, AppColors.secondary],
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'CineStream',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.search_rounded, color: Colors.white),
                  onPressed: () => widget.onNavigateTab?.call(2), // Search tab
                ),
              ],
            ),

            // Content List
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Featured Banner
                  if (_featuredItem != null) HeroBanner(item: _featuredItem!),

                  // Continue Watching Row
                  if (_continueWatching.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Row(
                        children: [
                          const Icon(Icons.history_rounded, color: AppColors.secondary, size: 18),
                          const SizedBox(width: 6),
                          const Text(
                            'Continue Watching',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(
                      height: 180,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        scrollDirection: Axis.horizontal,
                        itemCount: _continueWatching.length,
                        itemBuilder: (context, index) {
                          final h = _continueWatching[index];
                          return GestureDetector(
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (ctx) => PlayerScreen(
                                    item: h.item,
                                    initialSeason: h.season,
                                    initialEpisode: h.episode,
                                  ),
                                ),
                              );
                            },
                            child: Container(
                              width: 240,
                              margin: const EdgeInsets.only(right: 14),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                color: AppColors.surfaceCard,
                                border: Border.all(color: AppColors.border.withOpacity(0.5)),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: Stack(
                                children: [
                                  Image.network(
                                    h.item.backdropUrl,
                                    fit: BoxFit.cover,
                                    width: double.infinity,
                                    height: double.infinity,
                                    errorBuilder: (_, __, ___) => Container(color: AppColors.surfaceCard),
                                  ),
                                  Container(
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                        colors: [Colors.transparent, Colors.black.withOpacity(0.85)],
                                      ),
                                    ),
                                  ),
                                  Center(
                                    child: CircleAvatar(
                                      backgroundColor: Colors.black.withOpacity(0.6),
                                      radius: 22,
                                      child: const Icon(Icons.play_arrow_rounded,
                                          color: AppColors.primary, size: 28),
                                    ),
                                  ),
                                  Positioned(
                                    bottom: 10,
                                    left: 12,
                                    right: 12,
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          h.item.displayTitle,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
                                          ),
                                        ),
                                        if (h.item.isTv)
                                          Text(
                                            'S${h.season} : E${h.episode}',
                                            style: const TextStyle(
                                              color: AppColors.secondary,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
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
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // Media Rows
                  MediaRow(
                    title: 'Trending Movies',
                    subtitle: 'Top hits this week',
                    items: _trendingMovies,
                    onSeeAll: () => widget.onNavigateTab?.call(1),
                  ),

                  MediaRow(
                    title: 'Trending Web Series',
                    subtitle: 'Binge-worthy drama and thrillers',
                    items: _trendingTv,
                    onSeeAll: () => widget.onNavigateTab?.call(1),
                  ),

                  MediaRow(
                    title: 'Blockbuster Cinema',
                    subtitle: 'Most popular worldwide',
                    items: _popularMovies,
                    onSeeAll: () => widget.onNavigateTab?.call(1),
                  ),

                  MediaRow(
                    title: 'Popular Web Series',
                    subtitle: 'Most watched shows worldwide',
                    items: _popularTv,
                    onSeeAll: () => widget.onNavigateTab?.call(1),
                  ),

                  MediaRow(
                    title: 'Critically Acclaimed',
                    subtitle: 'Highest rated of all time',
                    items: _topRated,
                  ),

                  MediaRow(
                    title: 'Anime & Animation',
                    subtitle: 'Epic Japanese anime & cartoon series',
                    items: _animeList,
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
