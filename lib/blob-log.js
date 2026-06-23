import { putToBlob } from "./put-blob.js";

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

/** User-written answers — saved under her-responses/{userId}/{sessionId}/ */
const USER_RESPONSE_EVENTS = new Set(["accept_apology", "smile", "note"]);

/** Page views & navigation — saved under book-activity/{userId}/{sessionId}/ */
const ANALYTICS_EVENTS = new Set([
  "link_opened",
  "book_opened",
  "page_turn",
  "instagram_click",
  "book_closed",
]);

export function safeSessionId(sessionId) {
  return (sessionId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

export function safeUserId(userId) {
  return (userId || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

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

function snapshotLines(snapshot = {}) {
  const lines = [];
  if (snapshot.accepted != null) lines.push(`Accepted    : ${snapshot.accepted ? "YES ♡" : "No"}`);
  if (snapshot.smile) lines.push(`Smile       : ${SMILE_LABELS[snapshot.smile] || snapshot.smile}`);
  if (snapshot.note) {
    lines.push("Note        :");
    lines.push(snapshot.note);
  }
  return lines;
}

export function buildEventText({ event, sessionId, times, data = {}, meta = {} }) {
  const lines = [
    "========================================",
    USER_RESPONSE_EVENTS.has(event) ? "  HER RESPONSE — For You" : "  BOOK ACTIVITY — For You",
    "========================================",
    `Event       : ${event}`,
    `Description : ${EVENT_LABELS[event] || event}`,
    `Time        : ${times.display}`,
    `Time (ISO)  : ${times.iso}`,
    `Time zone   : ${times.timeZone}`,
    `User        : ${meta.userId || "anonymous"}`,
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
    lines.push(`Page spread : ${meta.spread ?? data.spread ?? "—"}`);
    lines.push(`Page type   : ${meta.pageType || data.pageType || "—"}`);
    if (meta.pageTitle || data.pageTitle) lines.push(`Page title  : ${meta.pageTitle || data.pageTitle}`);
  } else if (event === "link_opened") {
    lines.push("Status      : Link was opened ✓");
    if (meta.referrer) lines.push(`Referrer    : ${meta.referrer}`);
  } else if (event === "instagram_click") {
    lines.push(`Link        : ${data.url || "—"}`);
  }

  if (meta.userSnapshot && USER_RESPONSE_EVENTS.has(event)) {
    lines.push("----------------------------------------");
    lines.push("Session snapshot (all her answers so far):");
    const snapLines = snapshotLines(meta.userSnapshot);
    if (snapLines.length) lines.push(...snapLines);
    else lines.push("(none yet)");
  }

  if (meta.referrer && event !== "link_opened") lines.push(`Referrer    : ${meta.referrer}`);
  if (meta.userAgent) lines.push(`Device      : ${meta.userAgent}`);

  lines.push("========================================");
  return lines.join("\n") + "\n";
}

function blobFolder(event, sessionId, userId) {
  const sid = safeSessionId(sessionId);
  const uid = safeUserId(userId);
  if (USER_RESPONSE_EVENTS.has(event)) return `her-responses/${uid}/${sid}`;
  if (ANALYTICS_EVENTS.has(event)) return `book-activity/${uid}/${sid}`;
  return `interactions/${uid}/${sid}`;
}

export async function saveUserSnapshot({ sessionId, userId, times, event, data, meta }) {
  const snapshot = meta.userSnapshot || {};
  const sid = safeSessionId(sessionId);
  const uid = safeUserId(userId);
  const body = {
    userId: userId || uid,
    sessionId,
    lastUpdated: times.iso,
    lastEvent: event,
    accepted: snapshot.accepted ?? null,
    smile: snapshot.smile || "",
    note: snapshot.note || "",
    lastAnswer: {
      event,
      at: times.iso,
      data,
    },
  };

  return putToBlob(`her-responses/${uid}/${sid}/summary.json`, JSON.stringify(body, null, 2), {
    contentType: "application/json; charset=utf-8",
    addRandomSuffix: false,
  });
}

export async function saveEventToBlob({ event, sessionId, userId, times, data, meta }) {
  const text = buildEventText({ event, sessionId, times, data, meta });
  const stamp = times.iso.replace(/[:.]/g, "-").slice(0, 19);
  const folder = blobFolder(event, sessionId, userId);
  const path = `${folder}/${stamp}_${event}.txt`;

  const blob = await putToBlob(path, text, {
    contentType: "text/plain; charset=utf-8",
    addRandomSuffix: true,
  });

  if (USER_RESPONSE_EVENTS.has(event) && meta.userSnapshot) {
    await saveUserSnapshot({ sessionId, userId, times, event, data, meta }).catch(() => {});
  }

  return { ...blob, folder, path };
}
