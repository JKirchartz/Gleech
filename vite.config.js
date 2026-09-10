import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  plugins: [
    svelte({
      compilerOptions: {
        customElement: true,
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        glitch: resolve(import.meta.dirname, 'glitch.html'),
        cruiser: resolve(import.meta.dirname, 'GlitchCruiser.html'),
        chooser: resolve(import.meta.dirname, 'GlitchChooser.html'),
        docs: resolve(import.meta.dirname, 'gleech.js.html')
      }
    }
  },
  worker: {
    format: 'es'
  }
});
