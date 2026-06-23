import { put } from "@vercel/blob";

const EVENT_LABELS = {
  link_opened: "She opened the book link",
  book_opened: "She opened the book",
  page_turn: "She turned a page",
  accept_apology: "Can you accept my apologies?",
  smile: "Did this bring a little smile?",
  note: "A note for me",
  instagram_click: "She tapped your Instagram link",
  book_closed: "She closed the book",
};

const SMILE_LABELS = { yes: "Yes 😊", little: "A little 🙂", notyet: "Not yet 🌙" };

export function formatTimes(clientTime, timeZone) {
  const date = clientTime ? new Date(clientTime) : new Date();
  if (Number.isNaN(date.getTime())) return { iso: new Date().toISOString(), display: "Unknown time", timeZone: timeZone || "UTC" };

  const tz = timeZone || "UTC";
  let display;
  try {
    display = new Intl.DateTimeFormat("en-IN", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    display = date.toISOString();
  }

  return { iso: date.toISOString(), display, timeZone: tz };
}

export function buildEventText({ event, sessionId, times, data = {}, meta = {} }) {
  const lines = [
    "========================================",
    "  BOOK INTERACTION — For You",
    "========================================",
    `Event       : ${event}`,
    `Description : ${EVENT_LABELS[event] || event}`,
    `Time        : ${times.display}`,
    `Time (ISO)  : ${times.iso}`,
    `Time zone   : ${times.timeZone}`,
    `Session     : ${sessionId || "unknown"}`,
    "----------------------------------------",
  ];

  if (event === "accept_apology") {
    lines.push(`Question    : ${EVENT_LABELS.accept_apology}`);
    lines.push(`Answer      : ${data.accepted ? "YES ♡" : "No"}`);
  } else if (event === "smile") {
    lines.push(`Question    : ${EVENT_LABELS.smile}`);
    lines.push(`Answer      : ${SMILE_LABELS[data.value] || data.value || "—"}`);
  } else if (event === "note") {
    lines.push(`Question    : ${EVENT_LABELS.note}`);
    lines.push("Answer      :");
    lines.push(data.text || "(empty)");
  } else if (event === "page_turn") {
    lines.push(`Page spread : ${data.spread ?? "—"}`);
    lines.push(`Page type   : ${data.pageType || "—"}`);
    if (data.pageTitle) lines.push(`Page title  : ${data.pageTitle}`);
  } else if (event === "link_opened") {
    lines.push("Status      : Link was opened ✓");
    if (meta.referrer) lines.push(`Referrer    : ${meta.referrer}`);
  } else if (event === "instagram_click") {
    lines.push(`Link        : ${data.url || "—"}`);
  }

  if (meta.referrer && event !== "link_opened") lines.push(`Referrer    : ${meta.referrer}`);
  if (meta.userAgent) lines.push(`Device      : ${meta.userAgent}`);

  lines.push("========================================");
  return lines.join("\n") + "\n";
}

export async function saveEventToBlob({ event, sessionId, times, data, meta }) {
  const text = buildEventText({ event, sessionId, times, data, meta });
  const stamp = times.iso.replace(/[:.]/g, "-").slice(0, 19);
  const path = `interactions/${stamp}_${event}.txt`;

  const { url } = await put(path, text, {
    access: "public",
    contentType: "text/plain; charset=utf-8",
    addRandomSuffix: true,
  });

  return { url, path };
}
