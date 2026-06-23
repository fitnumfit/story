const CONTENT_URL = "content.json";
const TRACK_API = "/api/track";
const TURN_MS = 1000;
const SESSION_KEY = "bookSession";
const LINK_TRACKED_KEY = "bookLinkTracked";
const BOOK_SCALE_KEY = "bookScale";
const BOOK_SCALE_MIN = 0.85;
const BOOK_SCALE_MAX = 1.4;
const BOOK_SCALE_STEP = 0.1;

let CONTENT = null;
let CHAPTERS = [];
let PAGES = [];
function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function pageMeta() {
  const left = PAGES[spread];
  const right = PAGES[spread + 1];
  const page = left || right;
  return {
    spread,
    pageType: page?.type || "unknown",
    pageTitle: page?.title || (page?.number ? `Chapter ${page.number}` : ""),
  };
}

async function trackEvent(event, data = {}) {
  try {
    const res = await fetch(TRACK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        sessionId: getSessionId(),
        clientTime: new Date().toISOString(),
        timeZone: getTimeZone(),
        data,
        meta: {
          referrer: document.referrer || "direct",
          userAgent: navigator.userAgent,
          ...pageMeta(),
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || "Could not save");
    return json;
  } catch (err) {
    console.warn("Track failed:", err);
    throw err;
  }
}

function trackLinkOpenedOnce() {
  if (sessionStorage.getItem(LINK_TRACKED_KEY)) return;
  sessionStorage.setItem(LINK_TRACKED_KEY, "1");
  trackEvent("link_opened").catch(() => {});
}

function igHandle() {
  return CONTENT?.site?.instagram || "snowy";
}

function igUrl() {
  return `https://www.instagram.com/${igHandle()}`;
}

function snowyLink() {
  return `<a class="pg__ig" href="${igUrl()}" target="_blank" rel="noopener noreferrer">@${igHandle()}</a>`;
}

function turnHintHtml() {
  return `<p class="pg__turn-hint">${CONTENT?.ui?.turnHint || "Click to turn page"}</p>`;
}

function buildPages() {
  const pages = [{ type: "intro", ...CONTENT.intro }];
  CHAPTERS.forEach((ch, i) => {
    const n = i + 1;
    pages.push({ type: "chapter-start", number: n, title: ch.title });
    pages.push({ type: "chapter-story", number: n, image: ch.image, story: ch.story });
  });
  pages.push({ type: "finale", ...CONTENT.finale });
  pages.push({ type: "interactive" });
  pages.push({ type: "story-continue" });
  return pages;
}

async function loadContent() {
  const res = await fetch(CONTENT_URL);
  if (!res.ok) throw new Error(`Could not load ${CONTENT_URL}`);
  CONTENT = await res.json();
  CHAPTERS = CONTENT.chapters || [];
  PAGES = buildPages();
}

function applyContentToPage() {
  const { site, hero, cover, readingBar, buttons, footer } = CONTENT;

  if (site?.title) document.title = site.title;
  if (site?.description) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = site.description;
  }

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el && text != null) el.textContent = text;
  };

  setText("hero-greeting", hero?.greeting);
  setText("hero-message", hero?.message);
  setText("hero-hint", hero?.hint);
  setText("cover-icon", cover?.icon);
  setText("cover-title", cover?.title);
  setText("cover-sub", cover?.subtitle);
  setText("reading-bar-hi", readingBar?.greeting);
  setText("btn-open", buttons?.openBook);
  setText("footer-text", footer?.text);

  const footerIg = document.getElementById("footer-ig");
  if (footerIg) footerIg.textContent = `@${igHandle()}`;
}
let book, bookClosed, bookOpen, actionsOpen, footer, bookStage;
let btnOpen, zonePrev, zoneNext, turnHints, readingBar;
let btnSizeDown, btnSizeUp, bookSizeLabel;
let layerLeft, layerRight, underLeft, underRight;
let flipper, flipFront, flipBack;
let bgm, musicBtn, musicIcon;

let isOpen = false;
let spread = 0;
let busy = false;
let touchX = 0;
let musicOn = true;
let bookScale = 1;
let layoutRaf = 0;

