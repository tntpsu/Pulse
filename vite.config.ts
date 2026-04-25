import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  define: {
    // Surface the package.json version to the app so the About card and
    // card-selector header can show what's actually installed.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
})
