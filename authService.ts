import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  sendEmailVerification
} from "firebase/auth";

import { auth, googleProvider, linkedinProvider, db } from "./firebase";
import { doc, setDoc, getDoc, increment, runTransaction } from "firebase/firestore";

/* ================= TYPES ================= */

export interface AuthUser {
  uid: string;
  email: string | null;
  role: "candidate" | "recruiter" | "admin";
  isOnboarded: boolean;
  isPremium?: boolean;
  isStudent?: boolean;
  photoURL?: string;
  displayName?: string;
  emailVerified: boolean;
}

/* ================= SESSION STORAGE KEY ================= */

const SESSION_UID_KEY = "asterix_session_uid";
const SESSION_EMAIL_KEY = "asterix_session_email";
const SESSION_ROLE_KEY = "asterix_session_role";

function writeSession(uid: string, email: string | null, role: string) {
  sessionStorage.setItem(SESSION_UID_KEY, uid);
  sessionStorage.setItem(SESSION_EMAIL_KEY, email ?? "");
  sessionStorage.setItem(SESSION_ROLE_KEY, role);
}

export function readSessionUid(): string | null {
  return sessionStorage.getItem(SESSION_UID_KEY);
}

/* ================= INITIALIZE PERSISTENCE ================= */
// This ensures Firebase auth persists across page refreshes
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error setting persistence:", error);
});

/* ================= AUTH SERVICE ================= */

