import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/users': 'http://localhost:8000',
      '/quiz': 'http://localhost:8000',
      '/match': 'http://localhost:8000',
      '/topics': 'http://localhost:8000',
      '/questions': 'http://localhost:8000',
      '/friends': 'http://localhost:8000',
      '/friend-requests': 'http://localhost:8000',
      '/dm': 'http://localhost:8000',
      '/study-requests': 'http://localhost:8000',
      '/recent-partners': 'http://localhost:8000',
      // WebSocket proxy — must use ws target
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
