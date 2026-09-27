import '../config/app_config.dart';

class MediaItem {
  final int id;
  final String? title;
  final String? name;
  final String? posterPath;
  final String? backdropPath;
  final double voteAverage;
  final String? releaseDate;
  final String? firstAirDate;
  final String overview;
  final String mediaType;
  final int? numberOfSeasons;
  final String? imdbId;

  MediaItem({
    required this.id,
    this.title,
    this.name,
    this.posterPath,
    this.backdropPath,
    required this.voteAverage,
    this.releaseDate,
    this.firstAirDate,
    required this.overview,
    required this.mediaType,
    this.numberOfSeasons,
    this.imdbId,
  });

  String get displayTitle => (title?.isNotEmpty == true) ? title! : (name ?? 'Untitled');

  String get year {
    final date = (releaseDate?.isNotEmpty == true) ? releaseDate! : (firstAirDate ?? '');
    return date.length >= 4 ? date.substring(0, 4) : '';
  }

  String get formattedRating => voteAverage > 0 ? voteAverage.toStringAsFixed(1) : 'NR';

  int get matchPercent => (voteAverage * 10).clamp(65, 99).toInt();

  String get posterUrl => posterPath != null && posterPath!.isNotEmpty
      ? '${AppConfig.imageW500}$posterPath'
      : AppConfig.placeholderPoster;

  String get backdropUrl => backdropPath != null && backdropPath!.isNotEmpty
      ? '${AppConfig.imageOriginal}$backdropPath'
      : AppConfig.placeholderBackdrop;

  bool get isTv => mediaType == 'tv' || (firstAirDate != null && firstAirDate!.isNotEmpty);

  factory MediaItem.fromJson(Map<String, dynamic> json, [String defaultType = 'movie']) {
    final mediaType = json['media_type'] ?? (json['first_air_date'] != null ? 'tv' : defaultType);
    final vote = json['vote_average'];
    final double parsedVote = vote is int ? vote.toDouble() : (vote is double ? vote : 0.0);

    return MediaItem(
      id: json['id'] ?? 0,
      title: json['title'],
      name: json['name'],
      posterPath: json['poster_path'],
      backdropPath: json['backdrop_path'],
      voteAverage: parsedVote,
      releaseDate: json['release_date'],
      firstAirDate: json['first_air_date'],
      overview: json['overview'] ?? '',
      mediaType: mediaType,
      numberOfSeasons: json['number_of_seasons'],
      imdbId: json['imdb_id'] ?? json['external_ids']?['imdb_id'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'name': name,
        'poster_path': posterPath,
        'backdrop_path': backdropPath,
        'vote_average': voteAverage,
        'release_date': releaseDate,
        'first_air_date': firstAirDate,
        'overview': overview,
        'media_type': mediaType,
        'number_of_seasons': numberOfSeasons,
        'imdb_id': imdbId,
      };
}

class EpisodeItem {
  final int episodeNumber;
  final int seasonNumber;
  final String name;
  final String overview;
  final String? stillPath;
  final int? runtime;

  EpisodeItem({
    required this.episodeNumber,
    required this.seasonNumber,
    required this.name,
    required this.overview,
    this.stillPath,
    this.runtime,
  });

  String get stillUrl => stillPath != null && stillPath!.isNotEmpty
      ? '${AppConfig.imageW300}$stillPath'
      : AppConfig.placeholderBackdrop;

  factory EpisodeItem.fromJson(Map<String, dynamic> json, int season) {
    return EpisodeItem(
      episodeNumber: json['episode_number'] ?? 1,
      seasonNumber: season,
      name: json['name'] ?? 'Episode ${json['episode_number']}',
      overview: json['overview'] ?? '',
      stillPath: json['still_path'],
      runtime: json['runtime'],
    );
  }
}

class CastItem {
  final String name;
  final String character;
  final String? profilePath;

  CastItem({
    required this.name,
    required this.character,
    this.profilePath,
  });

  String get profileUrl => profilePath != null && profilePath!.isNotEmpty
      ? '${AppConfig.imageW185}$profilePath'
      : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';

  factory CastItem.fromJson(Map<String, dynamic> json) {
    return CastItem(
      name: json['name'] ?? '',
      character: json['character'] ?? '',
      profilePath: json['profile_path'],
    );
  }
}
