import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://<user>.github.io/stitch/ — keep `base` in sync with the repo name.
export default defineConfig({
  base: '/stitch/',
  plugins: [react()],
})
