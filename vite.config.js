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
    }),
    {
      name: 'main-resolver',
      resolveId(id) {
        if (id === './main.js' || id === '/main.js' || id === 'main.js' || id.endsWith('/main.js')) {
          return resolve(import.meta.dirname, 'src/main.js');
        }
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        glitch: resolve(import.meta.dirname, 'glitch.html'),
        cruiser: resolve(import.meta.dirname, 'GlitchCruiser.html'),
        chooser: resolve(import.meta.dirname, 'GlitchChooser.html'),
        docs: resolve(import.meta.dirname, 'gleech.js.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'main' || chunkInfo.name === 'src/main') {
            return 'main.js';
          }
          return 'assets/[name]-[hash].js';
        },
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  worker: {
    format: 'es'
  }
});
