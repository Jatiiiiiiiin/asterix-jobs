import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";

import { auth, googleProvider, linkedinProvider, db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

/* ================= TYPES ================= */

export interface AuthUser {
  uid: string;
  email: string | null;
  role: "candidate" | "recruiter";
  isOnboarded: boolean;
  // ← NEW: Subscription/Plan fields
  isPremium?: boolean;
  isStudent?: boolean;
  photoURL?: string;
  displayName?: string;
}

/* ================= SESSION STORAGE KEY ================= */

// sessionStorage is per-tab and per-window — unlike localStorage or Firebase's
// auth.currentUser, it is NOT shared across browser tabs. Writing the uid here
// at login time means each tab independently knows which account is active in it.
const SESSION_UID_KEY   = "asterix_session_uid";
const SESSION_EMAIL_KEY = "asterix_session_email";
const SESSION_ROLE_KEY  = "asterix_session_role";

function writeSession(uid: string, email: string | null, role: string) {
  sessionStorage.setItem(SESSION_UID_KEY,   uid);
  sessionStorage.setItem(SESSION_EMAIL_KEY, email ?? "");
  sessionStorage.setItem(SESSION_ROLE_KEY,  role);
}

export function readSessionUid(): string | null {
  return sessionStorage.getItem(SESSION_UID_KEY);
}

/* ================= AUTH SERVICE ================= */

export const authService = {

  /* ========= EMAIL SIGNUP ========= */
  async signupWithEmail(
    email: string,
    password: string,
    role: "candidate" | "recruiter"
  ): Promise<AuthUser> {
    const res = await createUserWithEmailAndPassword(auth, email, password);

    // Initialize user document with default subscription (free plan)
    await setDoc(doc(db, "users", res.user.uid), {
      email: res.user.email,
      role,
      isOnboarded: false,
      // ← NEW: Default subscription for new users
      subscription: {
        plan: "free",
        status: "active",
        isPremium: false,
        isStudent: false,
        startDate: new Date(),
        endDate: null,
      },
      createdAt: new Date()
    });

    writeSession(res.user.uid, res.user.email, role);

    return {
      uid: res.user.uid,
      email: res.user.email,
      role,
      isOnboarded: false,
      isPremium: false,
      isStudent: false,
    };
  },

  /* ========= EMAIL LOGIN ========= */
  async loginWithEmail(
    email: string,
    password: string
  ): Promise<AuthUser> {
    const res = await signInWithEmailAndPassword(auth, email, password);

    const userRef = doc(db, "users", res.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // Create user document if doesn't exist
      await setDoc(userRef, {
        email: res.user.email,
        role: "candidate",
        isOnboarded: false,
        // ← NEW: Default subscription for new users
        subscription: {
          plan: "free",
          status: "active",
          isPremium: false,
          isStudent: false,
          startDate: new Date(),
          endDate: null,
        }
      });
    }

    const data = (await getDoc(userRef)).data();
    const role = data?.role || "candidate";

    writeSession(res.user.uid, res.user.email, role);

    return {
      uid: res.user.uid,
      email: res.user.email,
      role,
      isOnboarded: data?.isOnboarded || false,
      // ← NEW: Extract subscription fields
      isPremium: data?.subscription?.isPremium || false,
      isStudent: data?.subscription?.isStudent || false,
      photoURL: res.user.photoURL || undefined,
      displayName: res.user.displayName || undefined,
    };
  },

  /* ========= SOCIAL LOGIN ========= */
  async loginWithSocial(
    provider: "google" | "linkedin",
    role?: "candidate" | "recruiter"
  ): Promise<AuthUser> {
    const prov = provider === "google" ? googleProvider : linkedinProvider;
    const res = await signInWithPopup(auth, prov);

    const userRef = doc(db, "users", res.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // Create user document if doesn't exist
      await setDoc(userRef, {
        email: res.user.email,
        role: role || "candidate",
        isOnboarded: false,
        // ← NEW: Default subscription for new users
        subscription: {
          plan: "free",
          status: "active",
          isPremium: false,
          isStudent: false,
          startDate: new Date(),
          endDate: null,
        },
        createdAt: new Date()
      });
    }

    const data = (await getDoc(userRef)).data();
    const resolvedRole = data?.role || role || "candidate";

    writeSession(res.user.uid, res.user.email, resolvedRole);

    return {
      uid: res.user.uid,
      email: res.user.email,
      role: resolvedRole,
      isOnboarded: data?.isOnboarded || false,
      // ← NEW: Extract subscription fields
      isPremium: data?.subscription?.isPremium || false,
      isStudent: data?.subscription?.isStudent || false,
      photoURL: res.user.photoURL || undefined,
      displayName: res.user.displayName || undefined,
    };
  },

  /* ========= GET CURRENT USER ========= */
  // Reads from sessionStorage first (per-tab, set at login).
  // Falls back to auth.currentUser only if sessionStorage is empty
  // (e.g. on a hard refresh where the user was already logged in).
  async getCurrentUser(): Promise<AuthUser | null> {
    const sessionUid = readSessionUid();

    // Determine which uid to use
    const firebaseUser = auth.currentUser;
    const uid = sessionUid || firebaseUser?.uid;

    if (!uid) return null;

    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;

    const data = snap.data();

    // Ensure sessionStorage is populated even after a refresh
    if (!sessionUid && firebaseUser) {
      writeSession(firebaseUser.uid, firebaseUser.email, data.role);
    }

    return {
      uid,
      email: data.email ?? firebaseUser?.email ?? null,
      role: data.role,
      isOnboarded: data.isOnboarded || false,
      // ← NEW: Extract subscription fields from Firestore
      isPremium: data.subscription?.isPremium || false,
      isStudent: data.subscription?.isStudent || false,
      photoURL: firebaseUser?.photoURL || data.photoURL || undefined,
      displayName: firebaseUser?.displayName || data.displayName || undefined,
    };
  },

  /* ========= UPDATE USER ========= */
  async updateUser(data: Partial<AuthUser>) {
    const uid = readSessionUid() || auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(doc(db, "users", uid), data, { merge: true });
  },

  /* ========= UPDATE SUBSCRIPTION ========= */
  // ← NEW: Helper function to update subscription/plan
  async updateSubscription(subscriptionData: {
    plan: "free" | "premium" | "student";
    status?: "active" | "canceled" | "expired";
    isPremium?: boolean;
    isStudent?: boolean;
    startDate?: Date;
    endDate?: Date | null;
    paymentId?: string;
    autoRenew?: boolean;
  }) {
    const uid = readSessionUid() || auth.currentUser?.uid;
    if (!uid) throw new Error("No user session");

    console.log("[💳 Auth] Updating subscription for user:", uid, subscriptionData);

    await setDoc(
      doc(db, "users", uid),
      {
        subscription: {
          ...subscriptionData,
          updatedAt: new Date(),
        },
      },
      { merge: true }
    );

    console.log("[✅ Auth] Subscription updated successfully");
  },

  /* ========= LOGOUT ========= */
  async logout() {
    sessionStorage.removeItem(SESSION_UID_KEY);
    sessionStorage.removeItem(SESSION_EMAIL_KEY);
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    await signOut(auth);
  }
};