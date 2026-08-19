// ============================================================
//  views/money.js — shared expenses, balances, settling up
// ============================================================

import { state, add, update, remove, members, nameOf, isMe } from "../store.js";
import {
  esc, toast, emptyState, openModal, closeModal, confirmSketch,
  money, round2, todayISO, friendlyDate, initialOf, colorFor
} from "../ui.js";

export const title = "Money";

/* ---------- math ---------- */
export function balances() {
  const bal = {};
  members().forEach(m => (bal[m.uid] = 0));
  for (const e of state.expenses) {
    const amt = Number(e.amount) || 0;
    const parts = (e.participants || []).filter(p => p in bal);
    if (!amt || !parts.length || !(e.payerId in bal)) continue;
    bal[e.payerId] += amt;
    const share = amt / parts.length;
    parts.forEach(p => (bal[p] -= share));
  }
  Object.keys(bal).forEach(k => (bal[k] = round2(bal[k])));
  return bal;
}

/** Greedy "fewest payments" settle-up plan. */
export function settlePlan(bal) {
  const owe  = Object.entries(bal).filter(([, v]) => v < -0.01).map(([u, v]) => [u, -v]);
  const owed = Object.entries(bal).filter(([, v]) => v >  0.01).map(([u, v]) => [u,  v]);
  owe.sort((a, b) => b[1] - a[1]); owed.sort((a, b) => b[1] - a[1]);
  const plan = [];
  let i = 0, j = 0;
  while (i < owe.length && j < owed.length) {
    const amt = Math.min(owe[i][1], owed[j][1]);
    if (amt > 0.01) plan.push({ from: owe[i][0], to: owed[j][0], amount: round2(amt) });
    owe[i][1] -= amt; owed[j][1] -= amt;
    if (owe[i][1] < 0.01) i++;
    if (owed[j][1] < 0.01) j++;
  }
  return plan;
}

/* ---------- view ---------- */
export function render(mount) {
  const bal  = balances();
  const plan = settlePlan(bal);
  const mine = bal[state.user.uid] || 0;
  const rows = [...state.expenses].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));
  const total = state.expenses.filter(e => e.kind !== "settle").reduce((s, e) => s + (Number(e.amount) || 0), 0);

  mount.innerHTML = `
    <div class="section-head">
      <h2 class="hand-title">Who owes who</h2>
      <span class="tiny-note">${money(total)} shared so far</span>
    </div>

    <div class="paper-card tilt-l" style="text-align:center; margin-bottom:20px">
      <div class="tape"></div>
      <p class="muted" style="margin:.4em 0 0">${mine > 0.01 ? "You're owed" : mine < -0.01 ? "You owe" : "You're all square"}</p>
      <div class="amt ${mine > 0.01 ? "pos" : mine < -0.01 ? "neg" : "zero"}" style="font-size:3rem">
        ${Math.abs(mine) < 0.01 ? "✓" : money(Math.abs(mine))}
      </div>
    </div>

    <div class="balance-grid">
      ${members().map(m => {
        const v = bal[m.uid] || 0;
        return `
        <div class="paper-card balance-card">
          <div class="member-dot" style="margin:0 auto 6px; color:${colorFor(m.uid)}">${initialOf(m.name)}</div>
          <div class="who">${esc(m.name)}${isMe(m.uid) ? " (you)" : ""}</div>
          <div class="amt ${v > 0.01 ? "pos" : v < -0.01 ? "neg" : "zero"}">${Math.abs(v) < 0.01 ? "—" : money(v)}</div>
          <div class="tiny-note">${v > 0.01 ? "is owed" : v < -0.01 ? "owes" : "square"}</div>
        </div>`;
      }).join("")}
    </div>

    ${plan.length ? `
      <div class="divider-doodle"></div>
      <h3>Simplest way to square up</h3>
      <div class="paper-card tilt-r">
        ${plan.map((p, i) => `
          <div class="settle-line">
            <span>${esc(nameOf(p.from))}</span>
            <span class="arrow-doodle">⟶</span>
            <span>${esc(nameOf(p.to))}</span>
            <strong class="hl">${money(p.amount)}</strong>
            ${(isMe(p.from) || isMe(p.to)) ? `<button class="btn btn-sm" data-act="settle" data-i="${i}">mark paid</button>` : ""}
          </div>`).join("")}
      </div>` : ""}

    <div class="divider-doodle"></div>
    <div class="section-head"><h3 style="margin:0">The receipts</h3></div>
    <div class="rows">
      ${rows.length ? rows.slice(0, 40).map(expenseRow).join("")
                    : emptyState("💸", "No shared costs logged yet.", "Add the grocery run and Casa does the math.")}
    </div>
  `;

  mount.querySelectorAll("[data-act]").forEach(b => {
    b.onclick = () => {
      if (b.dataset.act === "settle") {
        const p = plan[Number(b.dataset.i)];
        settleForm(p);
      } else handle(b.dataset.act, b.dataset.id);
    };
  });
}

