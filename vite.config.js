import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.dirname(fileURLToPath(import.meta.url))
const demoRoot = path.join(projectDir, '.local-demo')

function expandLocalDemoCatalog(products, targetCount = 50) {
  if (!Array.isArray(products) || products.length === 0 || products.length >= targetCount) return products

  const expanded = [...products]
  for (let index = products.length; index < targetCount; index += 1) {
    const template = products[index % products.length]
    const sequence = String(index - products.length + 1).padStart(3, '0')
    const available = index % 5 !== 0
    expanded.push({
      ...template,
      id: `local-demo-${sequence}`,
      number: `DEMO-${sequence}`,
      oem: `DEMO-OEM-${sequence}`,
      cross: [`DEMO-CROSS-${sequence}`],
      images: Array.isArray(template.images) ? [...template.images] : [],
      sku: `DEMO-${sequence}`,
      availability: available ? 'В наявності' : 'Під замовлення',
      qty: available ? (index % 7) + 1 : 0,
      sort_order: -index,
      pinned: false,
    })
  }
  return expanded
}

function localDemoCatalog() {
  return {
    name: 'local-demo-catalog',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__demo', (request, response, next) => {
        const relativePath = decodeURIComponent((request.url || '/').split('?')[0]).replace(/^\/+/, '')
        const target = path.resolve(demoRoot, relativePath)
        if (!target.startsWith(`${demoRoot}${path.sep}`)) return next()

        fs.stat(target, (error, stat) => {
          if (error || !stat.isFile()) return next()
          const extension = path.extname(target).toLowerCase()
          if (relativePath === 'products.json') {
            fs.readFile(target, 'utf8', (readError, raw) => {
              if (readError) return next()
              try {
                const products = expandLocalDemoCatalog(JSON.parse(raw))
                response.setHeader('Content-Type', 'application/json; charset=utf-8')
                response.end(JSON.stringify(products))
              } catch {
                next()
              }
            })
            return
          }

          response.setHeader('Content-Type', extension === '.json' ? 'application/json; charset=utf-8' : extension === '.webp' ? 'image/webp' : extension === '.png' ? 'image/png' : 'image/jpeg')
          fs.createReadStream(target).pipe(response)
        })
      })
    },
  }
}

export default defineConfig({
  build: { sourcemap: false, minify: 'esbuild' },
  plugins: [react(), localDemoCatalog()],
  server: {
    host: true,
    proxy: {
      // проксируем и /api, и /products → на сервер 10000 (IPv4!)
      '^/(api|products)(/|$)': {
        target: 'http://127.0.0.1:10000',
        changeOrigin: true,
        secure: false,
        // увеличить таймауты, чтобы большой JSON не ронял прокси
        proxyTimeout: 30000,
        timeout: 30000,
      }
    }
  }
})
