// ============================================================
//  backend-local.js — demo backend (localStorage)
//  Same shape as backend-firebase.js so store.js doesn't care.
// ============================================================

import { todayISO, addDays } from "./ui.js";

const KEY = "casa.demo.v1";
const COLLS = ["items", "events", "expenses", "chores"];

const uid = () => Math.random().toString(36).slice(2, 10);

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }

function blank() {
  return { user: null, profiles: {}, houses: {}, codes: {}, data: {} };
}
function db() {
  const d = load();
  return Object.assign(blank(), d);
}

const listeners = new Set();
function emit() { listeners.forEach(fn => fn()); }
window.addEventListener("storage", e => { if (e.key === KEY) emit(); });

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no look-alikes
function makeCode(store) {
  let c;
  do {
    c = "";
    for (let i = 0; i < 6; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  } while (store.codes[c]);
  return c;
}

/* ---------- sample data so the demo isn't a blank page ---------- */
function seed(store, houseId, me) {
  const ana  = "demo_ana",  jay = "demo_jay";
  const h = store.houses[houseId];
  h.members[ana] = { name: "Ana",  joinedAt: Date.now() };
  h.members[jay] = { name: "Jay",  joinedAt: Date.now() };

  const d = store.data[houseId];
  const now = Date.now();
  d.items = [
    { id: uid(), text: "Oat milk",        qty: "2",   done: false, addedBy: ana, addedByName: "Ana", claimedBy: me.uid, claimedByName: me.name, createdAt: now - 3600e3 },
    { id: uid(), text: "Dish soap",       qty: "",    done: false, addedBy: me.uid, addedByName: me.name, createdAt: now - 7200e3 },
    { id: uid(), text: "Coffee filters",  qty: "1 box", done: false, addedBy: jay, addedByName: "Jay", createdAt: now - 9000e3 },
    { id: uid(), text: "Paper towels",    qty: "",    done: true,  addedBy: ana, addedByName: "Ana", doneAt: now - 86400e3, createdAt: now - 172800e3 }
  ];
  d.events = [
    { id: uid(), title: "Taco night 🌮", date: addDays(todayISO(), 1), time: "19:00", place: "kitchen",
      notes: "Jay is on guac duty", createdBy: jay, createdByName: "Jay",
      rsvps: { [jay]: "yes", [ana]: "yes" }, createdAt: now },
    { id: uid(), title: "Deep clean before parents visit", date: addDays(todayISO(), 5), time: "11:00",
      place: "whole apartment", notes: "", createdBy: ana, createdByName: "Ana",
      rsvps: { [ana]: "yes" }, createdAt: now }
  ];
  d.expenses = [
    { id: uid(), kind: "expense", desc: "Groceries — Trader Joe's", amount: 86.4, payerId: ana, payerName: "Ana",
      participants: [ana, jay, me.uid], date: addDays(todayISO(), -3), createdAt: now - 3 * 86400e3 },
    { id: uid(), kind: "expense", desc: "Internet — August", amount: 60, payerId: me.uid, payerName: me.name,
      participants: [ana, jay, me.uid], date: addDays(todayISO(), -6), createdAt: now - 6 * 86400e3 },
    { id: uid(), kind: "expense", desc: "Pizza after the game", amount: 32, payerId: jay, payerName: "Jay",
      participants: [jay, me.uid], date: addDays(todayISO(), -1), createdAt: now - 86400e3 }
  ];
  d.chores = [
    { id: uid(), name: "Take out trash", cadenceDays: 3, rotation: [me.uid, ana, jay], turnIndex: 0,
      nextDue: todayISO(), createdAt: now },
    { id: uid(), name: "Clean bathroom", cadenceDays: 7, rotation: [ana, jay, me.uid], turnIndex: 0,
      nextDue: addDays(todayISO(), 2), createdAt: now },
    { id: uid(), name: "Kitchen counters + dishes", cadenceDays: 1, rotation: [jay, me.uid, ana], turnIndex: 0,
      nextDue: addDays(todayISO(), -1), createdAt: now }
  ];
}

export const localBackend = {
  mode: "demo",

  async init() { /* nothing to boot */ },

  onAuthChange(cb) {
    cb(db().user);
    const fn = () => cb(db().user);
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  async signInGoogle() { return this.signInGuest(); },

  async signInGuest(name) {
    const store = db();
    store.user = store.user || { uid: "me_" + uid(), name: name || "You", isGuest: true };
    if (name) store.user.name = name;
    save(store); emit();
    return store.user;
  },

  async signOut() {
    const store = db();
    store.user = null;
    save(store); emit();
  },

  async loadProfile(u) { return db().profiles[u] || null; },

  async saveProfile(u, patch) {
    const store = db();
    store.profiles[u] = { ...(store.profiles[u] || {}), ...patch };
    if (patch.name && store.user && store.user.uid === u) store.user.name = patch.name;
    save(store); emit();
  },

  async createHouse({ name, user, demoSeed = true }) {
    const store = db();
    const id = "h_" + uid();
    const code = makeCode(store);
    store.houses[id] = {
      id, name: name || "Our place", code, createdBy: user.uid, createdAt: Date.now(),
      members: { [user.uid]: { name: user.name, joinedAt: Date.now() } }
    };
    store.codes[code] = id;
    store.data[id] = { items: [], events: [], expenses: [], chores: [] };
    save(store);
    if (demoSeed) { const s = db(); seed(s, id, user); save(s); }
    emit();
    return id;
  },

  async joinHouse(code, user) {
    const store = db();
    const id = store.codes[String(code || "").toUpperCase().trim()];
    if (!id) throw new Error("No house with that code.");
    store.houses[id].members[user.uid] = { name: user.name, joinedAt: Date.now() };
    save(store); emit();
    return id;
  },

  watchHouse(houseId, cb) {
    const push = () => cb(db().houses[houseId] || null);
    push(); listeners.add(push);
    return () => listeners.delete(push);
  },

  watchColl(houseId, coll, cb) {
    const push = () => cb([...((db().data[houseId] || {})[coll] || [])]);
    push(); listeners.add(push);
    return () => listeners.delete(push);
  },

  async add(houseId, coll, data) {
    const store = db();
    store.data[houseId] = store.data[houseId] || {};
    const arr = store.data[houseId][coll] = store.data[houseId][coll] || [];
    const id = uid();
    arr.push({ ...data, id, createdAt: Date.now() });
    save(store); emit();
    return id;
  },

  async update(houseId, coll, id, patch) {
    const store = db();
    const arr = (store.data[houseId] || {})[coll] || [];
    const i = arr.findIndex(x => x.id === id);
    if (i > -1) arr[i] = { ...arr[i], ...patch };
    save(store); emit();
  },

  async remove(houseId, coll, id) {
    const store = db();
    const d = store.data[houseId] || {};
    d[coll] = (d[coll] || []).filter(x => x.id !== id);
    save(store); emit();
  },

  async updateHouse(houseId, patch) {
    const store = db();
    store.houses[houseId] = { ...(store.houses[houseId] || {}), ...patch };
    save(store); emit();
  },

  async setMemberName(houseId, u, name) {
    const store = db();
    const h = store.houses[houseId];
    if (h?.members?.[u]) h.members[u].name = name;
    save(store); emit();
  },

  async leaveHouse(houseId, u) {
    const store = db();
    delete store.houses[houseId]?.members?.[u];
    if (store.profiles[u]) store.profiles[u].houseId = null;
    save(store); emit();
  },

  wipe() { localStorage.removeItem(KEY); emit(); },

  _colls: COLLS
};
