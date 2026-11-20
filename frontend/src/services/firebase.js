import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForLocalDevOnly12345678",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "apiwatch-platform.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "apiwatch-platform",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "apiwatch-platform.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
};

let app = null;
let auth = null;
let db = null;

try {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.warn("Client Firebase initialization note:", err.message);
}

export { app, auth, db };
export default app;
