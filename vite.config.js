import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/banet-map/',
  build: {
    outDir: 'docs',
    emptyOutDir: true
  }
})
