import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Raise the chunk size warning threshold — the large bundle is a known characteristic
    // of this app and not an error. Split further only when code-splitting is needed.
    chunkSizeWarningLimit: 1500,
  },
})
