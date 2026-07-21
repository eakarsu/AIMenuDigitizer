import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxyTarget = process.env.VITE_API_PROXY_TARGET

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'tsx',
    include: [/src\/.*\.[jt]sx?$/],
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  server: {
    strictPort: true,
    ...(proxyTarget ? { proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true
      }
    } } : {})
  }
})
