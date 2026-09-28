import { defineConfig } from 'vite';
import { resolveStream } from '../../api/stream-resolver.js';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  plugins: [
    {
      name: 'cinestream-stream-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url || !req.url.startsWith('/api/stream')) {
            return next();
          }
          try {
            const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const tmdbId = urlObj.searchParams.get('tmdbId') || urlObj.searchParams.get('id');
            const type = urlObj.searchParams.get('type') || 'movie';
            const season = urlObj.searchParams.get('season') || 1;
            const episode = urlObj.searchParams.get('episode') || 1;
            const imdbId = urlObj.searchParams.get('imdbId') || urlObj.searchParams.get('imdb');

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.end();
              return;
            }

            if (!tmdbId && !imdbId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Missing tmdbId or imdbId' }));
              return;
            }

            const streamData = await resolveStream({ tmdbId, type, season, episode, imdbId });
            res.statusCode = streamData.success ? 200 : 404;
            res.end(JSON.stringify(streamData));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message, fallback: true }));
          }
        });
      }
    }
  ]
});

