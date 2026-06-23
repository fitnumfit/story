/* ===== EDIT THESE ===== */
const SNOWY_IG = "snowy"; // ← your Instagram @username (no @)

const CHAPTERS = [
  { title: "I'm sorry", image: "images/chapter-1.svg", story: "I know I hurt you, and I hate that you're carrying pain because of me. You never deserved any of it. I'm truly sorry." },
  { title: "You matter to me", image: "images/chapter-2.svg", story: "Even though things went wrong between us, you still mean the world to me. Your happiness and peace always mattered to me." },
  { title: "What I did wrong", image: "images/chapter-3.svg", story: "I take full responsibility. No excuses. I see clearly now how my actions pushed you away, and I regret it deeply." },
  { title: "The friendship we had", image: "images/chapter-4.svg", story: "What we shared was real — the laughs, the late talks, the comfort of knowing someone cared. I miss that. I miss you." },
  { title: "A hope for us", image: "images/chapter-5.svg", story: "I don't expect you to forgive me right away. I just hope one day we can find peace again — even a quiet hello would mean everything." },
];

const INTRO = { title: "Before you read this…", body: "I know you blocked me, and I understand why. This isn't to argue or pressure you — only to say sorry, honestly, from my heart." };
const FINALE = { title: "From my heart", body: "If you ever feel ready, I'd love to rebuild what we had — slowly, with respect and love. You'll always have a place in my heart." };

const SAVE_API = "/api/save-response";
const TURN_MS = 1000;

function igUrl() {
  return `https://www.instagram.com/${SNOWY_IG}`;
}

function snowyLink() {
  return `<a class="pg__ig" href="${igUrl()}" target="_blank" rel="noopener noreferrer">@${SNOWY_IG}</a>`;
}

function buildPages() {
  const pages = [{ type: "intro", ...INTRO }];
  CHAPTERS.forEach((ch, i) => {
    const n = i + 1;
    pages.push({ type: "chapter-start", number: n, title: ch.title });
    pages.push({ type: "chapter-story", number: n, image: ch.image, story: ch.story });
  });
  pages.push({ type: "finale", ...FINALE });
  pages.push({ type: "interactive" });
  pages.push({ type: "story-continue" });
  return pages;
}

const PAGES = buildPages();

let book, bookClosed, bookOpen, actionsOpen, footer;
let btnOpen, zonePrev, zoneNext, turnHints, readingBar;
let layerLeft, layerRight, underLeft, underRight;
let flipper, flipFront, flipBack;
let bgm, musicBtn, musicIcon;

let isOpen = false;
let spread = 0;
let busy = false;
let touchX = 0;
let musicOn = true;

const herResponse = { accepted: false, smile: "", note: "" };

const TURN_HINT = '<p class="pg__turn-hint">Click to turn page</p>';

function showTurnHint(page, side) {
  if (side === "right") return TURN_HINT;
  if (page.type === "chapter-story" && page.number === CHAPTERS.length) return TURN_HINT;
  return "";
}

function blankPaper(side) {
  return `<div class="pg pg--paper-back pg--${side}"></div>`;
}

function renderPage(page, side) {
  if (!page) return `<div class="pg pg--blank pg--${side}"></div>`;

  switch (page.type) {
    case "intro":
      return `<div class="pg pg--intro pg--${side}"><span class="pg__ico">☮</span><h2 class="pg__title">${page.title}</h2><p class="pg__text">${page.body}</p></div>`;
    case "chapter-start":
      return `<div class="pg pg--ch-start pg--${side}"><p class="pg__ch">Chapter ${page.number}</p><h2 class="pg__title">${page.title}</h2><span class="pg__heart">♡</span>${showTurnHint(page, side)}</div>`;
    case "chapter-story":
      return `<div class="pg pg--ch-story pg--${side}">
        <div class="pg__img-frame"><img class="pg__img" src="${page.image}" alt="Chapter ${page.number}" /></div>
        <p class="pg__text">${page.story}</p>
        ${showTurnHint(page, side)}
      </div>`;
    case "finale":
      return `<div class="pg pg--finale pg--${side}"><span class="pg__ico">☮</span><h2 class="pg__title">${page.title}</h2><p class="pg__text">${page.body}</p><p class="pg__sign">Always, ${snowyLink()}</p>${side === "right" ? TURN_HINT : ""}</div>`;
    case "interactive":
      return `<div class="pg pg--ix pg--${side}" data-ix="1">
        <p class="pg__ch">A gentle ask</p>
        <h2 class="pg__title">Your turn ♡</h2>
        <div class="ix-block">
          <button type="button" class="ix-btn ix-btn--accept" data-act="accept">Can you accept my apologies?</button>
        </div>
        <div class="ix-block">
          <p class="ix-lbl">Did this bring a little smile?</p>
          <div class="ix-smiles">
            <button type="button" class="ix-smile" data-smile="yes">😊 Yes</button>
            <button type="button" class="ix-smile" data-smile="little">🙂 A little</button>
            <button type="button" class="ix-smile" data-smile="notyet">🌙 Not yet</button>
          </div>
        </div>
        <div class="ix-block">
          <label class="ix-lbl" for="ix-note">A note for me <em>(optional)</em></label>
          <textarea id="ix-note" class="ix-note" rows="3" placeholder="Write anything you want to say…"></textarea>
        </div>
        <div class="ix-block">
          <button type="button" class="ix-btn ix-btn--send" data-act="send">Send my response ♡</button>
          <p class="ix-msg" id="ix-msg" hidden></p>
        </div>
        <p class="ix-foot">No pressure — only if you feel like it.</p>
      </div>`;
    case "story-continue":
      return `<div class="pg pg--continue pg--${side}">
        <span class="pg__heart">♡</span>
        <h2 class="pg__title">Story continues…</h2>
        <p class="pg__text">Maybe one day we'll write the next chapter together — slowly, with peace and love.</p>
        <p class="pg__sign">Always, ${snowyLink()}</p>
      </div>`;
    default:
      return `<div class="pg pg--blank pg--${side}"></div>`;
  }
}

