# 🎬 CineStream • Movies & Web Series Free Streaming Platform

A cinematic, modern, high-definition streaming platform built using **The Movie Database (TMDB) API** and **VidSrc embed services** with multi-server failover support.

---

## ✨ Features

- **TMDB API Integration**: Real-time trending movies, popular web series, top-rated masterpieces, and comprehensive genres catalog.
- **VidSrc Multi-Server Player**: High-definition embedded streaming player supporting multiple active mirrors:
  - `VidSrc.su` (Active HD)
  - `VidSrc.pm` (Ultra Fast)
  - `VidSrc.cc` (Multi-Res)
  - `2Embed` & `AutoEmbed` (Failover mirrors)
- **Web Series / TV Show Support**:
  - Interactive Season dropdown selector.
  - Scrollable Episode Directory with still thumbnails, runtimes, titles, and plot summaries.
  - Instant "Next Episode" and "Previous Episode" fast navigation buttons.
- **Built-in Popup Blocker (Sandbox)**: One-click iframe sandboxing toggle in the player header to suppress intrusive redirects and ads.
- **Personal Library**:
  - **Continue Watching**: Remembers your exact watch progress (including season and episode).
  - **My Watchlist**: Save favorites locally using `localStorage`.
- **"Surprise Me" Roulette (🎲)**: Random title selector for instant movie recommendations.
- **Live Autocomplete Search**: Debounced search bar with `Ctrl + K` shortcut and rich poster previews.
- **Apple TV+ & Netflix-Inspired UI**: Dark glassmorphic design system with ambient glows, 3D hover cards, and responsive layouts across desktop, tablet, and mobile.

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/thakur698/movieplayerfree.git
cd movieplayerfree
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure API Credentials
Copy the example environment file and add your [TMDB API Key](https://www.themoviedb.org/settings/api):
```bash
cp .env.example .env
```
In `.env`:
```env
VITE_TMDB_API_KEY=your_tmdb_api_key_here
```

### 4. Start development server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for production
```bash
npm run build
```

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript (ES Modules), Vanilla CSS Design System
- **Fonts**: Google Fonts (`Outfit`, `Plus Jakarta Sans`)
- **Metadata**: [The Movie Database (TMDB) API](https://developer.themoviedb.org/)
- **Streaming Providers**: VidSrc Multi-Mirror Embed Network
- **Build Tool**: Vite

---

## 📄 License

MIT License. Designed for educational and non-commercial exploration.
