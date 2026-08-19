// ============================================================
//  backend-firebase.js — real backend (Firebase Auth + Firestore)
//  Loaded lazily, only when firebase-config.js has an apiKey.
// ============================================================

import { firebaseConfig, FIREBASE_SDK } from "./firebase-config.js";

const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}`;

let A, F, app, auth, dbx;

const houseRef = id => F.doc(dbx, "houses", id);
const collRef  = (id, c) => F.collection(dbx, "houses", id, c);

function makeCode() {
  let out = "";
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const firebaseBackend = {
  mode: "firebase",

  async init() {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`)
    ]);
    A = authMod; F = fsMod;
    app  = appMod.initializeApp(firebaseConfig);
    auth = A.getAuth(app);
    dbx  = F.getFirestore(app);
    try { await F.enableIndexedDbPersistence(dbx); } catch { /* multi-tab or unsupported: fine */ }
  },

  onAuthChange(cb) {
    return A.onAuthStateChanged(auth, u => {
      cb(u ? {
        uid: u.uid,
        name: u.displayName || "Roommate",
        photo: u.photoURL || "",
        isGuest: u.isAnonymous
      } : null);
    });
  },

  async signInGoogle() {
    const provider = new A.GoogleAuthProvider();
    try {
      await A.signInWithPopup(auth, provider);
    } catch (e) {
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment",
           "auth/cancelled-popup-request"].includes(e.code)) {
        await A.signInWithRedirect(auth, provider);
      } else throw e;
    }
  },

  async signInGuest() { await A.signInAnonymously(auth); },

  async signOut() { await A.signOut(auth); },

  async loadProfile(uid) {
    const snap = await F.getDoc(F.doc(dbx, "users", uid));
    return snap.exists() ? snap.data() : null;
  },

  async saveProfile(uid, patch) {
    await F.setDoc(F.doc(dbx, "users", uid), patch, { merge: true });
  },

  async createHouse({ name, user }) {
    const code = makeCode();
    const ref  = F.doc(F.collection(dbx, "houses"));
    await F.setDoc(ref, {
      name: name || "Our place",
      code,
      createdBy: user.uid,
      createdAt: Date.now(),
      memberIds: [user.uid],
      members: { [user.uid]: { name: user.name, joinedAt: Date.now() } }
    });
    await F.setDoc(F.doc(dbx, "codes", code), { houseId: ref.id });
    await this.saveProfile(user.uid, { houseId: ref.id, name: user.name });
    return ref.id;
  },

  async joinHouse(code, user) {
    const c = String(code || "").toUpperCase().trim();
    const snap = await F.getDoc(F.doc(dbx, "codes", c));
    if (!snap.exists()) throw new Error("No house with that code.");
    const houseId = snap.data().houseId;
    await F.updateDoc(houseRef(houseId), {
      [`members.${user.uid}`]: { name: user.name, joinedAt: Date.now() },
      memberIds: F.arrayUnion(user.uid)
    });
    await this.saveProfile(user.uid, { houseId, name: user.name });
    return houseId;
  },

  watchHouse(houseId, cb) {
    return F.onSnapshot(houseRef(houseId),
      s => cb(s.exists() ? { id: s.id, ...s.data() } : null),
      err => { console.warn("house watch:", err); cb(null); });
  },

  watchColl(houseId, coll, cb) {
    return F.onSnapshot(collRef(houseId, coll),
      s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.warn(`${coll} watch:`, err));
  },

  async add(houseId, coll, data) {
    const ref = await F.addDoc(collRef(houseId, coll), { ...data, createdAt: Date.now() });
    return ref.id;
  },

  async update(houseId, coll, id, patch) {
    await F.updateDoc(F.doc(dbx, "houses", houseId, coll, id), patch);
  },

  async remove(houseId, coll, id) {
    await F.deleteDoc(F.doc(dbx, "houses", houseId, coll, id));
  },

  async updateHouse(houseId, patch) {
    await F.updateDoc(houseRef(houseId), patch);
  },

  async setMemberName(houseId, uid, name) {
    await F.updateDoc(houseRef(houseId), { [`members.${uid}.name`]: name });
  },

  async leaveHouse(houseId, uid) {
    await F.updateDoc(houseRef(houseId), {
      [`members.${uid}`]: F.deleteField(),
      memberIds: F.arrayRemove(uid)
    });
    await this.saveProfile(uid, { houseId: null });
  }
};
