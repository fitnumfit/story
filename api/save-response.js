import { put } from "@vercel/blob";

function buildText(payload) {
  const smileLabels = { yes: "Yes 😊", little: "A little 🙂", notyet: "Not yet 🌙" };
  const now = new Date();
  const lines = [
    "========================================",
    "  BOOK RESPONSE — For You",
    "========================================",
    `Saved at : ${now.toISOString()}`,
    "----------------------------------------",
    `Accepted apology: ${payload.accepted ? "YES ♡" : "No"}`,
  ];
  if (payload.smile) lines.push(`Smile: ${smileLabels[payload.smile] || payload.smile}`);
  if (payload.note) {
    lines.push("", "Her note:", payload.note);
  }
  lines.push("========================================");
  return lines.join("\n") + "\n";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid JSON" });
    }
  }

  const payload = body?.payload;
  if (!payload) return res.status(400).json({ ok: false, error: "Missing payload" });

  const text = buildText(payload);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `responses/response_${stamp}.txt`;

  try {
    const blob = await put(filename, text, {
      access: "public",
      contentType: "text/plain; charset=utf-8",
      addRandomSuffix: true,
    });

    await put(`responses/all-responses_${stamp}.txt`, text, {
      access: "public",
      contentType: "text/plain; charset=utf-8",
      addRandomSuffix: false,
    }).catch(() => {});

    return res.status(200).json({ ok: true, file: filename, url: blob.url });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Save failed. Add Vercel Blob storage in your project dashboard.",
    });
  }
}
