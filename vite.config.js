import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

const ROOT_DIR = import.meta.dirname;
const MAX_BODY_BYTES = 1024 * 1024;

function gamekitFileStoragePlugin() {
  return {
    name: 'gamekit-file-storage',
    configureServer(server) {
      server.middlewares.use('/__gamekit_storage', (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const safeName = path.basename(url.searchParams.get('file') || 'gamekit-save.json');
        const filePath = path.resolve(ROOT_DIR, safeName);

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
          let aborted = false;
          req.on('data', (chunk) => {
            body += chunk;
            if (body.length > MAX_BODY_BYTES && !aborted) {
              aborted = true;
              res.statusCode = 413;
              res.end(JSON.stringify({ error: 'Payload too large' }));
              req.destroy();
            }
          });
          req.on('end', () => {
            if (aborted) return;
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
      '@core': path.resolve(ROOT_DIR, './core'),
      '@gameplay': path.resolve(ROOT_DIR, './gameplay'),
      '@ai': path.resolve(ROOT_DIR, './ai'),
      '@world': path.resolve(ROOT_DIR, './world'),
      '@ui': path.resolve(ROOT_DIR, './ui')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['core/**', 'gameplay/**', 'ai/**', 'world/**', 'ui/**'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        perFile: false
      }
    },
    benchmark: {
      include: ['tests/**/*.bench.js']
    }
  }
});