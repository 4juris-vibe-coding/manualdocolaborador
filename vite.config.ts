import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/** Em desenvolvimento, serve as funções de /api (mesmo código que roda na Vercel). */
function apiDev(): Plugin {
  return {
    name: 'api-dev',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, { ...loadEnv('development', process.cwd(), ''), ...process.env })
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([a-z]+)(\?.*)?$/)
        if (!m) return next()
        try {
          const { default: handler } = await server.ssrLoadModule('/api/[acao].ts')
          ;(req as unknown as { query: unknown }).query = { acao: m[1] }
          await handler(req, res)
        } catch (e) {
          console.error('[api-dev]', e)
          res.statusCode = 500; res.end('{"erro":"Erro interno do servidor."}')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDev()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 4177, open: false },
})
