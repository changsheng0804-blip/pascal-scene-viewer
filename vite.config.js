import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: '.pages-build',
    emptyOutDir: true,
    sourcemap: false,
  },
})