function readStoredBookScale() {
  const stored = parseFloat(sessionStorage.getItem(BOOK_SCALE_KEY));
  if (!Number.isFinite(stored)) return 1;
  return Math.min(BOOK_SCALE_MAX, Math.max(BOOK_SCALE_MIN, stored));
}

function persistBookScale() {
  sessionStorage.setItem(BOOK_SCALE_KEY, String(bookScale));
}

function updateBookScaleControls() {
  if (!btnSizeDown || !btnSizeUp || !bookSizeLabel) return;
  const pct = Math.round(bookScale * 100);
  bookSizeLabel.textContent = `${pct}%`;
  btnSizeDown.disabled = bookScale <= BOOK_SCALE_MIN + 0.001;
  btnSizeUp.disabled = bookScale >= BOOK_SCALE_MAX - 0.001;
}

function effectiveBookScale() {
  if (window.matchMedia("(max-width: 640px)").matches) return 1;
  return bookScale;
}

function applyBookScale() {
  updateBookScaleControls();
  syncBookLayout();
}

function changeBookScale(delta) {
  const next = Math.round((bookScale + delta) * 10) / 10;
  if (next < BOOK_SCALE_MIN || next > BOOK_SCALE_MAX) return;
  bookScale = next;
  persistBookScale();
  applyBookScale();
}

function measureBookChrome() {
  const app = document.getElementById("app");
  if (!app) return;

  const styles = getComputedStyle(app);
  const padTop = parseFloat(styles.paddingTop) || 0;
  const padBottom = parseFloat(styles.paddingBottom) || 0;
  const gap = parseFloat(styles.gap) || 0;
  let chrome = padTop + padBottom + gap;

  if (readingBar && !readingBar.hidden) {
    chrome += readingBar.offsetHeight + gap;
  }
  if (actionsOpen && actionsOpen.style.display !== "none" && !actionsOpen.classList.contains("is-hide")) {
    chrome += actionsOpen.offsetHeight + gap;
  }
  if (footer) {
    chrome += footer.offsetHeight;
  }

  const viewportH = window.visualViewport?.height ?? window.innerHeight;
  const maxBookH = Math.max(220, viewportH - chrome - 8);
  document.documentElement.style.setProperty("--book-chrome", `${Math.ceil(chrome)}px`);
  document.documentElement.style.setProperty("--spread-h-max", `${Math.floor(maxBookH)}px`);
}

function syncBookLayout() {
  document.documentElement.style.setProperty("--book-scale", String(effectiveBookScale()));
  measureBookChrome();
  requestAnimationFrame(() => requestAnimationFrame(markScrollablePages));
}

function scheduleBookLayout() {
  cancelAnimationFrame(layoutRaf);
  layoutRaf = requestAnimationFrame(syncBookLayout);
}

const herResponse = { accepted: false, smile: "", note: "" };

function showTurnHint(page, side) {
  if (side === "right") return turnHintHtml();
  if (page.type === "chapter-story" && page.number === CHAPTERS.length) return turnHintHtml();
  return "";
}
function blankPaper(side) {
  return `<div class="pg pg--paper-back pg--${side}"></div>`;
}

function pageShell(inner, side, mod = "") {
  return `<div class="pg ${mod} pg--${side}"><div class="pg__inner">${inner}</div></div>`;
}

