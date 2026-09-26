import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'reali-routing',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (!req.url) return next()
          const path = req.url.split('?')[0]
          if (path === '/' || path === '') {
            req.url = '/web/index.html'
          } else if (path === '/sig' || path === '/sig/') {
            req.url = '/web/sig.html'
          } else if (path === '/comparador' || path === '/comparador/') {
            req.url = '/web/comparador.html'
          } else if (path === '/panel' || path === '/panel/') {
            req.url = '/web/panel.html'
          } else if (path === '/comparador-demo' || path === '/comparador-demo/') {
            req.url = '/comparador-demo/index.html'
          } else if (path === '/dashboard' || path === '/dashboard/') {
            req.url = '/index.html'
          }
          next()
        })
      },
    },
  ],
  assetsInclude: ['**/*.csv'],
  build: {
    rollupOptions: {
      output: {
        // Librerías en chunks propios, agrupadas por familia. El chunk de la app
        // cambia cada corte mensual (los CSV van dentro); estos solo cambian al
        // actualizar dependencias, así que el navegador los reusa entre deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap|decimal\.js-light|eventemitter3|lodash|react-smooth|recharts-scale|tiny-invariant)[\\/]/.test(id)) return 'vendor-charts'
          if (/[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet|leaflet\.markercluster)[\\/]/.test(id)) return 'vendor-mapa'
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react'
        },
      },
    },
  },
})
