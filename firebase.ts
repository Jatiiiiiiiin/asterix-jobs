import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB5eoWgef1xBy9ZSdCX4UZtqCEFDYDp0xw",
  authDomain: "asterix-find.firebaseapp.com",
  projectId: "asterix-find",
  storageBucket: "asterix-find.appspot.com",
  messagingSenderId: "1061504941512",
  appId: "1:1061504941512:web:ec4755f40f5b3fc37094fd",
  measurementId: "G-RB0W99G85Y"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const linkedinProvider = new GoogleAuthProvider();
