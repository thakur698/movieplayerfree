class AppConfig {
  static const String tmdbApiKeyFromEnv = String.fromEnvironment(
    'TMDB_API_KEY',
    defaultValue: '',
  );

  // Runtime active API key (can be loaded from SharedPreferences)
  static String activeTmdbApiKey = tmdbApiKeyFromEnv;
  static String get tmdbApiKey => activeTmdbApiKey.isNotEmpty ? activeTmdbApiKey : tmdbApiKeyFromEnv;

  static const String tmdbBaseUrl = 'https://api.themoviedb.org/3';
  static const String imageOriginal = 'https://image.tmdb.org/t/p/original';
  static const String imageW500 = 'https://image.tmdb.org/t/p/w500';
  static const String imageW300 = 'https://image.tmdb.org/t/p/w300';
  static const String imageW185 = 'https://image.tmdb.org/t/p/w185';

  static const String placeholderPoster =
      'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&auto=format&fit=crop&q=80';
  static const String placeholderBackdrop =
      'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1280&auto=format&fit=crop&q=80';
}

class StreamServer {
  final String id;
  final String name;
  final String badge;
  final String Function(String tmdbId, [String? imdbId]) getMovieUrl;
  final String Function(String tmdbId, String? imdbId, int season, int episode) getTvUrl;

  const StreamServer({
    required this.id,
    required this.name,
    required this.badge,
    required this.getMovieUrl,
    required this.getTvUrl,
  });
}

final List<StreamServer> streamServers = [
  StreamServer(
    id: 'vidsrc-su',
    name: 'VidSrc.su',
    badge: 'Active HD',
    getMovieUrl: (tmdbId, [imdbId]) => 'https://vidsrc.su/embed/movie/$tmdbId',
    getTvUrl: (tmdbId, imdbId, season, episode) =>
        'https://vidsrc.su/embed/tv/$tmdbId/$season/$episode',
  ),
  StreamServer(
    id: 'vidsrc-pm',
    name: 'VidSrc.pm',
    badge: 'Ultra Fast',
    getMovieUrl: (tmdbId, [imdbId]) => 'https://vidsrc.pm/embed/movie?tmdb=$tmdbId',
    getTvUrl: (tmdbId, imdbId, season, episode) =>
        'https://vidsrc.pm/embed/tv?tmdb=$tmdbId&season=$season&episode=$episode',
  ),
  StreamServer(
    id: 'vidsrc-cc',
    name: 'VidSrc.cc',
    badge: 'Multi-Res',
    getMovieUrl: (tmdbId, [imdbId]) =>
        'https://vidsrc.cc/v2/embed/movie/${imdbId?.isNotEmpty == true ? imdbId : tmdbId}',
    getTvUrl: (tmdbId, imdbId, season, episode) =>
        'https://vidsrc.cc/v2/embed/tv/${imdbId?.isNotEmpty == true ? imdbId : tmdbId}/$season/$episode',
  ),
  StreamServer(
    id: '2embed',
    name: '2Embed',
    badge: 'Stable Mirror',
    getMovieUrl: (tmdbId, [imdbId]) => 'https://www.2embed.cc/embed/$tmdbId',
    getTvUrl: (tmdbId, imdbId, season, episode) =>
        'https://www.2embed.cc/embedtv/$tmdbId&s=$season&e=$episode',
  ),
  StreamServer(
    id: 'autoembed',
    name: 'AutoEmbed',
    badge: 'Auto Switch',
    getMovieUrl: (tmdbId, [imdbId]) => 'https://player.autoembed.cc/embed/movie/$tmdbId',
    getTvUrl: (tmdbId, imdbId, season, episode) =>
        'https://player.autoembed.cc/embed/tv/$tmdbId/$season/$episode',
  ),
];
