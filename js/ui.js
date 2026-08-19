// ============================================================
//  ui.js — tiny DOM + formatting helpers
// ============================================================

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function initialOf(name = "?") {
  const n = String(name).trim();
  return (n ? n[0] : "?").toUpperCase();
}

const PALETTE = ["#e5544b", "#3f7fd4", "#4aa06b", "#8a6bd1", "#ef9540", "#d2517f", "#3aa3a3"];
export function colorFor(id = "") {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/* ---------- money ---------- */
export const money = n =>
  (n < 0 ? "-" : "") + "$" + Math.abs(Number(n) || 0).toFixed(2);

export const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

/* ---------- dates ---------- */
export const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

export function parseISO(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function daysBetween(isoA, isoB) {
  return Math.round((parseISO(isoB) - parseISO(isoA)) / 86400000);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
export const monthShort = iso => MONTHS[parseISO(iso).getMonth()];
export const dayNum     = iso => parseISO(iso).getDate();

export function friendlyDate(iso) {
  if (!iso) return "";
  const diff = daysBetween(todayISO(), iso);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 1 && diff < 7) return parseISO(iso).toLocaleDateString(undefined, { weekday: "long" });
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return parseISO(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function friendlyTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${ampm}` : `${hh}${ampm}`;
}

export function relTime(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ---------- toast ---------- */
export function toast(msg, ms = 2200) {
  const wrap = $("#toast-wrap");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 320);
  }, ms);
}

/* ---------- modal ---------- */
let onCloseCb = null;

export function openModal(html, { onMount, onClose } = {}) {
  const back = $("#modal-backdrop");
  const body = $("#modal-body");
  body.innerHTML = html;
  back.hidden = false;
  onCloseCb = onClose || null;
  document.body.style.overflow = "hidden";
  onMount?.(body);
  const first = body.querySelector("input, textarea, select");
  if (first && window.matchMedia("(min-width:760px)").matches) first.focus();
}

export function closeModal() {
  const back = $("#modal-backdrop");
  if (back.hidden) return;
  back.hidden = true;
  $("#modal-body").innerHTML = "";
  document.body.style.overflow = "";
  const cb = onCloseCb; onCloseCb = null;
  cb?.();
}

export function confirmSketch(question, { danger = true, okLabel = "Yep" } = {}) {
  return new Promise(resolve => {
    openModal(`
      <h3>${esc(question)}</h3>
      <div class="modal-actions">
        <button class="btn" data-x="no">Never mind</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-x="yes">${esc(okLabel)}</button>
      </div>`, {
      onMount(body) {
        body.querySelector('[data-x="no"]').onclick = () => { closeModal(); resolve(false); };
        body.querySelector('[data-x="yes"]').onclick = () => { closeModal(); resolve(true); };
      },
      onClose() { resolve(false); }
    });
  });
}

/* ---------- empty state ---------- */
export const emptyState = (doodle, line, hint = "") => `
  <div class="empty">
    <span class="doodle">${doodle}</span>
    <p class="scrawl">${esc(line)}</p>
    ${hint ? `<p class="tiny-note">${esc(hint)}</p>` : ""}
  </div>`;
