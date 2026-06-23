import { put } from "@vercel/blob";

const MISSING_TOKEN_MSG =
  "BLOB_READ_WRITE_TOKEN is missing. In Vercel: Storage → connect Blob to project, " +
  "or add BLOB_READ_WRITE_TOKEN under Settings → Environment Variables, then Redeploy.";

function getToken() {
  const raw = process.env.BLOB_READ_WRITE_TOKEN;
  if (!raw) return "";
  const token = raw.trim();
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1).trim();
  }
  return token;
}

/**
 * Same pattern as Vercel docs:
 *   const blob = await put(filename, body, { access: 'public' });
 */
export async function putToBlob(filename, body, extra = {}) {
  const token = getToken();
  if (!token) throw new Error(MISSING_TOKEN_MSG);

  return put(filename, body, {
    access: "public",
    token,
    ...extra,
  });
}
