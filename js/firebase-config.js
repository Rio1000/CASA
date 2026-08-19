// ============================================================
//  PASTE YOUR FIREBASE CONFIG HERE
// ------------------------------------------------------------
//  Firebase console → Project settings → "Your apps" → Web app
//  Copy the firebaseConfig object and paste the values below.
//
//  Leave apiKey empty ("") and the app runs in DEMO MODE:
//  everything works, but data is stored only in this browser.
//  These keys are NOT secrets — they are meant to ship in the
//  browser. Your data is protected by the Firestore rules in
//  firestore.rules, not by hiding this file.
// ============================================================

export const firebaseConfig = {
  apiKey: "",
  authDomain: "YOUR-PROJECT.firebaseapp.com",
  projectId: "YOUR-PROJECT",
  storageBucket: "YOUR-PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

// Version of the firebase JS SDK loaded from the CDN.
export const FIREBASE_SDK = "11.0.2";
