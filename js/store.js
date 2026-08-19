// ============================================================
//  store.js — app state + the one place that talks to a backend
// ============================================================

import { firebaseConfig } from "./firebase-config.js";
import { localBackend } from "./backend-local.js";

export const state = {
  ready: false,
  mode: "demo",
  user: null,       // {uid,name,photo,isGuest}
  houseId: null,
  house: null,      // {id,name,code,members:{uid:{name}}}
  items: [], events: [], expenses: [], chores: []
};

let backend = localBackend;
const subs = new Set();
let unsubs = [];

export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
export const notify = () => subs.forEach(fn => fn(state));

export const isConfigured = () => !!(firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10);

/* ---------- boot ---------- */
export async function boot(onAuth) {
  if (isConfigured()) {
    try {
      const { firebaseBackend } = await import("./backend-firebase.js");
      await firebaseBackend.init();
      backend = firebaseBackend;
    } catch (e) {
      console.error("Firebase failed to start, falling back to demo mode:", e);
      backend = localBackend;
    }
  }
  await backend.init();
  state.mode = backend.mode;

  backend.onAuthChange(async user => {
    state.user = user;
    detachHouse();
    if (user) {
      const profile = await backend.loadProfile(user.uid);
      if (profile?.name) user.name = profile.name;
      if (profile?.houseId) await attachHouse(profile.houseId);
      else { state.houseId = null; state.house = null; }
    } else {
      state.houseId = null; state.house = null;
    }
    state.ready = true;
    onAuth?.(state);
    notify();
  });
}

/* ---------- auth ---------- */
export const signInGoogle = () => backend.signInGoogle();
export const signInGuest  = name => backend.signInGuest(name);
export async function signOut() { detachHouse(); await backend.signOut(); }

/* ---------- house ---------- */
function detachHouse() {
  unsubs.forEach(u => { try { u(); } catch {} });
  unsubs = [];
  state.items = state.events = state.expenses = state.chores = [];
}

async function attachHouse(houseId) {
  state.houseId = houseId;
  unsubs.push(backend.watchHouse(houseId, h => { state.house = h; notify(); }));
  for (const coll of ["items", "events", "expenses", "chores"]) {
    unsubs.push(backend.watchColl(houseId, coll, rows => { state[coll] = rows; notify(); }));
  }
}

export async function createHouse(name) {
  const id = await backend.createHouse({ name, user: state.user });
  await backend.saveProfile(state.user.uid, { houseId: id, name: state.user.name });
  detachHouse();
  await attachHouse(id);
  notify();
  return id;
}

export async function joinHouse(code) {
  const id = await backend.joinHouse(code, state.user);
  await backend.saveProfile(state.user.uid, { houseId: id, name: state.user.name });
  detachHouse();
  await attachHouse(id);
  notify();
  return id;
}

export async function leaveHouse() {
  await backend.leaveHouse(state.houseId, state.user.uid);
  detachHouse();
  state.houseId = null; state.house = null;
  notify();
}

export async function renameHouse(name) { await backend.updateHouse(state.houseId, { name }); }

export async function setMyName(name) {
  state.user.name = name;
  await backend.saveProfile(state.user.uid, { name });
  if (state.houseId) await backend.setMemberName(state.houseId, state.user.uid, name);
  notify();
}

/* ---------- generic collection ops ---------- */
export const add    = (coll, data)      => backend.add(state.houseId, coll, data);
export const update = (coll, id, patch) => backend.update(state.houseId, coll, id, patch);
export const remove = (coll, id)        => backend.remove(state.houseId, coll, id);

/* ---------- helpers ---------- */
export function members() {
  const m = state.house?.members || {};
  return Object.entries(m)
    .map(([uid, v]) => ({ uid, name: v?.name || "Roommate", joinedAt: v?.joinedAt || 0 }))
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

export function nameOf(uid) {
  if (!uid) return "";
  if (uid === state.user?.uid) return state.user.name || "You";
  return state.house?.members?.[uid]?.name || "someone";
}

export const isMe = uid => uid === state.user?.uid;

export const wipeDemo = () => localBackend.wipe?.();
