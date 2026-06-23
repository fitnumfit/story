import { formatTimes, saveEventToBlob } from "../lib/blob-log.js";

const ALLOWED_EVENTS = new Set([
  "link_opened",
  "book_opened",
  "page_turn",
  "accept_apology",
  "smile",
  "note",
  "instagram_click",
  "book_closed",
]);

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

  const { event, sessionId, userId, clientTime, timeZone, data = {}, meta = {} } = body || {};
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return res.status(400).json({ ok: false, error: "Invalid or missing event" });
  }
  if (!sessionId) return res.status(400).json({ ok: false, error: "Missing sessionId" });

  const times = formatTimes(clientTime, timeZone);
  const enrichedMeta = { ...meta, userId: userId || meta.userId || "anonymous" };

  try {
    const blob = await saveEventToBlob({
      event,
      sessionId,
      userId: enrichedMeta.userId,
      times,
      data,
      meta: enrichedMeta,
    });
    return res.status(200).json({ ok: true, event, time: times, ...blob });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Save failed. Add Vercel Blob storage in your project dashboard.",
    });
  }
}
