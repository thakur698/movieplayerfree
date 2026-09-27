import 'package:flutter/material.dart';
import '../models/media_item.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/media_card.dart';
import 'player_screen.dart';

class WatchlistScreen extends StatefulWidget {
  const WatchlistScreen({super.key});

  @override
  State<WatchlistScreen> createState() => _WatchlistScreenState();
}

class _WatchlistScreenState extends State<WatchlistScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<MediaItem> _watchlist = [];
  List<ContinueWatchingItem> _history = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  void _loadData() {
    setState(() {
      _watchlist = StorageService.getWatchlist();
      _history = StorageService.getHistory();
    });
  }

  Future<void> _removeItem(MediaItem item) async {
    await StorageService.toggleWatchlist(item);
    _loadData();
  }

  Future<void> _removeHistory(int id) async {
    await StorageService.removeHistory(id);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('My Library', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.background,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: AppColors.textMuted,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          tabs: [
            Tab(text: 'Watchlist (${_watchlist.length})'),
            Tab(text: 'History (${_history.length})'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildWatchlistTab(),
          _buildHistoryTab(),
        ],
      ),
    );
  }

  Widget _buildWatchlistTab() {
    if (_watchlist.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.bookmark_border_rounded, color: AppColors.textMuted, size: 64),
            const SizedBox(height: 16),
            const Text(
              'Your Watchlist is Empty',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Save movies & TV series to watch later',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.62,
        crossAxisSpacing: 10,
        mainAxisSpacing: 12,
      ),
      itemCount: _watchlist.length,
      itemBuilder: (context, index) {
        final item = _watchlist[index];
        return Stack(
          children: [
            MediaCard(item: item),
            Positioned(
              top: 4,
              right: 14,
              child: GestureDetector(
                onTap: () => _removeItem(item),
                child: CircleAvatar(
                  backgroundColor: Colors.black.withOpacity(0.7),
                  radius: 12,
                  child: const Icon(Icons.close_rounded, color: Colors.white, size: 14),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildHistoryTab() {
    if (_history.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.history_rounded, color: AppColors.textMuted, size: 64),
            const SizedBox(height: 16),
            const Text(
              'No Watch History Yet',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Items you start watching will appear here',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _history.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final h = _history[index];
        return Material(
          color: AppColors.surfaceCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AppColors.border),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            leading: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                h.item.posterUrl,
                width: 48,
                height: 72,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 48,
                  height: 72,
                  color: AppColors.surfaceElevated,
                  child: const Icon(Icons.movie, color: AppColors.textMuted),
                ),
              ),
            ),
            title: Text(
              h.item.displayTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 4),
                Text(
                  h.item.isTv ? 'Season ${h.season} • Episode ${h.episode}' : 'Movie',
                  style: const TextStyle(color: AppColors.secondary, fontSize: 12, fontWeight: FontWeight.w600),
                ),
                Text(
                  'Server: ${h.serverId}',
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                ),
              ],
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.play_circle_fill_rounded, color: AppColors.primary, size: 32),
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (ctx) => PlayerScreen(
                          item: h.item,
                          initialSeason: h.season,
                          initialEpisode: h.episode,
                        ),
                      ),
                    ).then((_) => _loadData());
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, color: AppColors.textMuted, size: 20),
                  onPressed: () => _removeHistory(h.item.id),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
