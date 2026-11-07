import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: { watch: { ignored: ['**/connector/.venv/**', '**/connector/build/**', '**/connector/dist/**', '**/.wrangler/**'] } },
})
