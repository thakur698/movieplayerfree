import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';
import '../models/media_item.dart';

class ContinueWatchingItem {
  final MediaItem item;
  final int season;
  final int episode;
  final String serverId;
  final DateTime timestamp;

  ContinueWatchingItem({
    required this.item,
    required this.season,
    required this.episode,
    required this.serverId,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
        'item': item.toJson(),
        'season': season,
        'episode': episode,
        'serverId': serverId,
        'timestamp': timestamp.toIso8601String(),
      };

  factory ContinueWatchingItem.fromJson(Map<String, dynamic> json) {
    return ContinueWatchingItem(
      item: MediaItem.fromJson(json['item']),
      season: json['season'] ?? 1,
      episode: json['episode'] ?? 1,
      serverId: json['serverId'] ?? 'vidsrc-su',
      timestamp: DateTime.tryParse(json['timestamp'] ?? '') ?? DateTime.now(),
    );
  }
}

class StorageService {
  static const String _watchlistKey = 'cinestream_watchlist';
  static const String _historyKey = 'cinestream_history';
  static const String _apiKeyKey = 'cinestream_api_key';
  static const String _serverKey = 'cinestream_preferred_server';

  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
    // Load custom API key if present
    final savedKey = _prefs?.getString(_apiKeyKey);
    if (savedKey != null && savedKey.trim().isNotEmpty) {
      AppConfig.activeTmdbApiKey = savedKey.trim();
    }
  }

  // API Key
  static String? getCustomApiKey() {
    return _prefs?.getString(_apiKeyKey);
  }

  static Future<void> setCustomApiKey(String key) async {
    await _prefs?.setString(_apiKeyKey, key);
    AppConfig.activeTmdbApiKey = key;
  }

  // Preferred Server
  static String getPreferredServer() {
    return _prefs?.getString(_serverKey) ?? 'vidsrc-su';
  }

  static Future<void> setPreferredServer(String serverId) async {
    await _prefs?.setString(_serverKey, serverId);
  }

  // Watchlist
  static List<MediaItem> getWatchlist() {
    final rawList = _prefs?.getStringList(_watchlistKey) ?? [];
    return rawList
        .map((str) {
          try {
            return MediaItem.fromJson(jsonDecode(str));
          } catch (_) {
            return null;
          }
        })
        .whereType<MediaItem>()
        .toList();
  }

  static bool isInWatchlist(int id) {
    final list = getWatchlist();
    return list.any((item) => item.id == id);
  }

  static Future<void> toggleWatchlist(MediaItem item) async {
    final list = getWatchlist();
    final index = list.indexWhere((i) => i.id == item.id);
    if (index >= 0) {
      list.removeAt(index);
    } else {
      list.insert(0, item);
    }
    final rawList = list.map((item) => jsonEncode(item.toJson())).toList();
    await _prefs?.setStringList(_watchlistKey, rawList);
  }

  // Continue Watching History
  static List<ContinueWatchingItem> getHistory() {
    final rawList = _prefs?.getStringList(_historyKey) ?? [];
    return rawList
        .map((str) {
          try {
            return ContinueWatchingItem.fromJson(jsonDecode(str));
          } catch (_) {
            return null;
          }
        })
        .whereType<ContinueWatchingItem>()
        .toList();
  }

  static Future<void> saveProgress({
    required MediaItem item,
    int season = 1,
    int episode = 1,
    String serverId = 'vidsrc-su',
  }) async {
    final history = getHistory();
    history.removeWhere((h) => h.item.id == item.id);
    history.insert(
      0,
      ContinueWatchingItem(
        item: item,
        season: season,
        episode: episode,
        serverId: serverId,
        timestamp: DateTime.now(),
      ),
    );
    // Keep top 20
    final limited = history.take(20).toList();
    final rawList = limited.map((h) => jsonEncode(h.toJson())).toList();
    await _prefs?.setStringList(_historyKey, rawList);
  }

  static Future<void> removeHistory(int id) async {
    final history = getHistory();
    history.removeWhere((h) => h.item.id == id);
    final rawList = history.map((h) => jsonEncode(h.toJson())).toList();
    await _prefs?.setStringList(_historyKey, rawList);
  }
}
