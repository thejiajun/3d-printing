import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { defineConfig } from 'vite';

// In dev, serve the generated data/ folder at /data (production reads it from R2 via the Worker).
const serveData = {
  name: 'serve-data',
  configureServer(server) {
    server.middlewares.use('/data', (req, res, next) => {
      const file = join(import.meta.dirname, 'data', normalize(decodeURIComponent(req.url.split('?')[0])));
      if (!file.startsWith(join(import.meta.dirname, 'data')) || !existsSync(file) || !statSync(file).isFile()) return next();
      createReadStream(file).pipe(res);
    });
  },
};

export default defineConfig({ plugins: [serveData], build: { outDir: 'dist' } });
