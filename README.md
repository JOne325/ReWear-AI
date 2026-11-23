# ReWear

ReWear helps students wear more of the clothes they already own so they buy less.

[Read the user guide](docs/USER_GUIDE.md) or use **How to use** in the app.

## Local setup

Use Git, Node.js 24 and npm. From the project directory run:

```sh
npm ci
npm run dev
```

Open the local URL printed by the development server. Run `npm run build` and `npm run lint` before merging.

Closet stores clothing and cropped photos in IndexedDB for the current browser and origin. An empty closet shows a six-piece demo wardrobe with locally bundled AI-generated garment images. Style Me cycles through sample outfits in demo mode. Personal recommendations require one saved top, one garment in Bottoms and one pair of shoes. Saved outfits keep the original garment IDs, images, and names as they appeared when saved.

## Style Me setup

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. Restart the development server after changing it. `GEMINI_MODEL` defaults to `gemini-3.8-flash`. The photo and outfit overrides take precedence for their respective features.

When Gemini returns HTTP 429, remains unavailable with HTTP 503, or times out, photo analysis and outfit suggestions try the next model in the server’s `GEMINI_FALLBACK_MODELS` list. The default order is `gemini-3.6-flash,gemini-3.5-flash-lite`. Set an empty list to disable switching. Choose models that accept image input and structured output if you use the same list for photos and outfits. The same project key is used throughout.

Style Me sends clothing names, categories, colors and IDs to the server when you request an outfit. The server calls Gemini and checks that its suggested items belong to the submitted closet. The development and preview servers handle `POST /api/recommendations`. The production server serves this endpoint alongside the built app.

Run `npm test` to check the recommendation contract with a simulated Gemini response.

## Photo suggestions and occasions

AI smart crop fills a blank garment name when you confirm the crop. After any crop, you can also choose **Suggest name and details from photo** to send that cropped JPEG to Gemini. Review or correct the suggested name, category and color before saving. Manual entry works when the provider is unavailable. Choose University or Interview in Style Me. Only garment metadata goes into the outfit request.

## Run the production server

Use Node 24. Run `npm ci` and `npm run build`, then `npm start`. Configure GEMINI_API_KEY in your host's server environment. For local testing with an existing .env.local, use `node --env-file=.env.local server/start.ts`. The server listens on PORT (default 3000) and serves both dist and the two API routes. Use HTTPS on the public host. Each server process accepts up to 20 AI requests per socket peer and 100 total per minute across both endpoints. A reverse proxy can cause clients to share a limit. Use a shared host-level limiter before scaling to multiple processes.

## Real-phone acceptance check

Use four tops, four bottoms and four pairs of shoes. Record expected category and acceptable colors before testing. Include dark, patterned and low-contrast pieces. For each photo note category correct, color accepted, corrections, and time to save. Compare a few manual entries against assisted entries. Refresh to verify the saved corrections. Request both occasions, check all three photos belong to the closet, and record whether you would wear each look and which piece you would swap.

### Model settings and photo previews

Set `GEMINI_PHOTO_MODEL` or `GEMINI_OUTFIT_MODEL` in the server environment to override an individual feature. `GEMINI_MODEL` is their shared fallback. Restart the server after changing model settings.

Fit whole garment keeps the full frame in a square tile. Edit a garment to replace either view or reclassify a jacket as Outerwear. Existing single photos appear as the front view, and Saved keeps the snapshots from the time of saving.

## AppFusion 2026 submission

**Category** · Sustainability

Students own clothes but keep buying more because they cannot see what they could already wear. ReWear suggests outfits from the clothes they own and shows how one more piece would multiply their options.

**AI features.** Gemini vision suggests a garment name, category, colour and crop box. For University or Interview, Gemini chooses from the eligible closet inventory, capped at 100 garments, and receives recent outfit IDs to discourage repeats. Demo mode generates outfits locally. The server validates returned outfit IDs against the submitted closet. Dark, patterned or low-contrast garments can be misread. Users can review and edit the results.

Set `GEMINI_PHOTO_MODEL` and `GEMINI_OUTFIT_MODEL` for individual features, with `GEMINI_MODEL` as the shared fallback. Both features default to `gemini-3.8-flash`.

**Privacy.** The closet, garment photos and saved looks live in the browser's IndexedDB. Outfit recommendations send garment IDs, names, categories and colours, the occasion, and recent outfit IDs. When users request photo details or AI smart crop, the app sends the prepared JPEG to Gemini. The API key stays on the server.

**Project history.** The repository has no commits before November 20, 2026. The November 21–22 history records the original Closet, Style Me and Saved flow, local storage, garment photos and outfit boards, photo-assisted entry, two occasions, front and back photos, outerwear, rotation, smart crop, and earlier saved-look tools. The November 23 AppFusion commits add Gemini outfit selection from the closet with recent-look context, Closet Gap, clearer offline and AI-failure messages, and the install manifest and icons.

**AI coding tools.** Claude and Codex were used for scaffolding, tests and refactors, with team review.

- Production verification covered the four app pages and the manifest. Browser tests covered photo selection and cropping, both outfit occasions with simulated responses, saving and logging a wear, a 50% score, the six-outfit closet gap, and the offline and missing-key messages.
- Live Gemini checks succeeded for a bundled garment photo and for University and Interview outfit requests after adding one retry for upstream HTTP 503. The physical phone camera and Add to Home Screen still need device checks.
- TODO(human): Add team name and member names.