export const authService = {

  /* ========= EMAIL SIGNUP ========= */
  async signupWithEmail(
    email: string,
    password: string,
    role: "candidate" | "recruiter" | "admin"
  ): Promise<AuthUser> {
    const res = await createUserWithEmailAndPassword(auth, email, password);

    // Initialize user document with default subscription (free plan)
    const userRef = doc(db, "users", res.user.uid);
    const globalStatsRef = doc(db, "jobApplicationCounts", "global");

    await runTransaction(db, async (transaction) => {
      const isRecruiter = role === 'recruiter';
      const now = new Date();
      const twoMonthsFromNow = new Date();
      twoMonthsFromNow.setMonth(now.getMonth() + 2);

      transaction.set(userRef, {
        email: res.user.email,
        role,
        isOnboarded: false,
        isPremium: isRecruiter,
        isStudent: false,
        subscription: {
          plan: isRecruiter ? "premium" : "free",
          status: "active",
          isPremium: isRecruiter,
          isStudent: false,
          startDate: now,
          endDate: isRecruiter ? twoMonthsFromNow : null,
        },
        createdAt: now
      });
      transaction.set(globalStatsRef, { memberCount: increment(1) }, { merge: true });
    });

    writeSession(res.user.uid, res.user.email, role);

    // Send verification email
    await sendEmailVerification(res.user);

    return {
      uid: res.user.uid,
      email: res.user.email,
      role,
      isOnboarded: false,
      isPremium: role === 'recruiter',
      isStudent: false,
      emailVerified: res.user.emailVerified,
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
        isPremium: false,
        isStudent: false,
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
    let role = data?.role || "candidate";

    // HARDCODED ADMIN CHECK
    if (email === "asterixadmin@gmail.com") {
      role = "admin";
      // Update firestore if not already admin
      if (data?.role !== "admin") {
        await setDoc(userRef, { role: "admin" }, { merge: true });
      }
    }

    writeSession(res.user.uid, res.user.email, role);

    return {
      uid: res.user.uid,
      email: res.user.email,
      role,
      isOnboarded: data?.isOnboarded || false,
      isPremium: data?.subscription?.isPremium || false,
      isStudent: data?.subscription?.isStudent || false,
      photoURL: res.user.photoURL || undefined,
      displayName: res.user.displayName || undefined,
      emailVerified: res.user.emailVerified,
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
      const globalStatsRef = doc(db, "jobApplicationCounts", "global");

      await runTransaction(db, async (transaction) => {
        const isRecruiter = role === 'recruiter';
        const now = new Date();
        const twoMonthsFromNow = new Date();
        twoMonthsFromNow.setMonth(now.getMonth() + 2);

        transaction.set(userRef, {
          email: res.user.email,
          role: role || "candidate",
          isOnboarded: false,
          isPremium: isRecruiter,
          isStudent: false,
          subscription: {
            plan: isRecruiter ? "premium" : "free",
            status: "active",
            isPremium: isRecruiter,
            isStudent: false,
            startDate: now,
            endDate: isRecruiter ? twoMonthsFromNow : null,
          },
          createdAt: now
        });
        transaction.set(globalStatsRef, { memberCount: increment(1) }, { merge: true });
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
      isPremium: data?.subscription?.isPremium || false,
      isStudent: data?.subscription?.isStudent || false,
      photoURL: res.user.photoURL || undefined,
      displayName: res.user.displayName || undefined,
      emailVerified: res.user.emailVerified,
    };
  },

  /* ========= GET CURRENT USER ========= */
  async getCurrentUser(): Promise<AuthUser | null> {
    const firebaseUser = auth.currentUser;
    const sessionUid = readSessionUid();
    const uid = firebaseUser?.uid || sessionUid;

    if (!uid) return null;

    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;

    const data = snap.data();
    console.log("[AuthService] Found Firestore data for UID:", uid, "isPremium:", data.subscription?.isPremium || data.isPremium);

    // Ensure sessionStorage is populated even after a refresh
    if (!sessionUid && firebaseUser) {
      writeSession(firebaseUser.uid, firebaseUser.email, data.role);
    }

    return {
      uid,
      email: data.email ?? firebaseUser?.email ?? null,
      role: (data.role === 'admin' || data.email === 'asterixadmin@gmail.com' || firebaseUser?.email === 'asterixadmin@gmail.com') ? 'admin' : data.role,
      isOnboarded: data.isOnboarded || false,
      isPremium: data.subscription?.isPremium || data.isPremium || false,
      isStudent: data.subscription?.isStudent || data.isStudent || false,
      photoURL: firebaseUser?.photoURL || data.photoURL || undefined,
      displayName: firebaseUser?.displayName || data.displayName || undefined,
      emailVerified: firebaseUser?.emailVerified ?? false,
    };
  },

  /* ========= REFRESH USER STATUS ========= */
  async refreshUserStatus(): Promise<void> {
    if (auth.currentUser) {
      console.log("[AuthService] Refreshing user status for:", auth.currentUser.email);
      await auth.currentUser.reload();
    }
  },

  /* ========= RESEND VERIFICATION ========= */
  async resendVerificationEmail() {
    if (auth.currentUser) {
      console.log("[AuthService] Resending verification email to:", auth.currentUser.email);
      await sendEmailVerification(auth.currentUser);
    } else {
      console.warn("[AuthService] Resend failed: No current user authenticated.");
      throw new Error("User session not found. Please log in again.");
    }
  },

  /* ========= UPDATE USER ========= */
  async updateUser(data: Partial<AuthUser>) {
    const uid = readSessionUid() || auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(doc(db, "users", uid), data, { merge: true });
  },

  /* ========= UPDATE SUBSCRIPTION ========= */
  async updateSubscription(subscriptionData: {
    plan: "free" | "premium" | "premium_student";
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


    await setDoc(
      doc(db, "users", uid),
      {
        isPremium: subscriptionData.isPremium ?? false,
        isStudent: subscriptionData.isStudent ?? false,
        subscription: {
          ...subscriptionData,
          updatedAt: new Date(),
        },
      },
      { merge: true }
    );
    console.log("[AuthService] Subscription updated for:", uid, "isPremium:", subscriptionData.isPremium);

  },

  /* ========= LOGOUT ========= */
  async logout() {
    sessionStorage.removeItem(SESSION_UID_KEY);
    sessionStorage.removeItem(SESSION_EMAIL_KEY);
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    await signOut(auth);
  }
};