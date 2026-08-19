// ============================================================
//  views/chores.js — rotating chores
// ============================================================

import { state, add, update, remove, members, nameOf, isMe } from "../store.js";
import {
  esc, toast, emptyState, openModal, closeModal, confirmSketch,
  todayISO, addDays, daysBetween, friendlyDate, initialOf, colorFor
} from "../ui.js";

export const title = "Chores";

const whoseTurn = c => (c.rotation || [])[(c.turnIndex || 0) % Math.max(1, (c.rotation || []).length)];

export function render(mount) {
  const list = [...state.chores].sort((a, b) => (a.nextDue || "").localeCompare(b.nextDue || ""));
  const mineDue = list.filter(c => isMe(whoseTurn(c)) && daysBetween(todayISO(), c.nextDue) <= 0);

  mount.innerHTML = `
    <div class="section-head">
      <h2 class="hand-title">Whose turn</h2>
      <span class="tiny-note">${list.length} chore${list.length === 1 ? "" : "s"}</span>
    </div>

    ${mineDue.length ? `
      <div class="sticky pink tilt-r" style="margin-bottom:18px">
        <strong>You're up:</strong> ${mineDue.map(c => esc(c.name)).join(", ")}.
      </div>` : ""}

    <div class="rows">
      ${list.length ? list.map(choreCard).join("")
                    : emptyState("🧽", "No chores set up.", "Add one and Casa rotates it through the house.")}
    </div>
  `;

  mount.querySelectorAll("[data-act]").forEach(b => {
    b.onclick = () => handle(b.dataset.act, b.dataset.id);
  });
}

function choreCard(c) {
  const turn = whoseTurn(c);
  const diff = daysBetween(todayISO(), c.nextDue);
  const cls  = diff < 0 ? "late" : diff <= 1 ? "soon" : "";
  const when = diff < 0 ? `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} late`
             : diff === 0 ? "due today"
             : `due ${friendlyDate(c.nextDue)}`;
  return `
  <div class="row-card">
    <div class="member-dot" style="color:${colorFor(turn)}; flex:0 0 28px">${initialOf(nameOf(turn))}</div>
    <div class="row-main">
      <div class="row-title">${esc(c.name)}</div>
      <div class="row-sub">
        <span class="chore-turn">${isMe(turn) ? "your turn" : esc(nameOf(turn)) + "'s turn"}</span>
        <span class="chore-due ${cls}">${esc(when)}</span>
        <span class="muted">every ${c.cadenceDays} day${c.cadenceDays === 1 ? "" : "s"}</span>
      </div>
      ${c.lastDoneBy ? `<div class="row-sub muted">last done by ${esc(nameOf(c.lastDoneBy))} ${esc(friendlyDate(c.lastDone))}</div>` : ""}
      <div class="rsvp-row">
        <button class="btn btn-sm ${diff <= 0 ? "btn-primary" : ""}" data-act="done" data-id="${c.id}">Done ✓ (next up: ${esc(nextName(c))})</button>
      </div>
    </div>
    <div class="row-actions">
      <button class="icon-btn" data-act="edit" data-id="${c.id}" title="Edit">✎</button>
      <button class="icon-btn" data-act="del" data-id="${c.id}" title="Delete">✕</button>
    </div>
  </div>`;
}

function nextName(c) {
  const rot = c.rotation || [];
  if (!rot.length) return "—";
  return nameOf(rot[((c.turnIndex || 0) + 1) % rot.length]);
}

async function handle(act, id) {
  const c = state.chores.find(x => x.id === id);
  if (!c) return;

  if (act === "done") {
    const rot = c.rotation || [];
    await update("chores", id, {
      turnIndex: rot.length ? ((c.turnIndex || 0) + 1) % rot.length : 0,
      lastDone: todayISO(),
      lastDoneBy: whoseTurn(c),
      nextDue: addDays(todayISO(), Number(c.cadenceDays) || 7)
    });
    toast("nice one ✨");
  }

  if (act === "edit") choreForm(c);

  if (act === "del" && await confirmSketch(`Delete "${c.name}"?`, { okLabel: "Delete" })) remove("chores", id);
}

export function onAdd() { choreForm(null); }

function choreForm(existing) {
  const c = existing || {};
  const ms = members();
  const rot = c.rotation?.length ? c.rotation : ms.map(m => m.uid);

  openModal(`
    <h3>${existing ? "Edit chore" : "New chore"}</h3>
    <div class="stack">
      <label class="field"><span>What needs doing?</span>
        <input id="c-name" class="scribble-input" maxlength="50" placeholder="Take out trash" value="${esc(c.name || "")}" /></label>
      <label class="field"><span>How often? (days)</span>
        <input id="c-cad" class="scribble-input" type="number" min="1" max="90" value="${c.cadenceDays || 7}" /></label>
      <label class="field"><span>Next due</span>
        <input id="c-due" type="date" class="scribble-input" value="${esc(c.nextDue || todayISO())}" /></label>
      <div class="field"><span>Rotate between (tap to include)</span>
        <div class="split-picker" id="c-rot">
          ${ms.map(m => `<span class="split-pill ${rot.includes(m.uid) ? "on" : ""}" data-uid="${m.uid}">${esc(m.name)}</span>`).join("")}
        </div>
        <p class="tiny-note">Turn passes to the next person each time it's marked done.</p>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" id="c-cancel">Cancel</button>
      <button class="btn btn-primary" id="c-save">${existing ? "Save" : "Add chore"}</button>
    </div>`, {
    onMount(body) {
      body.querySelectorAll(".split-pill").forEach(p => (p.onclick = () => p.classList.toggle("on")));
      body.querySelector("#c-cancel").onclick = closeModal;
      body.querySelector("#c-save").onclick = async () => {
        const name = body.querySelector("#c-name").value.trim();
        const rotation = [...body.querySelectorAll(".split-pill.on")].map(p => p.dataset.uid);
        if (!name) return toast("name the chore");
        if (!rotation.length) return toast("who's in the rotation?");
        const data = {
          name,
          cadenceDays: Math.max(1, Number(body.querySelector("#c-cad").value) || 7),
          nextDue: body.querySelector("#c-due").value || todayISO(),
          rotation
        };
        if (existing) {
          await update("chores", existing.id, { ...data, turnIndex: (c.turnIndex || 0) % rotation.length });
        } else {
          await add("chores", { ...data, turnIndex: 0 });
        }
        closeModal(); toast(existing ? "updated" : "added 🧽");
      };
    }
  });
}

export const badge = () =>
  state.chores.some(c => isMe(whoseTurn(c)) && daysBetween(todayISO(), c.nextDue) <= 0);
