import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const MANGA_UPDATES_BASE = 'https://api.mangaupdates.com/v1'

function mangaUpdatesProxyPlugin(): Plugin {
  const handler = (req: any, res: any, next: any) => {
    if (!req.url?.startsWith('/api/mangaupdates')) {
      next()
      return
    }

    const targetUrl = new URL(req.url, MANGA_UPDATES_BASE)
    const upstreamPath = targetUrl.pathname.replace(/^\/api\/mangaupdates/, '')
    const upstream = new URL(`${MANGA_UPDATES_BASE}${upstreamPath}${targetUrl.search}`)

    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', async () => {
      try {
        const body = Buffer.concat(chunks)
        const headers = new Headers()

        for (const [key, value] of Object.entries(req.headers)) {
          if (value === undefined) continue
          if (Array.isArray(value)) {
            value.forEach((item) => headers.append(key, item))
          } else {
            headers.set(key, value)
          }
        }

        headers.delete('host')
        headers.delete('connection')
        headers.delete('content-length')
        headers.set('accept', headers.get('accept') || 'application/json')
        headers.set('content-type', headers.get('content-type') || 'application/json')
        headers.set('user-agent', headers.get('user-agent') || 'Mozilla/5.0')
        headers.set('origin', 'https://www.mangaupdates.com')
        headers.set('referer', 'https://www.mangaupdates.com/')

        const upstreamRes = await fetch(upstream, {
          method: req.method,
          headers,
          body: body.length ? body : undefined,
        })

        res.statusCode = upstreamRes.status
        upstreamRes.headers.forEach((value, key) => {
          if (key.toLowerCase() !== 'transfer-encoding') {
            res.setHeader(key, value)
          }
        })

        const responseBody = Buffer.from(await upstreamRes.arrayBuffer())
        res.setHeader('content-length', responseBody.length)
        res.end(responseBody)
      } catch (error) {
        res.statusCode = 502
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Proxy failed' }))
      }
    })
  }

  return {
    name: 'manga-updates-proxy',
    configureServer(server: any) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler)
    },
  }
}

export default defineConfig({
  plugins: [react(), mangaUpdatesProxyPlugin()],
})
