import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Connect } from 'vite'
import { apiConfig, apiPaths, handleApi } from './server/api.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['GEMINI_', 'VTON_'])
  const config = apiConfig(env)
  const installRoute = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use((request, response, next) => {
      if (!apiPaths.includes(request.url?.split('?')[0] ?? '')) {
        next()
        return
      }
      void handleApi(request, response, config).catch(next)
    })
  }

  return {
    plugins: [
      react(),
      { name: 'rewear-recommendations', configureServer: installRoute, configurePreviewServer: installRoute },
    ],
  }
})
