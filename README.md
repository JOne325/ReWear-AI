# ReWear AI

A mobile-first wardrobe app for suggesting outfits from clothes you own.

## Local setup

Use Git, Node.js 24 and npm. From the project directory run:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Run `npm run build` and `npm run lint` before merging.

Closet stores clothing and cropped photos in IndexedDB for the current browser and origin. An empty closet shows a six-piece demo wardrobe with locally bundled AI-generated garment images. Style Me cycles through sample outfits in demo mode. Personal recommendations require one saved item in each category. Saved outfits keep the original garment IDs, images, and names as they appeared when saved.

## Style Me setup

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. Restart Vite after changing it. `GEMINI_MODEL` is optional.

Style Me sends clothing names, categories, colors and IDs to the server when you request an outfit. The server calls Gemini and checks that its suggested items belong to the submitted closet. Vite serves `POST /api/recommendations` in development and local preview. The production server serves this endpoint alongside the built app.

Run `npm test` to check the recommendation contract with a simulated Gemini response.

## First milestone

Developer A starts on `feature/frontend` with the Closet, Style Me and Saved navigation and a mock wardrobe. Developer B works on `feature/ai-storage` on shared types, IndexedDB and the server-side recommendation endpoint. Developer A joins backend work after the frontend milestone. Keep Gemini credentials server-side.

## Photo suggestions and occasions

After applying a crop, choose **Suggest details from photo** to send that cropped JPEG to Gemini. Review or correct the suggested name, category and color before saving. Manual entry works when the provider is unavailable. Choose University or Interview in Style Me. Only garment metadata goes into the outfit request.

## Run the production server

Use Node 24. Run `npm ci` and `npm run build`, then `npm start`. Configure GEMINI_API_KEY in your host's server environment. For local testing with an existing .env.local, use `node --env-file=.env.local server/start.ts`. The server listens on PORT (default 3000) and serves both dist and the two API routes. Use HTTPS on the public host. Each server process accepts up to 20 AI requests per socket peer and 100 total per minute across both endpoints. A reverse proxy can cause clients to share a limit. Use a shared host-level limiter before scaling to multiple processes.

## Real-phone acceptance check

Use four tops, four bottoms and four pairs of shoes. Record expected category and acceptable colors before testing. Include dark, patterned and low-contrast pieces. For each photo note category correct, color accepted, corrections, and time to save. Compare a few manual entries against assisted entries. Refresh to verify the saved corrections. Request both occasions, check all three photos belong to the closet, and record whether you would wear each look and which piece you would swap.