function expenseRow(e) {
  const parts = (e.participants || []).map(nameOf);
  if (e.kind === "settle") {
    return `
    <div class="row-card">
      <div class="row-main">
        <div class="row-title">🤝 ${esc(nameOf(e.payerId))} paid ${esc(parts.join(", "))} <strong>${money(e.amount)}</strong></div>
        <div class="row-sub"><span>${esc(friendlyDate(e.date))}</span><span class="chip green">settle up</span></div>
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-act="del" data-id="${e.id}" title="Delete">✕</button>
      </div>
    </div>`;
  }
  const share = (Number(e.amount) || 0) / Math.max(1, (e.participants || []).length);
  const iAmIn = (e.participants || []).includes(state.user.uid);
  return `
  <div class="row-card">
    <div class="row-main">
      <div class="row-title">${esc(e.desc)} <strong>${money(e.amount)}</strong></div>
      <div class="row-sub">
        <span>${esc(nameOf(e.payerId))} paid · ${esc(friendlyDate(e.date))}</span>
        <span class="chip blue">split ${parts.length} ways</span>
        ${iAmIn ? `<span>your share ${money(share)}</span>` : `<span class="muted">not your split</span>`}
      </div>
      <div class="row-sub muted">${esc(parts.join(", "))}</div>
    </div>
    <div class="row-actions">
      <button class="icon-btn" data-act="edit" data-id="${e.id}" title="Edit">✎</button>
      <button class="icon-btn" data-act="del" data-id="${e.id}" title="Delete">✕</button>
    </div>
  </div>`;
}

async function handle(act, id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  if (act === "edit") expenseForm({ existing: e });
  if (act === "del" && await confirmSketch("Delete this entry?", { okLabel: "Delete" })) remove("expenses", id);
}

export function onAdd() { expenseForm({}); }

/* ---------- add / edit an expense ---------- */
export function expenseForm({ existing = null, desc = "", onSaved = null } = {}) {
  const e = existing || {};
  const ms = members();
  const chosen = new Set(e.participants || ms.map(m => m.uid));
  const payer = e.payerId || state.user.uid;

  openModal(`
    <h3>${existing ? "Edit expense" : "New shared expense"}</h3>
    <div class="stack">
      <label class="field"><span>What was it for?</span>
        <input id="x-desc" class="scribble-input" maxlength="60" placeholder="Groceries" value="${esc(e.desc || desc)}" /></label>
      <div style="display:flex; gap:14px">
        <label class="field" style="flex:1"><span>How much?</span>
          <input id="x-amt" class="scribble-input" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" value="${e.amount ?? ""}" /></label>
        <label class="field" style="flex:1"><span>When?</span>
          <input id="x-date" type="date" class="scribble-input" value="${esc(e.date || todayISO())}" /></label>
      </div>
      <label class="field"><span>Who paid?</span>
        <select id="x-payer" class="scribble-input">
          ${ms.map(m => `<option value="${m.uid}" ${m.uid === payer ? "selected" : ""}>${esc(m.name)}${isMe(m.uid) ? " (you)" : ""}</option>`).join("")}
        </select></label>
      <div class="field"><span>Split between</span>
        <div class="split-picker" id="x-split">
          ${ms.map(m => `<span class="split-pill ${chosen.has(m.uid) ? "on" : ""}" data-uid="${m.uid}">${esc(m.name)}</span>`).join("")}
        </div>
        <p class="tiny-note" id="x-share"></p>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" id="x-cancel">Cancel</button>
      <button class="btn btn-primary" id="x-save">${existing ? "Save" : "Add it"}</button>
    </div>`, {
    onMount(body) {
      const pills = [...body.querySelectorAll(".split-pill")];
      const amtEl = body.querySelector("#x-amt");
      const shareEl = body.querySelector("#x-share");

      const refresh = () => {
        const n = pills.filter(p => p.classList.contains("on")).length;
        const amt = Number(amtEl.value) || 0;
        shareEl.textContent = n && amt ? `${money(amt / n)} each` : "pick who shares this";
      };
      pills.forEach(p => (p.onclick = () => { p.classList.toggle("on"); refresh(); }));
      amtEl.oninput = refresh;
      refresh();

      body.querySelector("#x-cancel").onclick = closeModal;
      body.querySelector("#x-save").onclick = async () => {
        const descV = body.querySelector("#x-desc").value.trim();
        const amt = round2(Number(amtEl.value));
        const participants = pills.filter(p => p.classList.contains("on")).map(p => p.dataset.uid);
        if (!descV) return toast("what was it for?");
        if (!(amt > 0)) return toast("how much was it?");
        if (!participants.length) return toast("pick at least one person");
        const data = {
          kind: "expense", desc: descV, amount: amt,
          payerId: body.querySelector("#x-payer").value,
          payerName: nameOf(body.querySelector("#x-payer").value),
          participants,
          date: body.querySelector("#x-date").value || todayISO()
        };
        if (existing) await update("expenses", existing.id, data);
        else await add("expenses", data);
        closeModal();
        toast(existing ? "updated" : "logged 💸");
        await onSaved?.();
      };
    }
  });
}

/* ---------- record a payment between two people ---------- */
function settleForm(p) {
  openModal(`
    <h3>Mark as paid</h3>
    <p><strong>${esc(nameOf(p.from))}</strong> pays <strong>${esc(nameOf(p.to))}</strong></p>
    <div class="stack">
      <label class="field"><span>Amount</span>
        <input id="s-amt" class="scribble-input" type="number" step="0.01" min="0" value="${p.amount}" /></label>
      <label class="field"><span>When</span>
        <input id="s-date" type="date" class="scribble-input" value="${todayISO()}" /></label>
    </div>
    <div class="modal-actions">
      <button class="btn" id="s-cancel">Cancel</button>
      <button class="btn btn-primary" id="s-save">Record it</button>
    </div>`, {
    onMount(body) {
      body.querySelector("#s-cancel").onclick = closeModal;
      body.querySelector("#s-save").onclick = async () => {
        const amt = round2(Number(body.querySelector("#s-amt").value));
        if (!(amt > 0)) return toast("amount?");
        await add("expenses", {
          kind: "settle",
          desc: `${nameOf(p.from)} → ${nameOf(p.to)}`,
          amount: amt,
          payerId: p.from, payerName: nameOf(p.from),
          participants: [p.to],
          date: body.querySelector("#s-date").value || todayISO()
        });
        closeModal(); toast("squared up 🤝");
      };
    }
  });
}
