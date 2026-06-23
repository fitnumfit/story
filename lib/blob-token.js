const MISSING_TOKEN_MSG =
  "BLOB_READ_WRITE_TOKEN is missing on the server. " +
  "In Vercel: Project → Settings → Environment Variables → add BLOB_READ_WRITE_TOKEN " +
  "(Production + Preview), then Redeploy. " +
  "Locally: create .env.local with BLOB_READ_WRITE_TOKEN=... and run `npx vercel dev`.";

function cleanEnv(value) {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function getBlobToken() {
  const token = cleanEnv(process.env.BLOB_READ_WRITE_TOKEN);
  if (!token) throw new Error(MISSING_TOKEN_MSG);
  return token;
}

export function blobPutOptions(extra = {}) {
  return {
    access: "public",
    token: getBlobToken(),
    ...extra,
  };
}
