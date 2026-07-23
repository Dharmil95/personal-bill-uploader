export function getAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const host = request.headers.get("host");
      if (host && originUrl.host === host) {
        return origin;
      }
    } catch {
      return null;
    }
  }

  const host = request.headers.get("host");
  if (!host) {
    return null;
  }

  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}