function maxSpread() {
  const last = PAGES.length - 1;
  return last % 2 === 0 ? last : last - 1;
}

function setLayer(el, html) {
  if (el) el.innerHTML = html;
}

function paintSpread() {
  setLayer(layerLeft, renderPage(PAGES[spread], "left"));
  setLayer(layerRight, renderPage(PAGES[spread + 1], "right"));
  setLayer(underLeft, "");
  setLayer(underRight, "");
  hideFlipper();
  updateTurnHints();
  bindInteractive();
}

function isInteractiveSpread() {
  return PAGES[spread]?.type === "interactive" || PAGES[spread + 1]?.type === "interactive";
}

function isInteractiveLeft() {
  return PAGES[spread]?.type === "interactive";
}

function updateTurnHints() {
  if (!turnHints || !zonePrev || !zoneNext) return;

  const atStart = spread <= 0;
  const atEnd = spread >= maxSpread();
  const ixLeft = isInteractiveLeft();
  const endBack = atEnd && ixLeft;

  zonePrev.classList.toggle("is-off", atStart || busy);
  zonePrev.classList.toggle("turn-zone--on-right", endBack);
  zoneNext.classList.toggle("is-off", atEnd || busy);
  turnHints.classList.toggle("is-busy", busy);
  turnHints.classList.toggle("is-ix-mode", ixLeft);

  updateEndActions();
}

function updateEndActions() {
  if (!actionsOpen || !btnOpen) return;
  const atEnd = isOpen && spread >= maxSpread();

  if (atEnd) {
    actionsOpen.style.display = "";
    actionsOpen.classList.remove("is-hide");
    actionsOpen.classList.add("is-visible-reading");
    btnOpen.textContent = "Close & reopen book ♡";
    btnOpen.disabled = busy;
  } else if (isOpen) {
    actionsOpen.style.display = "none";
    actionsOpen.classList.remove("is-visible-reading");
    actionsOpen.classList.add("is-hide");
  }
}

function resetBookState() {
  spread = 0;
  herResponse.accepted = false;
  herResponse.smile = "";
  herResponse.note = "";
  hideFlipper();
}

function hideFlipper() {
  if (!flipper) return;
  flipper.classList.remove("is-right", "is-left", "is-flipping");
  flipper.classList.add("is-idle");
  flipper.style.removeProperty("transform");
  flipper.style.removeProperty("visibility");
  flipper.style.removeProperty("opacity");
  setLayer(flipFront, "");
  setLayer(flipBack, "");
}

function prepFlip(side) {
  flipper.classList.remove("is-idle", "is-flipping", "is-right", "is-left");
  flipper.style.removeProperty("transform");
  flipper.classList.add(side === "right" ? "is-right" : "is-left");
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

function waitFlip(ms) {
  return new Promise((resolve) => {
    if (!flipper) return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      flipper.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
      resolve();
    };
    const onEnd = (e) => {
      if (e.target === flipper && e.propertyName === "transform") finish();
    };
    flipper.addEventListener("transitionend", onEnd);
    const timer = setTimeout(finish, ms + 100);
  });
}

