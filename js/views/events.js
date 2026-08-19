// ============================================================
//  views/events.js — house events & activities
// ============================================================

import { state, add, update, remove, members, nameOf, isMe } from "../store.js";
import {
  esc, toast, emptyState, openModal, closeModal, confirmSketch,
  todayISO, friendlyDate, friendlyTime, dayNum, monthShort, initialOf, parseISO
} from "../ui.js";

export const title = "Events";

export function render(mount) {
  const today = todayISO();
  const all  = [...state.events].sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""));
  const up   = all.filter(e => (e.date || "9999") >= today);
  const past = all.filter(e => (e.date || "0000") < today).reverse();

  mount.innerHTML = `
    <div class="section-head">
      <h2 class="hand-title">What's happening</h2>
      <span class="tiny-note">${up.length} coming up</span>
    </div>

    <div class="rows">
      ${up.length ? up.map(eventCard).join("")
                  : emptyState("🎉", "Nothing planned yet.", "Taco night? Movie night? Cleaning day?")}
    </div>

    ${past.length ? `
      <div class="divider-doodle"></div>
      <h3 class="muted">Already happened</h3>
      <div class="rows">${past.slice(0, 6).map(eventCard).join("")}</div>` : ""}
  `;

  mount.querySelectorAll("[data-act]").forEach(b => {
    b.onclick = () => handle(b.dataset.act, b.dataset.id, b.dataset.val);
  });
}

function eventCard(e) {
  const rsvps = e.rsvps || {};
  const mine  = rsvps[state.user.uid] || null;
  const yes   = Object.entries(rsvps).filter(([, v]) => v === "yes");
  const soon  = e.date === todayISO();

  return `
  <div class="row-card">
    <div class="event-date">
      <div class="d">${dayNum(e.date)}</div>
      <div class="m">${monthShort(e.date)}</div>
    </div>
    <div class="row-main">
      <div class="row-title">${esc(e.title)}${soon ? ` <span class="chip red">today</span>` : ""}</div>
      <div class="row-sub">
        <span>${esc(friendlyDate(e.date))}${e.time ? " · " + esc(friendlyTime(e.time)) : ""}</span>
        ${e.place ? `<span>📍 ${esc(e.place)}</span>` : ""}
        <span>by ${esc(e.createdByName || nameOf(e.createdBy))}</span>
      </div>
      ${e.notes ? `<div class="row-sub" style="margin-top:4px">📝 ${esc(e.notes)}</div>` : ""}
      <div class="rsvp-row">
        ${yes.map(([uid]) => `<span class="rsvp-face yes" title="${esc(nameOf(uid))} is in">${initialOf(nameOf(uid))}</span>`).join("")}
        <button class="btn btn-sm ${mine === "yes" ? "btn-primary" : ""}" data-act="rsvp" data-val="yes" data-id="${e.id}">I'm in</button>
        <button class="btn btn-sm ${mine === "no" ? "btn-danger" : ""}" data-act="rsvp" data-val="no" data-id="${e.id}">Can't</button>
      </div>
    </div>
    <div class="row-actions">
      <button class="icon-btn" data-act="edit" data-id="${e.id}" title="Edit">✎</button>
      <button class="icon-btn" data-act="del" data-id="${e.id}" title="Delete">✕</button>
    </div>
  </div>`;
}

async function handle(act, id, val) {
  const ev = state.events.find(x => x.id === id);
  if (!ev) return;

  if (act === "rsvp") {
    const rsvps = { ...(ev.rsvps || {}) };
    if (rsvps[state.user.uid] === val) delete rsvps[state.user.uid];
    else rsvps[state.user.uid] = val;
    await update("events", id, { rsvps });
  }

  if (act === "edit") eventForm(ev);

  if (act === "del") {
    if (await confirmSketch(`Delete "${ev.title}"?`, { okLabel: "Delete" })) remove("events", id);
  }
}

export function onAdd() { eventForm(null); }

function eventForm(ev) {
  const e = ev || {};
  openModal(`
    <h3>${ev ? "Edit event" : "New event"}</h3>
    <div class="stack">
      <label class="field"><span>What is it?</span>
        <input id="e-title" class="scribble-input" maxlength="70" placeholder="Taco night 🌮" value="${esc(e.title || "")}" /></label>
      <div style="display:flex; gap:14px">
        <label class="field" style="flex:1"><span>Day</span>
          <input id="e-date" type="date" class="scribble-input" value="${esc(e.date || todayISO())}" /></label>
        <label class="field" style="flex:1"><span>Time</span>
          <input id="e-time" type="time" class="scribble-input" value="${esc(e.time || "19:00")}" /></label>
      </div>
      <label class="field"><span>Where? (optional)</span>
        <input id="e-place" class="scribble-input" maxlength="40" placeholder="kitchen" value="${esc(e.place || "")}" /></label>
      <label class="field"><span>Notes (optional)</span>
        <textarea id="e-notes" class="scribble-input" rows="2" maxlength="200" placeholder="bring your own chips">${esc(e.notes || "")}</textarea></label>
    </div>
    <div class="modal-actions">
      <button class="btn" id="e-cancel">Cancel</button>
      <button class="btn btn-primary" id="e-save">${ev ? "Save" : "Put it on the fridge"}</button>
    </div>`, {
    onMount(body) {
      body.querySelector("#e-cancel").onclick = closeModal;
      body.querySelector("#e-save").onclick = async () => {
        const title = body.querySelector("#e-title").value.trim();
        if (!title) return toast("…name it first");
        const data = {
          title,
          date:  body.querySelector("#e-date").value || todayISO(),
          time:  body.querySelector("#e-time").value,
          place: body.querySelector("#e-place").value.trim(),
          notes: body.querySelector("#e-notes").value.trim()
        };
        if (ev) await update("events", ev.id, data);
        else await add("events", {
          ...data,
          createdBy: state.user.uid, createdByName: state.user.name,
          rsvps: { [state.user.uid]: "yes" }
        });
        closeModal();
        toast(ev ? "updated" : "on the calendar 📌");
      };
    }
  });
}

export const badge = () =>
  state.events.some(e => e.date === todayISO() && !(e.rsvps || {})[state.user?.uid]);