function renderPage(page, side) {
  if (!page) return `<div class="pg pg--blank pg--${side}"></div>`;

  switch (page.type) {
    case "intro":
      return pageShell(
        `<span class="pg__ico">☮</span><h2 class="pg__title">${page.title}</h2><p class="pg__text">${page.body}</p>`,
        side,
        "pg--intro"
      );
    case "chapter-start":
      return `<div class="pg pg--ch-start pg--${side}">
        <div class="pg__inner">
          <p class="pg__ch">Chapter ${page.number}</p>
          <h2 class="pg__title">${page.title}</h2>
          <span class="pg__heart">♡</span>
        </div>
        ${showTurnHint(page, side)}
      </div>`;
    case "chapter-story":
      return `<div class="pg pg--ch-story pg--${side}">
        <div class="pg__inner">
          <div class="pg__img-frame"><img class="pg__img" src="${page.image}" alt="Chapter ${page.number}" loading="lazy" /></div>
          <p class="pg__text">${page.story}</p>
        </div>
        ${showTurnHint(page, side)}
      </div>`;
    case "finale":
      return `<div class="pg pg--finale pg--${side}">
        <div class="pg__inner">
          <span class="pg__ico">☮</span>
          <h2 class="pg__title">${page.title}</h2>
          <p class="pg__text">${page.body}</p>
          <p class="pg__sign">${page.signature || "Always,"} ${snowyLink()}</p>
        </div>
        ${side === "right" ? turnHintHtml() : ""}
      </div>`;
    case "interactive": {
      const ix = CONTENT.interactive;
      return `<div class="pg pg--ix pg--${side}" data-ix="1">
        <div class="pg__inner">
          <p class="pg__ch">${ix.label}</p>
          <h2 class="pg__title">${ix.title}</h2>
          <div class="ix-block">
            <button type="button" class="ix-btn ix-btn--accept" data-act="accept">${ix.acceptButton}</button>
          </div>
          <div class="ix-block">
            <p class="ix-lbl">${ix.smileQuestion}</p>
            <div class="ix-smiles">
              <button type="button" class="ix-smile" data-smile="yes">${ix.smiles.yes}</button>
              <button type="button" class="ix-smile" data-smile="little">${ix.smiles.little}</button>
              <button type="button" class="ix-smile" data-smile="notyet">${ix.smiles.notyet}</button>
            </div>
          </div>
          <div class="ix-block">
            <label class="ix-lbl" for="ix-note">${ix.noteLabel} <em>${ix.noteOptional}</em></label>
            <textarea id="ix-note" class="ix-note" rows="3" placeholder="${ix.notePlaceholder}"></textarea>
          </div>
          <div class="ix-block">
            <p class="ix-msg" id="ix-msg" hidden></p>
          </div>
          <p class="ix-foot">${ix.footnote}</p>
        </div>
      </div>`;
    }
    case "story-continue": {
      const sc = CONTENT.storyContinue;
      return pageShell(
        `<span class="pg__heart">♡</span><h2 class="pg__title">${sc.title}</h2><p class="pg__text">${sc.body}</p><p class="pg__sign">${sc.signature || "Always,"} ${snowyLink()}</p>`,
        side,
        "pg--continue"
      );
    }
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
  scheduleBookLayout();
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
    btnOpen.textContent = CONTENT?.buttons?.closeBook || "Close & reopen book ♡";
    btnOpen.disabled = busy;
  } else if (isOpen) {
    actionsOpen.style.display = "none";
    actionsOpen.classList.remove("is-visible-reading");
    actionsOpen.classList.add("is-hide");
  }
  scheduleBookLayout();
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
    trackEvent("page_turn", pageMeta()).catch(() => {});
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

let responseSaving = false;
let noteSaveTimer = null;

async function submitAnswer(event, data, { closeOnSuccess = false } = {}) {
  const msg = document.getElementById("ix-msg");
  if (responseSaving) return;

  responseSaving = true;
  const ui = CONTENT?.ui || {};
  if (msg) {
    msg.hidden = false;
    msg.className = "ix-msg";
    msg.textContent = ui.saving || "Saving…";
  }

  try {
    const result = await trackEvent(event, data);
    const savedAt = result.time?.display || "just now";
    if (msg) {
      msg.className = "ix-msg ix-msg--ok";
      const tpl = closeOnSuccess
        ? (ui.thankYouClose || "Thank you… saved at {time}. Closing with love ♡")
        : (ui.saved || "Saved at {time} ♡");
      msg.textContent = tpl.replace("{time}", savedAt);
    }
    if (closeOnSuccess) setTimeout(closeBook, 2200);
  } catch (err) {
    if (msg) {
      msg.hidden = false;
      msg.className = "ix-msg ix-msg--err";
      msg.textContent = err.message || ui.saveError || "Could not save.";
    }
  } finally {
    responseSaving = false;
  }
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
    e.currentTarget.textContent = CONTENT?.interactive?.acceptDone || "Accepted ♡";
    e.currentTarget.classList.add("ix-btn--done");
    submitAnswer("accept_apology", { accepted: true });
  });

  panel.querySelectorAll("[data-smile]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.querySelectorAll(".ix-smile").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      herResponse.smile = btn.dataset.smile;
      submitAnswer("smile", { value: btn.dataset.smile }, { closeOnSuccess: true });
    });
  });

  const noteEl = panel.querySelector("#ix-note");
  noteEl?.addEventListener("input", () => {
    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(() => {
      const text = noteEl.value.trim();
      if (!text) return;
      herResponse.note = text;
      submitAnswer("note", { text });
    }, 1200);
  });
  noteEl?.addEventListener("blur", () => {
    clearTimeout(noteSaveTimer);
    const text = noteEl.value.trim();
    if (!text) return;
    herResponse.note = text;
    submitAnswer("note", { text });
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
    trackEvent("book_opened").catch(() => {});
    busy = false;
    scheduleBookLayout();
  }, 400);
}