async function turnPage(dir) {
  if (!isOpen || busy) return;

  const next = spread + dir * 2;
  if (next < 0 || next > maxSpread()) return;

  busy = true;
  bookOpen.classList.add("is-turning");
  updateTurnHints();

  try {
    if (dir > 0) {
      setLayer(underLeft, renderPage(PAGES[spread], "left"));
      setLayer(underRight, renderPage(PAGES[next + 1], "right"));
      setLayer(layerLeft, renderPage(PAGES[spread], "left"));
      setLayer(layerRight, "");
      setLayer(flipFront, renderPage(PAGES[spread + 1], "right"));
      setLayer(flipBack, blankPaper("left"));

      prepFlip("right");
      await nextFrame();
      flipper.classList.add("is-flipping");
      await waitFlip(TURN_MS);
    } else {
      setLayer(underLeft, renderPage(PAGES[next], "left"));
      setLayer(underRight, renderPage(PAGES[spread + 1], "right"));
      setLayer(layerLeft, "");
      setLayer(layerRight, renderPage(PAGES[spread + 1], "right"));
      setLayer(flipFront, renderPage(PAGES[spread], "left"));
      setLayer(flipBack, blankPaper("right"));

      prepFlip("left");
      await nextFrame();
      flipper.classList.add("is-flipping");
      await waitFlip(TURN_MS);
    }

    spread = next;
    flipper.classList.remove("is-flipping");
    await nextFrame();
  } catch (err) {
    console.error("Page turn error:", err);
  } finally {
    bookOpen.classList.remove("is-turning");
    paintSpread();
    busy = false;
    updateTurnHints();
  }
}

function goForward() { turnPage(1); }
function goBack() { turnPage(-1); }

function buildResponseText(data) {
  const smileLabels = { yes: "Yes 😊", little: "A little 🙂", notyet: "Not yet 🌙" };
  const now = new Date();
  const lines = [
    "========================================",
    "  BOOK RESPONSE — For You",
    "========================================",
    `Saved at : ${now.toISOString()}`,
    "----------------------------------------",
    `Accepted apology: ${data.accepted ? "YES ♡" : "No"}`,
  ];
  if (data.smile) lines.push(`Smile: ${smileLabels[data.smile] || data.smile}`);
  if (data.note) lines.push("", "Her note:", data.note);
  lines.push("========================================");
  return lines.join("\n") + "\n";
}

async function saveResponse(data) {
  const res = await fetch(SAVE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: data }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "Could not save");
  return json;
}

function bindInteractive() {
  const panel = document.querySelector("[data-ix]");
  if (!panel || panel.dataset.bound) return;
  panel.dataset.bound = "1";

  panel.addEventListener("click", (e) => e.stopPropagation());
  panel.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
  panel.addEventListener("touchend", (e) => e.stopPropagation(), { passive: true });

  panel.querySelector("[data-act=accept]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    herResponse.accepted = true;
    e.currentTarget.textContent = "Accepted ♡";
    e.currentTarget.classList.add("ix-btn--done");
  });

  panel.querySelectorAll("[data-smile]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.querySelectorAll(".ix-smile").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      herResponse.smile = btn.dataset.smile;
    });
  });

  panel.querySelector("[data-act=send]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const msg = document.getElementById("ix-msg");
    const noteEl = document.getElementById("ix-note");
    herResponse.note = noteEl?.value.trim() || "";

    if (!herResponse.accepted && !herResponse.smile && !herResponse.note) {
      msg.hidden = false;
      msg.className = "ix-msg ix-msg--err";
      msg.textContent = "Tap accept, pick a smile, or write a note first.";
      return;
    }

    const sendBtn = e.currentTarget;
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";

    try {
      await saveResponse({ ...herResponse });
      msg.hidden = false;
      msg.className = "ix-msg ix-msg--ok";
      msg.textContent = "Thank you… closing the book with love. ♡";
      setTimeout(closeBook, 2200);
    } catch (err) {
      msg.hidden = false;
      msg.className = "ix-msg ix-msg--err";
      msg.textContent = err.message || "Could not save. On Vercel: add Blob storage in project Settings → Storage.";
      sendBtn.disabled = false;
      sendBtn.textContent = "Send my response ♡";
    }
  });
}

function openBook() {
  if (isOpen || busy) return;
  busy = true;
  btnOpen.disabled = true;

  bookClosed.classList.add("is-hide");
  actionsOpen.classList.add("is-hide");

  setTimeout(() => {
    actionsOpen.style.display = "none";
    bookClosed.style.display = "none";
    bookOpen.removeAttribute("hidden");
    footer.classList.add("is-visible");
    musicBtn.removeAttribute("hidden");

    book.classList.replace("book--closed", "book--open");
    document.getElementById("app")?.classList.add("app--reading");
    readingBar?.removeAttribute("hidden");
    readingBar?.setAttribute("aria-hidden", "false");
    isOpen = true;
    resetBookState();
    paintSpread();
    startMusic();
    busy = false;
  }, 400);
}

