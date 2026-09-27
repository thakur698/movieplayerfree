import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import '../models/media_item.dart';

class TmdbService {
  static final http.Client _client = http.Client();

  static Map<String, String> get _headers => {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CineStream/1.0',
      };

  static Uri _buildUri(String baseUrl, String path, [Map<String, String>? queryParams]) {
    final params = <String, String>{
      'api_key': AppConfig.tmdbApiKey,
      ...?queryParams,
    };
    return Uri.parse('$baseUrl$path').replace(queryParameters: params);
  }

  static Future<Map<String, dynamic>> _get(String path, [Map<String, String>? queryParams]) async {
    if (AppConfig.tmdbApiKey.isEmpty) {
      throw Exception('TMDB API Key is not set. Please provide one in Settings or build with --dart-define=TMDB_API_KEY=...');
    }

    final baseUrls = [
      AppConfig.tmdbBaseUrl,
      AppConfig.tmdbFallbackUrl,
    ];

    Object? lastError;
    for (final baseUrl in baseUrls) {
      try {
        final url = _buildUri(baseUrl, path, queryParams);
        final response = await _client.get(url, headers: _headers).timeout(const Duration(seconds: 12));

        if (response.statusCode == 200) {
          return jsonDecode(response.body) as Map<String, dynamic>;
        } else {
          lastError = Exception('Failed to load data (HTTP ${response.statusCode}): ${response.body}');
        }
      } catch (err) {
        lastError = err;
        // Continue to fallback domain if first domain had SocketException/Connection reset
      }
    }

    throw lastError ?? Exception('Failed to connect to TMDB API across all endpoints.');
  }

  // Trending
  static Future<List<MediaItem>> getTrending({String mediaType = 'all', String timeWindow = 'day'}) async {
    final data = await _get('/trending/$mediaType/$timeWindow');
    final results = data['results'] as List<dynamic>? ?? [];
    return results.map((json) => MediaItem.fromJson(json)).toList();
  }

  // Popular Movies
  static Future<List<MediaItem>> getPopularMovies({int page = 1}) async {
    final data = await _get('/movie/popular', {'page': page.toString()});
    final results = data['results'] as List<dynamic>? ?? [];
    return results.map((json) => MediaItem.fromJson(json, 'movie')).toList();
  }

  // Popular TV
  static Future<List<MediaItem>> getPopularTv({int page = 1}) async {
    final data = await _get('/tv/popular', {'page': page.toString()});
    final results = data['results'] as List<dynamic>? ?? [];
    return results.map((json) => MediaItem.fromJson(json, 'tv')).toList();
  }

  // Top Rated
  static Future<List<MediaItem>> getTopRated({String mediaType = 'movie', int page = 1}) async {
    final data = await _get('/$mediaType/top_rated', {'page': page.toString()});
    final results = data['results'] as List<dynamic>? ?? [];
    return results.map((json) => MediaItem.fromJson(json, mediaType)).toList();
  }

  // Anime / Animation
  static Future<List<MediaItem>> getAnime({int page = 1}) async {
    final data = await _get('/discover/tv', {
      'with_genres': '16',
      'with_original_language': 'ja',
      'sort_by': 'popularity.desc',
      'page': page.toString(),
    });
    final results = data['results'] as List<dynamic>? ?? [];
    return results.map((json) => MediaItem.fromJson(json, 'tv')).toList();
  }

  // Discover / Catalog
  static Future<Map<String, dynamic>> discover({
    String mediaType = 'movie',
    int? genreId,
    String sortBy = 'popularity.desc',
    int page = 1,
  }) async {
    final params = <String, String>{
      'sort_by': sortBy,
      'page': page.toString(),
      'include_adult': 'false',
    };
    if (genreId != null && genreId > 0) {
      params['with_genres'] = genreId.toString();
    }

    final data = await _get('/discover/$mediaType', params);
    final results = (data['results'] as List<dynamic>? ?? [])
        .map((json) => MediaItem.fromJson(json, mediaType))
        .toList();

    return {
      'results': results,
      'page': data['page'] ?? 1,
      'totalPages': data['total_pages'] ?? 1,
      'totalResults': data['total_results'] ?? 0,
    };
  }

  // Details with append_to_response
  static Future<Map<String, dynamic>> getDetails(int id, String mediaType) async {
    final data = await _get('/$mediaType/$id', {
      'append_to_response': 'credits,videos,recommendations,external_ids',
    });

    final item = MediaItem.fromJson(data, mediaType);
    
    // Parse cast
    final credits = data['credits'] as Map<String, dynamic>?;
    final castList = (credits?['cast'] as List<dynamic>? ?? [])
        .take(15)
        .map((c) => CastItem.fromJson(c))
        .toList();

    // Parse recommendations
    final recommendations = (data['recommendations']?['results'] as List<dynamic>? ?? [])
        .take(10)
        .map((r) => MediaItem.fromJson(r, mediaType))
        .toList();

    // Extract trailer
    final videos = data['videos']?['results'] as List<dynamic>? ?? [];
    final trailer = videos.firstWhere(
      (v) => v['site'] == 'YouTube' && (v['type'] == 'Trailer' || v['type'] == 'Teaser'),
      orElse: () => null,
    );

    // IMDB ID
    final imdbId = data['imdb_id'] ?? data['external_ids']?['imdb_id'] ?? '';

    return {
      'item': item,
      'cast': castList,
      'recommendations': recommendations,
      'trailerKey': trailer?['key'],
      'imdbId': imdbId,
      'runtime': data['runtime'] ?? (data['episode_run_time'] is List && (data['episode_run_time'] as List).isNotEmpty ? data['episode_run_time'][0] : null),
      'genres': (data['genres'] as List<dynamic>? ?? []).map((g) => g['name'] as String).toList(),
      'numberOfSeasons': data['number_of_seasons'] ?? 1,
    };
  }

  // TV Season Episodes
  static Future<List<EpisodeItem>> getSeasonEpisodes(int seriesId, int seasonNumber) async {
    final data = await _get('/tv/$seriesId/season/$seasonNumber');
    final episodes = data['episodes'] as List<dynamic>? ?? [];
    return episodes.map((e) => EpisodeItem.fromJson(e, seasonNumber)).toList();
  }

  // Search Multi
  static Future<List<MediaItem>> search(String query, {int page = 1}) async {
    if (query.trim().isEmpty) return [];
    final data = await _get('/search/multi', {
      'query': query,
      'page': page.toString(),
      'include_adult': 'false',
    });
    final results = data['results'] as List<dynamic>? ?? [];
    return results
        .where((json) => json['media_type'] == 'movie' || json['media_type'] == 'tv')
        .map((json) => MediaItem.fromJson(json))
        .toList();
  }

  // Genres
  static Future<List<Map<String, dynamic>>> getGenres(String mediaType) async {
    final data = await _get('/genre/$mediaType/list');
    final list = data['genres'] as List<dynamic>? ?? [];
    return list.map((g) => {'id': g['id'] as int, 'name': g['name'] as String}).toList();
  }
}