function closeBook() {
  if (!isOpen || busy) return;
  busy = true;
  trackEvent("book_closed").catch(() => {});

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
    btnOpen.textContent = CONTENT?.buttons?.openBook || "Open the book ♡";
    busy = false;
    scheduleBookLayout();
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
    footerIg.textContent = `@${igHandle()}`;
    footerIg.addEventListener("click", () => {
      trackEvent("instagram_click", { url: igUrl() }).catch(() => {});
    });
  }

  document.addEventListener("click", (e) => {
    const ig = e.target.closest(".pg__ig");
    if (ig?.href) trackEvent("instagram_click", { url: ig.href }).catch(() => {});
  });
}

function isScrollablePage(el) {
  const pg = el?.closest?.(".pg");
  if (!pg) return false;
  return pg.scrollHeight > pg.clientHeight + 4;
}

function markScrollablePages() {
  document.querySelectorAll(".pg").forEach((pg) => {
    pg.classList.toggle("pg--overflow", pg.scrollHeight > pg.clientHeight + 4);
  });
}

function init() {
  book = document.getElementById("book");
  bookClosed = document.getElementById("book-closed");
  bookOpen = document.getElementById("book-open");
  bookStage = document.getElementById("book-stage");
  actionsOpen = document.getElementById("actions-open");
  footer = document.getElementById("footer");
  btnOpen = document.getElementById("btn-open");
  zonePrev = document.getElementById("zone-prev");
  zoneNext = document.getElementById("zone-next");
  turnHints = document.getElementById("turn-hints");
  readingBar = document.getElementById("reading-bar");
  btnSizeDown = document.getElementById("btn-size-down");
  btnSizeUp = document.getElementById("btn-size-up");
  bookSizeLabel = document.getElementById("book-size-label");
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
  trackLinkOpenedOnce();

  bookScale = readStoredBookScale();
  applyBookScale();
  window.addEventListener("resize", scheduleBookLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleBookLayout, { passive: true });

  btnSizeDown?.addEventListener("click", () => changeBookScale(-BOOK_SCALE_STEP));
  btnSizeUp?.addEventListener("click", () => changeBookScale(BOOK_SCALE_STEP));

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
    if (isScrollablePage(e.target) && dy > dx) {
      e.stopPropagation();
    }
  }, { passive: true });

  bookOpen.addEventListener("touchend", (e) => {
    if (!isOpen || busy) return;
    if (e.target.closest("[data-ix]") || e.target.closest("a") || e.target.closest("button")) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchX;
    const dy = touch.clientY - touchY;

    if (isScrollablePage(e.target) && (touchMoved || Math.abs(dy) > Math.abs(dx))) return;

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
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}

async function bootstrap() {
  try {
    await loadContent();
    applyContentToPage();
    init();
  } catch (err) {
    console.error(err);
    const hero = document.getElementById("hero");
    if (hero) {
      hero.insertAdjacentHTML("beforeend", `<p class="hero__hint" style="color:#ffb4b4">Could not load content.json — check the file exists.</p>`);
    }
  }
}
