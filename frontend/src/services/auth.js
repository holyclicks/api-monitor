import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase.js";

/**
 * Sign in existing user with Firebase Authentication.
 * Throws real Firebase errors if credentials are invalid.
 */
export async function loginUser(email, password) {
  if (!auth) {
    throw new Error("Firebase Authentication is not initialized.");
  }

  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = {
    uid: cred.user.uid,
    email: cred.user.email,
    name: cred.user.displayName || cred.user.email?.split("@")[0] || "User",
  };
  return user;
}

/**
 * Register new user with Firebase Authentication.
 * Updates display name on creation.
 * Throws real Firebase errors if registration fails.
 */
export async function registerUser(email, password, name) {
  if (!auth) {
    throw new Error("Firebase Authentication is not initialized.");
  }

  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

  if (name && cred.user) {
    try {
      await updateProfile(cred.user, { displayName: name.trim() });
    } catch (profileErr) {
      console.warn("Could not set displayName on user profile:", profileErr.message);
    }
  }

  const user = {
    uid: cred.user.uid,
    email: cred.user.email,
    name: name?.trim() || cred.user.displayName || cred.user.email?.split("@")[0] || "User",
  };
  return user;
}

/**
 * Sign out the currently logged-in user.
 */
export async function logoutUser() {
  if (auth) {
    await signOut(auth);
  }
}

/**
 * Retrieves the current Firebase ID token for authenticating backend requests.
 * Refreshes token automatically if expired.
 */
export async function getAuthToken() {
  if (!auth) return null;

  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  try {
    return await currentUser.getIdToken(false);
  } catch (err) {
    console.warn("Error getting Firebase ID token:", err.message);
    return null;
  }
}

/**
 * Returns the currently authenticated user object from Firebase Auth, or null if not logged in.
 * Never returns demo or fallback users.
 */
export function getCurrentUser() {
  if (!auth || !auth.currentUser) {
    return null;
  }

  const u = auth.currentUser;
  return {
    uid: u.uid,
    email: u.email,
    name: u.displayName || u.email?.split("@")[0] || "User",
  };
}

/**
 * Subscribes to Firebase Authentication state changes.
 * Firebase Auth is the single source of authentication truth.
 */
export function subscribeToAuthChanges(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      callback({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
      });
    } else {
      callback(null);
    }
  });
}

export default {
  loginUser,
  registerUser,
  logoutUser,
  getAuthToken,
  getCurrentUser,
  subscribeToAuthChanges,
};
