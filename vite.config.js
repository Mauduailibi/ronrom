import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/** Em dev, /entrar, /app e /convite abrem os HTMLs certos (na Vercel isso é o cleanUrls). */
const cleanUrls = () => ({
  name: 'ronrom-clean-urls',
  configureServer(server){
    server.middlewares.use((req, _res, next) => {
      const path = (req.url || '').split('?')[0];
      if (['/entrar', '/app', '/convite'].includes(path)) req.url = req.url.replace(path, `${path}.html`);
      next();
    });
  },
});

export default defineConfig({
  appType: 'mpa',
  plugins: [cleanUrls()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        entrar: resolve(import.meta.dirname, 'entrar.html'),
        app: resolve(import.meta.dirname, 'app.html'),
        convite: resolve(import.meta.dirname, 'convite.html'),
      },
    },
  },
});
