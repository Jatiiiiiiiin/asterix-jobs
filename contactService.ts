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
        let emailSent = false;
        let firestoreSaved = false;
        let lastError: any = null;

        // 1. Send email via backend (Primary, as it notifies the admin)
        try {
            const response = await fetch(`${API_BASE}/contact`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                emailSent = true;
            } else {
                const errData = await response.json().catch(() => ({}));
                console.error("[contactService] Backend email failed:", errData);
            }
        } catch (error) {
            console.error("[contactService] Error calling backend:", error);
            lastError = error;
        }

        // 2. Save to Firestore (Secondary, for record keeping)
        try {
            const contactRef = collection(db, "contact_messages");
            await addDoc(contactRef, {
                ...data,
                createdAt: serverTimestamp(),
            });
            firestoreSaved = true;
        } catch (error: any) {
            console.warn("[contactService] Firestore write failed (likely permissions):", error.message);
            // If email was sent, we don't throw, we just log the warning
        }

        if (emailSent) {
            return { success: true, firestoreSaved };
        } else {
            throw lastError || new Error("Failed to send message. Please try again later.");
        }
    },
};
