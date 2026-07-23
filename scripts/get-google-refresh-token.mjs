import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { URL } from "node:url";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const REDIRECT_URI = "http://localhost:3000/oauth2callback";

function loadEnvFile() {
  for (const filename of [".env", ".env.local"]) {
    try {
      const contents = readFileSync(filename, "utf8");
      for (const line of contents.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }
        const separator = trimmed.indexOf("=");
        if (separator === -1) {
          continue;
        }
        const key = trimmed.slice(0, separator);
        const value = trimmed.slice(separator + 1);
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      return;
    } catch {
      // Try the next filename.
    }
  }
}

loadEnvFile();

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.");
  process.exit(1);
}

const state = randomBytes(16).toString("hex");
const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES.join(" "));
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");
authUrl.searchParams.set("state", state);

const server = createServer(async (request, response) => {
  if (!request.url?.startsWith("/oauth2callback")) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const callbackUrl = new URL(request.url, "http://localhost:3000");
  const code = callbackUrl.searchParams.get("code");
  const returnedState = callbackUrl.searchParams.get("state");

  if (!code || returnedState !== state) {
    response.writeHead(400);
    response.end("Authorization failed.");
    server.close();
    return;
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenResponse.json();

  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end("<h1>Authorization complete.</h1><p>You can close this tab.</p>");
  server.close();

  if (!tokenResponse.ok || !tokenData.refresh_token) {
    console.error("Token exchange failed:", tokenData);
    process.exit(1);
  }

  console.log("\nAdd this to .env and Vercel:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${tokenData.refresh_token}`);
});

server.listen(3000, () => {
  console.log("Open this URL in your browser:\n");
  console.log(authUrl.toString());

  try {
    execSync(`xdg-open "${authUrl.toString()}"`, { stdio: "ignore" });
  } catch {
    // Browser open is best-effort only.
  }
});
