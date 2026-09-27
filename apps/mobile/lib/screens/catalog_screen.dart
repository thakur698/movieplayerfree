import 'package:flutter/material.dart';
import '../models/media_item.dart';
import '../services/tmdb_service.dart';
import '../theme/app_theme.dart';
import '../widgets/media_card.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  String _mediaType = 'movie'; // 'movie' or 'tv'
  int? _selectedGenreId;
  String _sortBy = 'popularity.desc';

  final List<MediaItem> _items = [];
  int _currentPage = 1;
  int _totalPages = 1;
  bool _isLoading = false;
  bool _isLoadingMore = false;
  String? _error;

  List<Map<String, dynamic>> _genres = [];
  final ScrollController _scrollController = ScrollController();

  final List<Map<String, String>> _sortOptions = [
    {'label': 'Most Popular', 'value': 'popularity.desc'},
    {'label': 'Top Rated', 'value': 'vote_average.desc'},
    {'label': 'Release Date', 'value': 'primary_release_date.desc'},
  ];

  @override
  void initState() {
    super.initState();
    _loadGenres();
    _fetchCatalog(reset: true);

    _scrollController.addListener(() {
      if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 300) {
        if (!_isLoading && !_isLoadingMore && _currentPage < _totalPages) {
          _fetchCatalog(reset: false);
        }
      }
    });
  }

  Future<void> _loadGenres() async {
    try {
      final genres = await TmdbService.getGenres(_mediaType);
      if (mounted) {
        setState(() {
          _genres = [{'id': 0, 'name': 'All Genres'}, ...genres];
        });
      }
    } catch (_) {}
  }

  Future<void> _fetchCatalog({bool reset = false}) async {
    if (reset) {
      setState(() {
        _isLoading = true;
        _currentPage = 1;
        _error = null;
        _items.clear();
      });
    } else {
      setState(() => _isLoadingMore = true);
    }

    try {
      final pageToLoad = reset ? 1 : _currentPage + 1;
      final data = await TmdbService.discover(
        mediaType: _mediaType,
        genreId: _selectedGenreId,
        sortBy: _sortBy,
        page: pageToLoad,
      );

      final newItems = data['results'] as List<MediaItem>;
      final total = data['totalPages'] as int;

      if (mounted) {
        setState(() {
          if (reset) {
            _items.clear();
            _items.addAll(newItems);
          } else {
            _items.addAll(newItems);
          }
          _currentPage = pageToLoad;
          _totalPages = total;
          _isLoading = false;
          _isLoadingMore = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
          _isLoadingMore = false;
        });
      }
    }
  }

  void _onTypeChanged(String type) {
    if (_mediaType == type) return;
    setState(() {
      _mediaType = type;
      _selectedGenreId = null;
    });
    _loadGenres();
    _fetchCatalog(reset: true);
  }

  void _onGenreSelected(int? genreId) {
    if (_selectedGenreId == genreId) return;
    setState(() {
      _selectedGenreId = (genreId == 0) ? null : genreId;
    });
    _fetchCatalog(reset: true);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Explore Catalog', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.background.withOpacity(0.9),
      ),
      body: Column(
        children: [
          // Filter Bars
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(
              children: [
                // Media Type Switch & Sort Dropdown
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Segmented type button
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _buildTypeTab('Movies', 'movie'),
                          _buildTypeTab('TV Series', 'tv'),
                        ],
                      ),
                    ),

                    // Sort Dropdown
                    DropdownButton<String>(
                      value: _sortBy,
                      dropdownColor: AppColors.surfaceElevated,
                      underline: const SizedBox.shrink(),
                      icon: const Icon(Icons.sort_rounded, color: AppColors.primary, size: 20),
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      items: _sortOptions
                          .map((o) => DropdownMenuItem(
                                value: o['value'],
                                child: Text(o['label']!),
                              ))
                          .toList(),
                      onChanged: (val) {
                        if (val != null && val != _sortBy) {
                          setState(() => _sortBy = val);
                          _fetchCatalog(reset: true);
                        }
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Genre Chips Row
                if (_genres.isNotEmpty)
                  SizedBox(
                    height: 34,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _genres.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (context, index) {
                        final g = _genres[index];
                        final isSelected = (_selectedGenreId == null && g['id'] == 0) ||
                            (_selectedGenreId == g['id']);
                        return FilterChip(
                          label: Text(g['name']),
                          selected: isSelected,
                          onSelected: (_) => _onGenreSelected(g['id']),
                          selectedColor: AppColors.primary,
                          backgroundColor: AppColors.surfaceElevated,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : AppColors.textSecondary,
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                          showCheckmark: false,
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          side: BorderSide(
                            color: isSelected ? AppColors.primary : AppColors.border,
                          ),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),

          // Content Area
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.error_outline, color: AppColors.red, size: 40),
                            const SizedBox(height: 8),
                            Text('Failed to load catalog', style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 12),
                            ElevatedButton(
                              onPressed: () => _fetchCatalog(reset: true),
                              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      )
                    : GridView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          childAspectRatio: 0.62,
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 12,
                        ),
                        itemCount: _items.length + (_isLoadingMore ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (index == _items.length) {
                            return const Center(
                              child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2),
                            );
                          }
                          return MediaCard(item: _items[index]);
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypeTab(String label, String type) {
    final isSelected = _mediaType == type;
    return GestureDetector(
      onTap: () => _onTypeChanged(type),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : AppColors.textSecondary,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}
