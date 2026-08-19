# 🏠 Casa — the roommate notebook

A hand-drawn shared notebook for college roommates. Four tabs, no clutter:

| Tab | What it does |
|---|---|
| 🧺 **List** | Shared shopping list. Anyone adds, anyone claims ("I'll grab it"), check off when bought. Tap 💸 on an item to log what it cost straight into the money tab. |
| 🎉 **Events** | House calendar — taco night, cleaning day, parents visiting. One-tap RSVP. |
| 💸 **Money** | Log a shared cost, pick who splits it. Casa keeps running balances and tells you the *fewest* payments to square up. |
| 🧽 **Chores** | Recurring chores that rotate automatically. Mark done → next roommate is up, next due date is set. |

No build step, no framework, no npm. Plain HTML/CSS/ES modules — which is exactly what GitHub Pages likes.

---

## Try it right now (demo mode)

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Click **"Just poke around (guest)"**, create a house, and you get a house pre-loaded with sample roommates and data. In demo mode everything is stored in `localStorage` — it works fully, it just doesn't sync between people. Reset it any time from the avatar button → *Reset demo data*.

---

## Going live: Firebase + GitHub Pages

### 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> → **Add project** (Analytics optional).
2. **Build → Authentication → Get started**. Enable **Google** and **Anonymous**.
3. **Build → Firestore Database → Create database** → *Production mode* → pick a region.
4. Project settings (⚙️) → **Your apps** → **Web** (`</>`) → register an app → copy the `firebaseConfig` object.

### 2. Paste the config

Open `js/firebase-config.js` and fill in the values you just copied:

```js
export const firebaseConfig = {
  apiKey: "AIza…",
  authDomain: "casa-xxxxx.firebaseapp.com",
  projectId: "casa-xxxxx",
  storageBucket: "casa-xxxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

The moment `apiKey` is non-empty, Casa switches out of demo mode and talks to Firestore. **These values are not secrets** — they're designed to ship in the browser. Your data is protected by the rules in the next step.

### 3. Publish the security rules

Firebase console → **Firestore → Rules** → paste the contents of `firestore.rules` → **Publish**.

These rules enforce: you can only read/write a house you're a member of, join codes can be read but never edited, and joining a house can't remove anyone who's already in it. Don't skip this — without it your house data is world-readable.

### 4. Push to GitHub

```bash
git init
git add .
git commit -m "Casa"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/casa.git
git push -u origin main
```

### 5. Turn on GitHub Pages

Repo → **Settings → Pages** → *Source*: **Deploy from a branch** → Branch `main`, folder `/ (root)` → **Save**.

A minute later you're live at `https://YOUR-USERNAME.github.io/casa/`.

### 6. Authorize the domain

Back in Firebase → **Authentication → Settings → Authorized domains** → **Add domain** → `YOUR-USERNAME.github.io`.

Skip this and Google sign-in fails with `auth/unauthorized-domain`.

### 7. Move in

Open the site, sign in with Google, **Start a new house**. Tap the house name in the header to get your 6-character code (or a share link) and send it to your roommates — they sign in and **Join house** with that code. Everything syncs live.

---

## How the data is laid out

```
users/{uid}                 → { houseId, name }
codes/{CODE}                → { houseId }              ← how joining by code works
houses/{houseId}            → { name, code, members:{ uid:{name,joinedAt} }, memberIds:[] }
houses/{houseId}/items/*    → { text, qty, done, addedBy, claimedBy, … }
houses/{houseId}/events/*   → { title, date, time, place, notes, rsvps:{uid:'yes'|'no'} }
houses/{houseId}/expenses/* → { kind:'expense'|'settle', desc, amount, payerId, participants[], date }
houses/{houseId}/chores/*   → { name, cadenceDays, rotation[], turnIndex, nextDue, lastDone }
```

Balances are computed in the browser from the expense list, so there's nothing to keep in sync and nothing to migrate — delete an expense and every balance corrects itself.

## Files

```
index.html              app shell + the SVG filters that make edges wobble
css/sketch.css          the hand-drawn design system (paper, ink, tape, checkboxes)
css/app.css             layout and feature components
js/app.js               boot + tab router
js/store.js             state; the only file that talks to a backend
js/backend-firebase.js  real backend (Auth + Firestore)
js/backend-local.js     demo backend (localStorage) — same interface
js/ui.js                DOM/date/money helpers, modal, toast
js/views/*.js           one file per tab
firestore.rules         security rules to publish
```

## About the drawn look

Nothing is an image. Every wobbly edge is a real CSS border pushed around by an SVG
`feTurbulence` + `feDisplacementMap` filter (`#wobble` in `index.html`), combined with
lopsided `border-radius` values. That means it stays crisp at any zoom, recolors with a
CSS variable, and costs no extra downloads. Fonts are *Caveat*, *Patrick Hand*, and
*Gloria Hallelujah* from Google Fonts.

Want a different pen? In `css/sketch.css` change `--ink`, or bump the `scale` on the
`#wobble` filter in `index.html` — higher = shakier hand.
