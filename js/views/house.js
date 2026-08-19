// ============================================================
//  views/house.js — house settings sheet & "me" sheet
// ============================================================

import {
  state, members, isMe, renameHouse, setMyName, leaveHouse, signOut, wipeDemo
} from "../store.js";
import { esc, toast, openModal, closeModal, confirmSketch, initialOf, colorFor } from "../ui.js";

export function openHouseSheet() {
  const h = state.house;
  if (!h) return;
  openModal(`
    <h3>${esc(h.name)}</h3>
    <p class="tiny-note">Share this code so roommates can join:</p>
    <div class="sticky blue tilt-l" style="margin: 8px 0 16px">
      <div class="big-code">${esc(h.code)}</div>
    </div>
    <div class="modal-actions" style="justify-content:flex-start; margin-top:0">
      <button class="btn btn-sm" id="h-copy">Copy code</button>
      <button class="btn btn-sm" id="h-share">Share link</button>
    </div>

    <div class="divider-doodle"></div>
    <h4 style="margin:0 0 6px">Everyone here</h4>
    ${members().map(m => `
      <div class="member-line">
        <span class="member-dot" style="color:${colorFor(m.uid)}">${initialOf(m.name)}</span>
        <span>${esc(m.name)}${isMe(m.uid) ? " (you)" : ""}</span>
      </div>`).join("")}

    <div class="divider-doodle"></div>
    <label class="field"><span>Rename the house</span>
      <input id="h-name" class="scribble-input" maxlength="40" value="${esc(h.name)}" /></label>
    <div class="modal-actions">
      <button class="btn btn-sm btn-danger" id="h-leave">Leave house</button>
      <button class="btn btn-sm btn-primary" id="h-save">Save name</button>
    </div>`, {
    onMount(body) {
      body.querySelector("#h-copy").onclick = async () => {
        try { await navigator.clipboard.writeText(h.code); toast("code copied"); }
        catch { toast(h.code); }
      };
      body.querySelector("#h-share").onclick = async () => {
        const url = `${location.origin}${location.pathname}#join=${h.code}`;
        const text = `Join our house on Casa — code ${h.code}\n${url}`;
        if (navigator.share) { try { await navigator.share({ title: "Casa", text, url }); } catch {} }
        else { try { await navigator.clipboard.writeText(text); toast("invite copied"); } catch { toast(url); } }
      };
      body.querySelector("#h-save").onclick = async () => {
        const n = body.querySelector("#h-name").value.trim();
        if (n) { await renameHouse(n); toast("renamed"); closeModal(); }
      };
      body.querySelector("#h-leave").onclick = async () => {
        if (await confirmSketch("Leave this house? You'll need the code to come back.", { okLabel: "Leave" })) {
          await leaveHouse(); closeModal();
        }
      };
    }
  });
}

export function openMeSheet() {
  openModal(`
    <h3>You</h3>
    <div class="stack">
      <label class="field"><span>Your name (what roommates see)</span>
        <input id="m-name" class="scribble-input" maxlength="24" value="${esc(state.user?.name || "")}" /></label>
      <p class="tiny-note">
        ${state.mode === "demo"
          ? "⚠️ Demo mode — data lives only in this browser. Add your Firebase config to sync with roommates."
          : "☁️ Synced with your house in real time."}
      </p>
    </div>
    <div class="modal-actions">
      ${state.mode === "demo" ? `<button class="btn btn-sm btn-danger" id="m-wipe">Reset demo data</button>` : ""}
      <button class="btn btn-sm" id="m-out">Sign out</button>
      <button class="btn btn-sm btn-primary" id="m-save">Save</button>
    </div>`, {
    onMount(body) {
      body.querySelector("#m-save").onclick = async () => {
        const n = body.querySelector("#m-name").value.trim();
        if (n) { await setMyName(n); toast("got it"); closeModal(); }
      };
      body.querySelector("#m-out").onclick = async () => { closeModal(); await signOut(); };
      body.querySelector("#m-wipe")?.addEventListener("click", async () => {
        if (await confirmSketch("Wipe all demo data in this browser?", { okLabel: "Wipe" })) {
          wipeDemo(); closeModal(); location.reload();
        }
      });
    }
  });
}
