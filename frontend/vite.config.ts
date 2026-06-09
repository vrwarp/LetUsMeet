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
