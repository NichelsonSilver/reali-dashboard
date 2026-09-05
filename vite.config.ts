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
})
