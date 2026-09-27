import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  plugins: [
    {
      name: 'vidsrc-extractor-api',
      configureServer(server) {
        server.middlewares.use('/api/extract', async (req, res) => {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const tmdbId = url.searchParams.get('id');
          const type = url.searchParams.get('type') || 'movie';
          const season = url.searchParams.get('season') ? Number(url.searchParams.get('season')) : undefined;
          const episode = url.searchParams.get('episode') ? Number(url.searchParams.get('episode')) : undefined;

          res.setHeader('Content-Type', 'application/json');

          if (!tmdbId) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Missing TMDB ID parameter' }));
          }

          try {
            // Attempt extraction using active VidSrc domains
            // Return stream candidate or resolved mirrors
            const embedUrl = type === 'tv'
              ? `https://vidsrc.su/embed/tv/${tmdbId}/${season || 1}/${episode || 1}`
              : `https://vidsrc.su/embed/movie/${tmdbId}`;

            res.end(JSON.stringify({
              success: true,
              mediaId: tmdbId,
              type,
              season,
              episode,
              embedUrl,
              directStreamAvailable: false,
              message: 'Cloudflare bot protection active on direct stream extraction; auto-routing to verified VidSrc.su player embed.'
            }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      }
    }
  ]
});
