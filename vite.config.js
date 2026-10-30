import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

function gamekitFileStoragePlugin() {
  return {
    name: 'gamekit-file-storage',
    configureServer(server) {
      server.middlewares.use('/__gamekit_storage', (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const safeName = path.basename(url.searchParams.get('file') || 'gamekit-save.json');
        const filePath = path.resolve(__dirname, safeName);

        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'GET') {
          if (!fs.existsSync(filePath)) {
            res.end(JSON.stringify({}));
            return;
          }
          res.end(fs.readFileSync(filePath, 'utf8') || '{}');
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
              res.end(JSON.stringify({ ok: true, file: safeName }));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      });
    }
  };
}

export default defineConfig({
  plugins: [gamekitFileStoragePlugin()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './core'),
      '@gameplay': path.resolve(__dirname, './gameplay'),
      '@ai': path.resolve(__dirname, './ai'),
      '@world': path.resolve(__dirname, './world'),
      '@ui': path.resolve(__dirname, './ui')
    }
  }
});