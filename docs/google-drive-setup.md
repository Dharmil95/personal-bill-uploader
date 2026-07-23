# Google Drive Setup

This app uploads bills to your personal Google Drive using OAuth and the `drive.file` scope. Files are stored under:

```text
My Drive/Bills/Me/<Category>/
My Drive/Bills/Parents/<Category>/
```

## 1. Create a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project or select an existing one.
3. Enable the **Google Drive API** for that project.

## 2. Configure OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External** unless this is a Workspace-only internal app.
3. Add an app name, support email, and developer contact.
4. Add the scope:
   - `https://www.googleapis.com/auth/drive.file`
5. Add your Google account as a test user while the app is in Testing.
6. Before production use, publish the app to **In production** so refresh tokens do not expire after 7 days.

Reference: [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server)

## 3. Create OAuth credentials

1. Go to **APIs & Services → Credentials**.
2. Create an **OAuth client ID** of type **Web application**.
3. Add authorized redirect URIs if you use an OAuth helper tool. For the refresh-token bootstrap script in this repo, `http://localhost:3000/oauth2callback` is enough.
4. Copy the **Client ID** and **Client secret**.

## 4. Generate a refresh token

Use the helper script from the project root:

```bash
npm install
node scripts/get-google-refresh-token.mjs
```

The script opens a browser consent URL. After approval, it prints a refresh token in the terminal.

Keep that refresh token secret. It lets the server upload to your Drive without asking you to sign in on every upload.

## 5. Configure local environment

```bash
cp .env.example .env
```

Fill in `.env`:

```bash
APP_PASSWORD=your-private-app-password
SESSION_SECRET=generate-a-long-random-string-at-least-32-characters
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REFRESH_TOKEN=your-google-oauth-refresh-token
```

Generate `SESSION_SECRET` with:

```bash
openssl rand -hex 32
```

Then run:

```bash
npm run dev
```

Sign in at [http://localhost:3000/login](http://localhost:3000/login).

## 6. Configure Vercel

1. Push the latest code to GitHub.
2. Open your Vercel project → **Settings → Environment Variables**.
3. Add these for the **Production** environment (same values as your local `.env`):

| Name | Notes |
|------|--------|
| `APP_PASSWORD` | Password for `/login` |
| `SESSION_SECRET` | Long random string (`openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` | From Google Cloud OAuth client |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud OAuth client |
| `GOOGLE_REFRESH_TOKEN` | From `node scripts/get-google-refresh-token.mjs` |

4. Redeploy the project after saving env vars.
5. Open `https://your-app.vercel.app/login` and sign in.

Production URL example:

- App: `https://personal-bill-uploader.vercel.app`
- Login: `https://personal-bill-uploader.vercel.app/login`

Commit `.env.example` only. Keep real secrets in local `.env` and in Vercel — never commit `.env`.

## 7. How uploads work

1. You sign in with the app password.
2. Choose **Me** or **Parents** (default Me), then pick a category.
3. The browser asks the Vercel API for a Google Drive resumable upload session.
4. The server creates or reuses `Bills/Me/<Category>/` or `Bills/Parents/<Category>/` in your Drive.
5. The browser uploads the file bytes directly to Google Drive.
6. The Recent tab reads uploaded files from Drive metadata and can filter by Me, Parents, or Everyone.

This avoids Vercel’s 4.5 MB serverless request limit while still supporting files up to 25 MB.

Reference: [Google Drive resumable uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)

## Troubleshooting

- `Invalid password`: check `APP_PASSWORD` in Vercel/local env.
- `Google Drive credentials are not configured`: one or more Google env vars are missing.
- `Failed to refresh Google access token`: refresh token is invalid, revoked, or was created while the consent screen was still in Testing and has expired.
- Upload works locally but not on Vercel: confirm all env vars exist in the Production environment and redeploy.
- Files upload but do not appear in Recent: verify the uploaded file has app property `source=bill-uploader`.
