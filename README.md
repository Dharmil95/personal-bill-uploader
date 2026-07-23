# Bill Uploader

A mobile-first application for capturing, categorizing, and managing bills. Uploads are saved to your Google Drive under `Bills/<Category>/`.

## Features

- Password-protected access
- Camera capture and file selection for images and PDFs
- Category selection and custom categories
- Direct Google Drive uploads (up to 25 MB)
- Recent upload history loaded from Drive

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Fill in the values in `.env`, then open [http://localhost:3000/login](http://localhost:3000/login).

Full Google Cloud setup: [docs/google-drive-setup.md](docs/google-drive-setup.md)

## Deploy to Vercel

1. Push this repository to GitHub.
2. Open your Vercel project (or import the repo at [vercel.com/new](https://vercel.com/new)).
3. In **Settings → Environment Variables**, add the same values from your local `.env` for **Production**:
   - `APP_PASSWORD`
   - `SESSION_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REFRESH_TOKEN`
4. Redeploy (**Deployments → Redeploy**, or push a new commit).
5. Open `https://your-app.vercel.app/login` and sign in with `APP_PASSWORD`.

No build settings changes are needed. Vercel detects Next.js and runs `npm run build`.

Do not commit `.env`. Only `.env.example` (placeholders) belongs in GitHub.

## Tech stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Google Drive API
