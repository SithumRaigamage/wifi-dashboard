import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const BACKEND = 'http://localhost:4000';

// Vite still logs its own (short) proxy error, but add a single actionable hint
// the first time the backend is unreachable — starting the client before the
// server is expected/harmless (the client auto-reconnects), not a crash.
let hinted = false;
function onError(err) {
  if (hinted) return;
  hinted = true;
  console.warn(
    `[proxy] backend not reachable at ${BACKEND} (${err.code || err.message}). ` +
      `Start it in another terminal:  cd server && npm start`
  );
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API + WS to the backend so the client can use same-origin paths.
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        configure: (proxy) => proxy.on('error', onError),
      },
      '/ws': {
        target: BACKEND.replace('http', 'ws'),
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code === 'EPIPE' || err.code === 'ECONNRESET') return;
            onError(err);
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            if (socket) {
              socket.on('error', (err) => {
                if (err.code === 'EPIPE' || err.code === 'ECONNRESET') return;
              });
            }
          });
        },
      },
    },
  },
});
