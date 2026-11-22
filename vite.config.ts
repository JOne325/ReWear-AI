import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Connect } from 'vite'
import { handleRecommendations } from './server/recommendations.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'GEMINI_')
  const config = { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }
  const installRoute = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/api/recommendations') {
        next()
        return
      }
      void handleRecommendations(request, response, config).catch(next)
    })
  }

  return {
    plugins: [
      react(),
      { name: 'rewear-recommendations', configureServer: installRoute, configurePreviewServer: installRoute },
    ],
  }
})
