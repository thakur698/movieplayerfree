# 🎬 CineStream Monorepo • Web, Android & iOS Streaming Platform

A premium, cross-platform movie & web series streaming platform built as a **monorepo** featuring:
- 🌐 **Web App (`apps/web`)**: Vanilla JavaScript (ES Modules), HTML5, custom CSS design system, and Vite.
- 📱 **Mobile App (`apps/mobile`)**: Flutter & Dart targeting **Android** and **iOS** with native WebView player, multi-server switching, and offline bookmarks.

---

## 📁 Monorepo Structure

```
movieplayerfree/
├── apps/
│   ├── web/                    # Web Application (Vite + Vanilla JS/CSS)
│   │   ├── src/                # Modular UI components & TMDB API client
│   │   ├── index.html          # Responsive single-page application entry
│   │   ├── .env.example        # Environment variable template
│   │   └── package.json        # Web dependencies & scripts
│   └── mobile/                 # Mobile Application (Flutter for Android & iOS)
│       ├── lib/
│       │   ├── config/         # App configuration & streaming server registry
│       │   ├── models/         # MediaItem, EpisodeItem, CastItem data models
│       │   ├── services/       # TMDB API & SharedPreferences storage services
│       │   ├── theme/          # Luxury dark cinematic design system (Outfit + Inter)
│       │   ├── widgets/        # MediaCard, HeroBanner, MediaRow widgets
│       │   ├── screens/        # Home, Details, Player, Explore, Search, Library, Settings
│       │   └── main.dart       # Flutter app entry & navigation shell
│       ├── android/            # Android platform code & manifest
│       ├── ios/                # iOS platform code & Info.plist
│       └── pubspec.yaml        # Flutter dependencies
├── package.json                # Root monorepo scripts & workspaces
├── .gitignore                  # Monorepo git ignore (secrets & build artifacts)
└── README.md                   # Project documentation
```

---

## ✨ Key Features Across Platforms

### 🌐 Web App (`apps/web`)
- **TMDB Integration**: Live trending movies, popular web series, top-rated masterpieces, and genres directory.
- **Multi-Server Streaming Player**: Embedded playback with one-click failover across:
  - `VidSrc.su` (Active HD)
  - `VidSrc.pm` (Ultra Fast)
  - `VidSrc.cc` (Multi-Res)
  - `2Embed` & `AutoEmbed` (Failover mirrors)
- **Web Series / TV Show Directory**: Interactive season picker, full episode list with stills and descriptions, next/prev episode navigation.
- **Sandbox Toggle**: One-click iframe sandboxing popup blocker to eliminate intrusive redirects.
- **My Library**: Watchlist & Continue Watching progress preserved locally.
- **Surprise Me (🎲)**: Instant random title recommendations.

### 📱 Flutter Mobile App (`apps/mobile`)
- **Native Android & iOS Support**: Built with Flutter 3.44+ and Dart 3.12+.
- **In-App WebView Player**: Clean, responsive embedded player with full orientation control (auto landscape fullscreen).
- **Instant Server Switching**: Seamlessly change between streaming servers directly from the playback screen.
- **Episode Guide Drawer**: Browse seasons and episodes with instant switching during video playback.
- **Explore & Filter**: Filter titles by category (Movies / TV Series), genres, and sorting criteria.
- **Instant Search**: Real-time debounced multi-search across movies and web series.
- **Watchlist & History**: Offline storage via `SharedPreferences`.
- **In-App Settings**: Configure your TMDB API key directly in the app or pass via build flags.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Flutter SDK](https://flutter.dev/docs/get-started/install) (v3.20 or higher)
- Free [TMDB API Key](https://www.themoviedb.org/settings/api)

---

### 🌐 Running the Web App

1. Navigate to the project root and install web dependencies:
   ```bash
   cd apps/web
   npm install
   ```

2. Configure your TMDB API Key:
   ```bash
   cp .env.example .env
   ```
   Add your key to `apps/web/.env`:
   ```env
   VITE_TMDB_API_KEY=your_tmdb_api_key_here
   ```

3. Start the Vite dev server:
   ```bash
   npm run dev:web
   # Or from apps/web: npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. Build for production:
   ```bash
   npm run build:web
   ```

---

### 📱 Running the Mobile App (Android & iOS)

1. Navigate to the mobile app directory:
   ```bash
   cd apps/mobile
   flutter pub get
   ```

2. Run the application:
   - **Android**:
     ```bash
     flutter run -d android --dart-define=TMDB_API_KEY=your_key_here
     ```
   - **iOS**:
     ```bash
     flutter run -d ios --dart-define=TMDB_API_KEY=your_key_here
     ```
   *(Note: You can also launch without `--dart-define` and enter your API key directly in the in-app Settings screen).*

3. Build production binaries:
   - **Android APK**:
     ```bash
     flutter build apk --release
     ```
   - **Android App Bundle (Google Play)**:
     ```bash
     flutter build appbundle --release
     ```
   - **iOS IPA (App Store / TestFlight)**:
     ```bash
     flutter build ipa --release
     ```

---

## 🔒 Security & Secret Management

- **Zero Hardcoded Secrets**: Neither API keys nor bearer tokens are hardcoded into source code.
- **Environment Isolation**: `.env` files and credentials are strictly ignored via `.gitignore`.
- **Runtime Key Support**: Mobile users can safely provide their own TMDB API key in settings without rebuilding.

---

## 📄 License

MIT License. Developed for educational and personal exploration purposes.
