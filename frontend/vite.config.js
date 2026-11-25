import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    open: false,
    proxy: { '/api/super-admin': 'http://localhost:3001', '/api/convites': 'http://localhost:3001' },
  },
});
