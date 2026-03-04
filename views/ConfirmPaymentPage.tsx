import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { load } from "@cashfreepayments/cashfree-js";
import { authService } from "../authService";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

interface PlanConfig {
    name: string;
    price: string;
    amount: number;
    features: string[];
}

const PLAN_CONFIG: Record<string, PlanConfig> = {
    premium_student: {
        name: "Student Plan",
        price: "₹99",
        amount: 99,
        features: [
            "Auto-apply to 30+ jobs daily",
            "Get noticed by recruiters first",
            "Entry-level profile matches",
            "Manual applications",
            "Priority support",
        ],
    },
    recruiter: {
        name: "Recruiter Pro",
        price: "₹1,999",
        amount: 1999,
        features: [
            "Unlimited job postings",
            "Advanced candidate matching",
            "AI-powered screening",
            "Analytics dashboard",
            "Interview scheduling",
        ],
    },
};

interface ConfirmPaymentPageProps {
    onPaymentSuccess: () => void;
    onToggleTheme?: () => void;
    isDarkMode?: boolean;
}

const ConfirmPaymentPage: React.FC<ConfirmPaymentPageProps> = ({ onPaymentSuccess }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cashfree, setCashfree] = useState<any>(null);

    const selectedPlanId = localStorage.getItem("selected_plan") || "premium_student";
    const plan = PLAN_CONFIG[selectedPlanId] || PLAN_CONFIG.premium_student;

    useEffect(() => {
        const initSDK = async () => {
            try {
                const cfMode = (import.meta.env.VITE_CASHFREE_MODE || "sandbox") as "sandbox" | "production";
                const cf = await load({ mode: cfMode });
                setCashfree(cf);
            } catch (err) {
                console.error("Failed to load Cashfree SDK", err);
                setError("Payment gateway initialization failed.");
            }
        };
        initSDK();
    }, []);

    // Handle UI for verification if order_id is present
    useEffect(() => {
        const orderId = searchParams.get("order_id");
        if (orderId) {
            setIsLoading(true);
        }
    }, [searchParams]);

    const handlePayment = async () => {
        if (!cashfree) return;
        setIsLoading(true);
        setError(null);

        try {
            const user = await authService.getCurrentUser();
            if (!user) throw new Error("Please log in again.");

            // Fetch phone from Firestore profile
            let customerPhone = "9999999999"; // fallback
            try {
                const profileSnap = await getDoc(doc(db, "profiles", user.uid));
                if (profileSnap.exists()) {
                    const contactPhone = profileSnap.data()?.contact?.phone;
                    if (contactPhone && contactPhone.trim()) {
                        // Strip non-numeric except leading +
                        customerPhone = contactPhone.replace(/[^\d+]/g, "");
                    }
                }
            } catch (profileErr) {
                console.warn("[Payment] Could not fetch phone from profile, using fallback.");
            }

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/payments/create-order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: plan.amount,
                    customer_id: user.uid,
                    customer_email: user.email || "test@example.com",
                    customer_phone: customerPhone,
                    customer_name: user.displayName || "Customer",
                }),
            });

            const data = await response.json();
            if (data.status === "success" && data.payment_session_id) {
                cashfree.checkout({
                    paymentSessionId: data.payment_session_id,
                    redirectTarget: "_self", // Redirect to same page for return_url handling
                });
            } else {
                throw new Error(data.message || "Failed to create payment session.");
            }
        } catch (err: any) {
            setError(err.message || "Payment initiation failed.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden relative">
            {/* Background Glow */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />

            {/* Header */}
            <header className="p-6 md:px-12 flex justify-between items-center z-10 backdrop-blur-md border-b border-white/5">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
                    <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-black rounded-sm">
                        ✦
                    </div>
                    <span className="font-black text-sm tracking-widest">Asterix</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 z-10">
                <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                    {/* Left Side: Plan Info */}
                    <div className="space-y-8">
                        <div className="inline-block px-4 py-1.5 rounded-full border border-purple-500/50 bg-purple-500/10 text-purple-400 text-[10px] font-black tracking-widest">
                            Selected Configuration
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none italic">
                                {plan.name.split(' ')[0]}<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                                    {plan.name.split(' ')[1]}
                                </span>
                            </h1>
                            <p className="text-gray-400 font-medium tracking-wide max-w-sm">
                                Unlock full neural capabilities and priority mandate access.
                            </p>
                        </div>

                        <ul className="space-y-4">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-center gap-3 group">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[12px] text-emerald-400">check</span>
                                    </div>
                                    <span className="text-sm font-bold tracking-widest text-gray-300 group-hover:text-white transition-colors">
                                        {feature}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right Side: Payment Card */}
                    <div className="relative">
                        {/* Glass Card */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-[32px] shadow-2xl space-y-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5 font-black text-8xl pointer-events-none">
                                {plan.amount}
                            </div>

                            <div className="space-y-1">
                                <p className="text-[10px] font-black tracking-[0.3em] text-gray-400">Total Commitment</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-6xl font-black tracking-tighter">{plan.price}</span>
                                    <span className="text-gray-400 font-bold tracking-widest text-xs">/month</span>
                                </div>
                            </div>

                            <div className="h-px bg-white/10" />

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-xs font-bold tracking-widest text-center">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handlePayment}
                                disabled={isLoading || !cashfree}
                                className="w-full relative group"
                            >
                                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative px-8 py-5 bg-white text-black rounded-2xl font-black tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50">
                                    {isLoading ? (
                                        <span className="material-symbols-outlined animate-spin">refresh</span>
                                    ) : (
                                        <span className="material-symbols-outlined">bolt</span>
                                    )}
                                    {searchParams.get("order_id") ? "Verifying Transaction..." : isLoading ? "Synchronizing..." : `Secure Payment`}
                                </div>
                            </button>

                            <div className="flex flex-col items-center gap-4">
                                <div className="flex items-center gap-6 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
                                    <span className="text-[10px] font-black">VISA</span>
                                    <span className="text-[10px] font-black">MASTERCARD</span>
                                    <span className="text-[10px] font-black">UPI</span>
                                </div>
                                <p className="text-[9px] font-black tracking-[0.3em] text-gray-500 text-center">
                                    Encrypted via Cashfree PG • PCI-DSS Compliant
                                </p>
                            </div>
                        </div>

                        {/* Back Button */}
                        <button
                            onClick={() => navigate(-1)}
                            className="mt-6 w-full text-[10px] font-black tracking-[0.4em] text-gray-500 hover:text-white transition-colors"
                        >
                            ← Cancel Operation
                        </button>
                    </div>
                </div>
            </main>

            <footer className="p-8 text-center text-[8px] font-black tracking-[0.5em] text-gray-600">
                Asterix Protocol V4.2.0 • Session ID: {Math.random().toString(36).substring(7).toUpperCase()}
            </footer>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        :root { font-family: 'Space Grotesk', sans-serif; }
      `}</style>
        </div>
    );
};

export default ConfirmPaymentPage;

