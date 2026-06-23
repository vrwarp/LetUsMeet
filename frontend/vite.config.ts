import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Compile-time flag gating E2E-only test hooks (the mock PRF provider). Set only
  // for E2E builds (see Dockerfile.e2e); folds to `false` in production builds so
  // the mock provider is dead-code-eliminated and never shipped.
  define: {
    __E2E_HOOKS__: JSON.stringify(process.env.VITE_E2E_HOOKS === 'true'),
  },
  // Vendor chunk splitting (Rolldown). Splits large, rarely-changing
  // dependencies into their own chunks so they cache independently of app code
  // and across deploys. firebase/charproof stay statically imported by app code
  // (only route pages are lazy), so initializeApp/initializeZK ordering in
  // firebase.ts is unchanged — this only affects how modules are grouped into
  // output chunks, not load order.
  build: {
    rolldownOptions: {
      output: {
        // `codeSplitting` is the current (non-deprecated) Rolldown option for
        // manual chunking; `advancedChunks` is its deprecated alias. Same shape.
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: 'charproof', test: /node_modules[\\/]charproof[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'dnd', test: /node_modules[\\/]@dnd-kit[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5273,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    server: {
      deps: {
        inline: [/src\/lib/, 'charproof'],
      },
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/test/**', 'src/main.tsx', 'src/firebase.ts'],
    }
  },
})
