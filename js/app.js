// ============================================================
//  app.js — boot, screens, tab router
// ============================================================

import * as store from "./store.js";
import { state } from "./store.js";
import { $, $$, esc, toast, initialOf, closeModal } from "./ui.js";
import * as listView   from "./views/list.js";
import * as eventsView from "./views/events.js";
import * as moneyView  from "./views/money.js";
import * as choresView from "./views/chores.js";
import { openHouseSheet, openMeSheet } from "./views/house.js";

const VIEWS = { list: listView, events: eventsView, money: moneyView, chores: choresView };
let current = localStorage.getItem("casa.tab") || "list";

/* ---------- screen switching ---------- */
function show(which) {
  $("#boot").hidden        = which !== "boot";
  $("#screen-auth").hidden = which !== "auth";
  $("#screen-house").hidden = which !== "house";
  $("#app").hidden         = which !== "app";
}

/* ---------- render ---------- */
function renderAll() {
  if (!state.ready) return show("boot");
  if (!state.user)  return show("auth");
  if (!state.houseId || !state.house) return show("house");

  show("app");
  $("#house-title").textContent = state.house.name || "house";
  $("#me-initial").textContent = initialOf(state.user.name);

  $$("#tabs .tab").forEach(t => t.classList.toggle("is-active", t.dataset.view === current));
  for (const [key, mod] of Object.entries(VIEWS)) {
    const el = $(`#badge-${key}`);
    if (el) el.hidden = !(mod.badge?.() ?? false);
  }

  try {
    VIEWS[current].render($("#main"));
  } catch (err) {
    console.error(err);
    $("#main").innerHTML = `<div class="empty"><span class="doodle">😵</span><p class="scrawl">Something went sideways rendering this tab.</p></div>`;
  }
}

/* ---------- wiring ---------- */
function wire() {
  $$("#tabs .tab").forEach(t => {
    t.onclick = () => {
      current = t.dataset.view;
      localStorage.setItem("casa.tab", current);
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });

  $("#fab").onclick = () => VIEWS[current].onAdd();
  $("#house-chip").onclick = openHouseSheet;
  $("#me-btn").onclick = openMeSheet;

  $("#modal-x").onclick = closeModal;
  $("#modal-backdrop").onclick = e => { if (e.target.id === "modal-backdrop") closeModal(); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  // sign-in screen
  $("#btn-google").onclick = async () => {
    try { await store.signInGoogle(); }
    catch (e) { console.error(e); $("#auth-note").textContent = e.message || "Sign-in failed."; }
  };
  $("#btn-guest").onclick = async () => {
    const name = prompt("What should roommates call you?", "Me");
    if (name === null) return;
    try { await store.signInGuest(name.trim() || "Me"); }
    catch (e) { console.error(e); $("#auth-note").textContent = e.message || "Sign-in failed."; }
  };

  // house screen
  $("#btn-create-house").onclick = async () => {
    const name = $("#house-name").value.trim() || "Our place";
    $("#house-note").textContent = "making a key…";
    try { await store.createHouse(name); }
    catch (e) { $("#house-note").textContent = e.message; }
  };
  $("#btn-join-house").onclick = async () => {
    const code = $("#house-code").value.trim().toUpperCase();
    if (!code) return ($("#house-note").textContent = "Type the 6-character code.");
    $("#house-note").textContent = "knocking…";
    try { await store.joinHouse(code); }
    catch (e) { $("#house-note").textContent = e.message; }
  };
  $("#house-code").addEventListener("keydown", e => { if (e.key === "Enter") $("#btn-join-house").click(); });
  $("#house-name").addEventListener("keydown", e => { if (e.key === "Enter") $("#btn-create-house").click(); });
}

/* ---------- go ---------- */
(async function main() {
  wire();
  store.subscribe(renderAll);

  // invite links: index.html#join=ABC123
  const m = location.hash.match(/join=([A-Z0-9]{4,8})/i);
  if (m) {
    $("#house-code").value = m[1].toUpperCase();
    history.replaceState(null, "", location.pathname);
  }

  await store.boot(() => {
    if (state.mode === "demo") {
      $("#auth-note").textContent = "Demo mode — data stays in this browser until Firebase is configured.";
    }
  });

  renderAll();
  setTimeout(renderAll, 400); // catch the first Firestore snapshots
})();
