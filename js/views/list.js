// ============================================================
//  views/list.js — the shared shopping list
// ============================================================

import { state, add, update, remove, isMe, nameOf } from "../store.js";
import { esc, toast, emptyState, relTime, openModal, closeModal, confirmSketch } from "../ui.js";
import { expenseForm } from "./money.js";

export const title = "Shopping list";

export function render(mount) {
  const open = state.items.filter(i => !i.done).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const done = state.items.filter(i => i.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  mount.innerHTML = `
    <div class="section-head">
      <h2 class="hand-title">We need…</h2>
      <span class="tiny-note">${open.length} thing${open.length === 1 ? "" : "s"}</span>
    </div>

    <div class="quick-add">
      <label class="field" style="flex:1">
        <input id="qa" class="scribble-input" placeholder="add something…" maxlength="60" autocomplete="off" />
      </label>
      <button class="btn btn-primary btn-sm" id="qa-go">Add</button>
    </div>

    <div class="rows" id="open-rows" style="margin-top:18px">
      ${open.length ? open.map(itemRow).join("") : emptyState("🧺", "Nothing on the list.", "Whoever notices, adds it.")}
    </div>

    ${done.length ? `
      <div class="divider-doodle"></div>
      <div class="section-head">
        <h3 style="margin:0">Got it ✓</h3>
        <button class="btn btn-sm btn-ghost" id="clear-done">clear ${done.length}</button>
      </div>
      <div class="rows">${done.slice(0, 12).map(itemRow).join("")}</div>` : ""}
  `;

  const qa = mount.querySelector("#qa");
  const go = () => {
    const text = qa.value.trim();
    if (!text) return;
    quickAdd(text);
    qa.value = "";
    qa.focus();
  };
  mount.querySelector("#qa-go").onclick = go;
  qa.onkeydown = e => { if (e.key === "Enter") go(); };

  mount.querySelector("#clear-done")?.addEventListener("click", async () => {
    if (await confirmSketch(`Clear ${done.length} bought item${done.length === 1 ? "" : "s"}?`, { okLabel: "Clear" })) {
      for (const i of done) await remove("items", i.id);
      toast("Tidied up ✏️");
    }
  });

  mount.querySelectorAll("[data-act]").forEach(btn => {
    btn.onclick = () => handle(btn.dataset.act, btn.dataset.id);
  });
}

/* ---------- a single row ---------- */
function itemRow(i) {
  const claimed = i.claimedBy && !i.done;
  return `
  <div class="row-card">
    <button class="check" data-act="toggle" data-id="${i.id}"
            role="checkbox" aria-checked="${i.done ? "true" : "false"}"
            aria-label="mark ${esc(i.text)} bought"></button>
    <div class="row-main">
      <div class="row-title ${i.done ? "strike" : ""}">
        ${esc(i.text)} ${i.qty ? `<span class="qty">×${esc(i.qty)}</span>` : ""}
      </div>
      <div class="row-sub">
        <span>${i.done ? `bought ${relTime(i.doneAt)}` : `${esc(i.addedByName || nameOf(i.addedBy))} · ${relTime(i.createdAt)}`}</span>
        ${claimed ? `<span class="chip purple">${isMe(i.claimedBy) ? "you're grabbing it" : esc(nameOf(i.claimedBy)) + " is grabbing it"}</span>` : ""}
      </div>
    </div>
    <div class="row-actions">
      ${i.done ? "" : `<button class="icon-btn" data-act="claim" data-id="${i.id}" title="I'll grab it">${claimed && isMe(i.claimedBy) ? "🙋" : "🛒"}</button>`}
      ${i.done ? "" : `<button class="icon-btn" data-act="cost" data-id="${i.id}" title="Log what it cost">💸</button>`}
      <button class="icon-btn" data-act="del" data-id="${i.id}" title="Remove">✕</button>
    </div>
  </div>`;
}

/* ---------- actions ---------- */
async function handle(act, id) {
  const item = state.items.find(x => x.id === id);
  if (!item) return;

  if (act === "toggle") {
    await update("items", id, { done: !item.done, doneAt: item.done ? null : Date.now() });
    if (!item.done) toast("✓ got it");
  }

  if (act === "claim") {
    const mine = isMe(item.claimedBy);
    await update("items", id, {
      claimedBy: mine ? null : state.user.uid,
      claimedByName: mine ? null : state.user.name
    });
    toast(mine ? "unclaimed" : "you're on it 🛒");
  }

  if (act === "cost") {
    expenseForm({ desc: item.text, onSaved: async () => { await update("items", id, { done: true, doneAt: Date.now() }); } });
  }

  if (act === "del") {
    if (await confirmSketch(`Take "${item.text}" off the list?`, { okLabel: "Remove" })) remove("items", id);
  }
}

async function quickAdd(text) {
  // "milk x2" / "milk 2" → qty
  let qty = "";
  const m = text.match(/\s+(?:x\s*)?(\d+(?:\s*\w+)?)$/i);
  if (m) { qty = m[1].trim(); text = text.slice(0, m.index).trim(); }
  await add("items", {
    text, qty, done: false,
    addedBy: state.user.uid, addedByName: state.user.name
  });
}

/* ---------- FAB ---------- */
export function onAdd() {
  openModal(`
    <h3>Add to the list</h3>
    <div class="stack">
      <label class="field"><span>What?</span>
        <input id="f-text" class="scribble-input" placeholder="oat milk" maxlength="60" /></label>
      <label class="field"><span>How many / how much? (optional)</span>
        <input id="f-qty" class="scribble-input" placeholder="2" maxlength="18" /></label>
      <label class="split-pill" id="f-claim" style="align-self:flex-start">🛒 I'll grab this one</label>
    </div>
    <div class="modal-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Add it</button>
    </div>`, {
    onMount(body) {
      const claim = body.querySelector("#f-claim");
      claim.onclick = () => claim.classList.toggle("on");
      body.querySelector("#f-cancel").onclick = closeModal;
      const save = async () => {
        const text = body.querySelector("#f-text").value.trim();
        if (!text) return toast("…give it a name first");
        await add("items", {
          text, qty: body.querySelector("#f-qty").value.trim(), done: false,
          addedBy: state.user.uid, addedByName: state.user.name,
          claimedBy: claim.classList.contains("on") ? state.user.uid : null,
          claimedByName: claim.classList.contains("on") ? state.user.name : null
        });
        closeModal(); toast("added ✏️");
      };
      body.querySelector("#f-save").onclick = save;
      body.querySelector("#f-text").onkeydown = e => { if (e.key === "Enter") save(); };
    }
  });
}

export const badge = () => state.items.filter(i => !i.done).length > 0;
