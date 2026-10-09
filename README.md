# Question Engine

Solve problems by answering questions. Every answer becomes the input for the next question, using five operators: Drill down, Climb up, Split, Join and Flip.

- Works on its own with built-in question templates (no setup, no cost).
- Add an Anthropic API key and it switches on **Smart questions** (Claude asks about your specifics) and **Summarise with Claude**.
- Installs to a phone home screen and opens like an app.
- Sessions are saved in the browser on each device.

## Files

```
index.html            the app
api/ask.js            server function that talks to Claude (keeps the API key private)
manifest.webmanifest  home-screen install settings
sw.js                 offline support
icon.svg, icon-192.png, icon-512.png
```

The `api` folder must stay a folder named `api` with `ask.js` inside it. Vercel turns it into the `/api/ask` endpoint automatically. No `package.json` or build step is needed.

## Deploy (browser only)

1. **GitHub**: create a new repository (e.g. `question-engine`). Click **Add file → Upload files** and drag in all the files *and* the `api` folder. Commit.
2. **Vercel**: **Add New → Project**, import the repository, leave every setting at its default, and click **Deploy**. The app works now with built-in questions.
3. **Turn on Claude** (optional): in Vercel go to **Project → Settings → Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com
   - `APP_ACCESS_CODE` = any code you choose (recommended, see below)
   - `CLAUDE_MODEL` = optional; defaults to `claude-haiku-5-5` (fast and cheap). Use `claude-sonnet-5-5` for sharper questions.

   Then **Deployments → ⋯ → Redeploy** so the new variables take effect. A "Smart questions" switch appears at the top of the app.

## Access code

Without `APP_ACCESS_CODE`, anyone who finds the URL can use Claude on your API key. With it set, the app asks for the code once per device before Claude is used. Built-in questions always work without a code. Also set a monthly spend limit in the Anthropic console.

## Install on a phone

- **iPhone (Safari)**: Share → Add to Home Screen.
- **Android (Chrome)**: ⋮ menu → Install app (or Add to Home screen).
