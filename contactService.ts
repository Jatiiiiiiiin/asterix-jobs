import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export interface ContactMessage {
    name: string;
    email: string;
    subject: string;
    message: string;
}

export const contactService = {
    async submitContactMessage(data: ContactMessage) {
        try {
            // 1. Save to Firestore
            const contactRef = collection(db, "contact_messages");
            await addDoc(contactRef, {
                ...data,
                createdAt: serverTimestamp(),
            });

            // 2. Send email via backend
            const response = await fetch(`${API_BASE}/contact`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                console.warn("[contactService] Email notification failed, but Firestore entry was created.");
            }

            return { success: true };
        } catch (error) {
            console.error("[contactService] Error submitting contact message:", error);
            throw error;
        }
    },
};
