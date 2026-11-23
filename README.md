# ReWear

ReWear helps students wear more of the clothes they already own so they buy less.

[Read the user guide](docs/USER_GUIDE.md) or use **How to use** in the app.

## Local setup

Use Git, Node.js 24 and npm. In a new terminal, run:

```sh
git clone https://github.com/JOne325/ReWear-AI.git
cd ReWear-AI
npm ci
npm run dev
```

Open the URL printed by Vite, then choose **Open your closet**. If you already have a clone, update `main` with `git pull --ff-only` before running `npm ci`.

You can explore the demo wardrobe, add and edit garments manually, use the photo editor, and get basic outfit ideas from Style Me without credentials. The first background removal downloads its model and can take longer. Closet and Saved data stay in IndexedDB for the current browser and origin. Use the same URL when returning to your closet.

To test on a phone on the same network, start Vite with `npm run dev -- --host` and open its **Network** URL on the phone. An HTTPS host is needed to test installation from another device.

## Style Me setup

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. Restart the development server after changing it. `GEMINI_MODEL` defaults to `gemini-3.8-flash`. The photo and outfit overrides take precedence for their respective features.

The key enables personalized Style Me suggestions, AI smart crop and photo-assisted garment naming. Ask for any occasion or look, even with an empty closet. Style Me can suggest missing pieces and offer web search links. You can save a look when all of its pieces are in your closet. Keep `.env.local` on your machine.

When Gemini returns HTTP 429, remains unavailable with HTTP 503, or times out, photo analysis and outfit suggestions try the next model in the server’s `GEMINI_FALLBACK_MODELS` list. The default order is `gemini-3.6-flash,gemini-3.5-flash-lite`. Set an empty list to disable switching. Choose models that accept image input and structured output if you use the same list for photos and outfits. The same project key is used throughout.

Style Me sends clothing names, categories, colors and IDs to the server when you request an outfit. The server calls Gemini and checks that its suggested items belong to the submitted closet. The development and preview servers handle `POST /api/recommendations`. The production server serves this endpoint alongside the built app.

Run `npm test` to check the recommendation contract with a simulated Gemini response.

## Try-on setup

Follow the [Try-on service setup](vton_service/README.md) to start the optional Python service and connect ReWear to Hugging Face. Try-on uses one person photo and one top photo. Hugging Face GPU availability and account quotas apply.

## Run the production server

Run `npm ci` and `npm run build`, then `npm start`. Set `GEMINI_API_KEY` and, if using Try-on, `VTON_SERVICE_URL` in the host's server environment. For a local production run with `.env.local`, use `node --env-file=.env.local server/start.ts`. The Node server serves the app and API on `PORT` (default 3000). Use HTTPS on a public host.

Run `npm run lint`, `npm test`, and `npm run build` to verify your checkout.

## Real-phone acceptance check

Add a top, bottoms and shoes. Compare manual and AI-assisted photo entry, then refresh to verify the saved garments. In Style Me, request a campus outfit and follow up with a change. Save a look made from your closet, tap **I wore this** in Saved, and check that the ReWear Score updates. If Try-on is configured, choose two photos you have permission to use and generate a preview with a top.

### Model settings and photo previews

Set `GEMINI_PHOTO_MODEL` or `GEMINI_OUTFIT_MODEL` in the server environment to override an individual feature. `GEMINI_MODEL` is their shared fallback. Restart the server after changing model settings.

Fit whole garment keeps the full frame in a square tile. Edit a garment to replace either view or reclassify a jacket as Outerwear. Existing single photos appear as the front view, and Saved keeps the snapshots from the time of saving.

## AppFusion 2026 submission

**Category** · Sustainability

Students own clothes but keep buying more because they cannot see what they could already wear. ReWear suggests outfits from the clothes they own and shows how one more piece would multiply their options.

**AI features.** Gemini vision suggests a garment name, category, colour and crop box. Style Me accepts requests in natural language and uses recent outfit IDs to discourage repeats. The server validates returned outfit IDs against the submitted closet. Dark, patterned or low-contrast garments can be misread. Users can review and edit the results.

Set `GEMINI_PHOTO_MODEL` and `GEMINI_OUTFIT_MODEL` for individual features, with `GEMINI_MODEL` as the shared fallback. Both features default to `gemini-3.8-flash`.

**Privacy.** The closet, garment photos and saved looks live in the browser's IndexedDB. Outfit recommendations send the styling request, garment IDs, names, categories and colours, and recent outfit IDs. When users request photo details or AI smart crop, the app sends the prepared JPEG to Gemini. Try-on sends the two chosen photos to the configured IDM-VTON provider. Credentials stay on the server.

**Project history.** The repository has no commits before November 20, 2026. The November 21–22 history records the original Closet, Style Me and Saved flow, local storage, garment photos and outfit boards, photo-assisted entry, two occasions, front and back photos, outerwear, rotation, smart crop, and earlier saved-look tools. The November 23 AppFusion commits add Gemini outfit selection from the closet with recent-look context, Closet Gap, clearer offline and AI-failure messages, and the install manifest and icons.

**AI coding tools.** Claude and Codex were used for scaffolding, tests and refactors, with team review.

- Production verification covered the four app pages and the manifest. Browser tests covered photo selection and cropping, both outfit occasions with simulated responses, saving and logging a wear, a 50% score, the six-outfit closet gap, and the offline and missing-key messages.
- Live Gemini checks succeeded for a bundled garment photo and for University and Interview outfit requests after adding one retry for upstream HTTP 503. The physical phone camera and Add to Home Screen still need device checks.
- TODO(human): Add team name and member names.