function closeBook() {
  if (!isOpen || busy) return;
  busy = true;

  if (bgm) {
    bgm.pause();
    bgm.currentTime = 0;
  }

  bookOpen.classList.add("is-hide");

  setTimeout(() => {
    bookOpen.setAttribute("hidden", "");
    bookOpen.classList.remove("is-hide");
    bookClosed.style.display = "";
    bookClosed.classList.remove("is-hide");
    actionsOpen.style.display = "";
    actionsOpen.classList.remove("is-hide");
    btnOpen.disabled = false;

    book.classList.replace("book--open", "book--closed");
    document.getElementById("app")?.classList.remove("app--reading");
    readingBar?.setAttribute("hidden", "");
    readingBar?.setAttribute("aria-hidden", "true");
    isOpen = false;
    resetBookState();
    btnOpen.textContent = "Open the book ♡";
    busy = false;
  }, 500);
}

function startMusic() {
  if (!bgm || !musicOn) return;
  bgm.volume = 0.28;
  bgm.play().catch(() => { musicIcon.textContent = "🔇"; });
}

function setupInstagramLinks() {
  const footerIg = document.getElementById("footer-ig");
  if (footerIg) {
    footerIg.href = igUrl();
    footerIg.textContent = `@${SNOWY_IG}`;
  }
}

function init() {
  book = document.getElementById("book");
  bookClosed = document.getElementById("book-closed");
  bookOpen = document.getElementById("book-open");
  actionsOpen = document.getElementById("actions-open");
  footer = document.getElementById("footer");
  btnOpen = document.getElementById("btn-open");
  zonePrev = document.getElementById("zone-prev");
  zoneNext = document.getElementById("zone-next");
  turnHints = document.getElementById("turn-hints");
  readingBar = document.getElementById("reading-bar");
  layerLeft = document.getElementById("layer-left");
  layerRight = document.getElementById("layer-right");
  underLeft = document.getElementById("under-left");
  underRight = document.getElementById("under-right");
  flipper = document.getElementById("flipper");
  flipFront = document.getElementById("flip-front");
  flipBack = document.getElementById("flip-back");
  bgm = document.getElementById("bgm");
  musicBtn = document.getElementById("music-btn");
  musicIcon = document.getElementById("music-icon");

  setupInstagramLinks();

  musicBtn.addEventListener("click", () => {
    musicOn = !musicOn;
    if (musicOn) { bgm.play(); bgm.volume = 0.28; musicIcon.textContent = "🎵"; }
    else { bgm.pause(); musicIcon.textContent = "🔇"; }
  });

  btnOpen.addEventListener("click", () => {
    if (isOpen && spread >= maxSpread()) closeBook();
    else openBook();
  });

  zonePrev?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    goBack();
  });

  zoneNext?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    goForward();
  });

  function handleBookTap(clientX) {
    if (busy || !isOpen || isInteractiveSpread()) return;
    const rect = bookOpen.getBoundingClientRect();
    const x = clientX - rect.left;
    const leftHalf = x <= rect.width / 2;
    if (leftHalf && isInteractiveLeft()) return;
    if (!leftHalf && x > rect.width / 2 && spread < maxSpread()) goForward();
    else if (leftHalf && spread > 0 && !isInteractiveLeft()) goBack();
  }

  bookOpen.addEventListener("click", (e) => {
    if (busy || !isOpen) return;
    if (e.target.closest("[data-ix]") || e.target.closest("a") || e.target.closest("button")) return;
    if (e.target.closest(".turn-zone")) return;
    handleBookTap(e.clientX);
  });

  let touchY = 0;
  let touchMoved = false;

  bookOpen.addEventListener("touchstart", (e) => {
    if (e.target.closest("[data-ix]") || e.target.closest("a") || e.target.closest("button")) return;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
    touchMoved = false;
  }, { passive: true });

  bookOpen.addEventListener("touchmove", (e) => {
    const dx = Math.abs(e.touches[0].clientX - touchX);
    const dy = Math.abs(e.touches[0].clientY - touchY);
    if (dx > 8 || dy > 8) touchMoved = true;
  }, { passive: true });

  bookOpen.addEventListener("touchend", (e) => {
    if (!isOpen || busy) return;
    if (e.target.closest("[data-ix]") || e.target.closest("a") || e.target.closest("button")) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchX;

    if (e.target.closest(".turn-zone")) {
      if (!touchMoved) {
        if (e.target.closest("#zone-next")) goForward();
        else if (e.target.closest("#zone-prev")) goBack();
      }
      return;
    }

    if (isInteractiveSpread()) return;

    if (Math.abs(dx) >= 50) {
      if (dx < 0) goForward();
      else goBack();
    } else if (!touchMoved) {
      handleBookTap(touch.clientX);
    }
  }, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (!isOpen || busy) return;
    if (e.key === "ArrowRight") goForward();
    if (e.key === "ArrowLeft") goBack();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
