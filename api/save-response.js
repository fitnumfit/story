import { formatTimes } from "../lib/blob-log.js";

function buildLegacyText(payload, times) {
  const smileLabels = { yes: "Yes 😊", little: "A little 🙂", notyet: "Not yet 🌙" };
  const lines = [
    "========================================",
    "  BOOK RESPONSE — For You",
    "========================================",
    `Saved at    : ${times.display}`,
    `Time (ISO)  : ${times.iso}`,
    `Time zone   : ${times.timeZone}`,
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

  const times = formatTimes(body.clientTime, body.timeZone);
  const text = buildLegacyText(payload, times);
  const stamp = times.iso.replace(/[:.]/g, "-").slice(0, 19);

  try {
    const { put } = await import("@vercel/blob");
    const { url } = await put(`responses/response_${stamp}.txt`, text, {
      access: "public",
      contentType: "text/plain; charset=utf-8",
      addRandomSuffix: true,
    });
    return res.status(200).json({ ok: true, file: `responses/response_${stamp}.txt`, url, time: times });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Save failed. Add Vercel Blob storage in your project dashboard.",
    });
  }
}
