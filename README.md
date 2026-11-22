# ReWear AI

A mobile-first wardrobe app for suggesting outfits from clothes you own.

## Local setup

Use Git, Node.js 24 and npm. From the project directory run:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Run `npm run build` and `npm run lint` before merging.

Closet stores clothing in IndexedDB for the current browser and origin. Example cards appear until you add a clothing item. Style Me needs at least one saved item in each category.

## Style Me setup

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. Restart Vite after changing it. `GEMINI_MODEL` is optional.

Style Me sends clothing names, categories and IDs to the server when you request an outfit. The server calls Gemini and checks that its suggested items belong to the submitted closet. Vite serves `POST /api/recommendations` in development and local preview. For deployment, the static build needs a server exposing the same endpoint.

Run `npm test` to check the recommendation contract with a simulated Gemini response.

## First milestone

Developer A starts on `feature/frontend` with the Closet, Style Me and Saved navigation and a mock wardrobe. Developer B works on `feature/ai-storage` on shared types, IndexedDB and the server-side recommendation endpoint. Developer A joins backend work after the frontend milestone. Keep Gemini credentials server-side.
