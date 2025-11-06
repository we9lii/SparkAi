<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1IqOgHCXdOJaq3J0OeGAv7Dpqn9xWQ5m-

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `VITE_GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Vercel

1. Push your code to GitHub (we’ve already pushed to `we9lii/SparkAi`).
2. Go to https://vercel.com/new and import the repo `we9lii/SparkAi`.
3. In Project Settings → Environment Variables, add:
   - Key: `VITE_GEMINI_API_KEY`
   - Value: your Gemini API key
   - Environments: Production and Preview
4. Keep your `.env.local` uncommitted locally; Vercel will inject the env var on build.
5. Build & deploy will run automatically.

Security tip: Restrict your API key in Google Cloud Console to the Generative Language API and limit HTTP referrers to your Vercel domain (e.g. `https://<your-project>.vercel.app/*`).
