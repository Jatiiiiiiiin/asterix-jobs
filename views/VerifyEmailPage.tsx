import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../authService';
import { auth } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface VerifyEmailPageProps {
    onVerified?: () => void;
}

const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ onVerified }) => {
    const navigate = useNavigate();
    const [isResending, setIsResending] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        let pollInterval: NodeJS.Timeout;

        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("[Verification] User Hydrated:", user.email);
                setUserEmail(user.email);

                // --- AUTOMATIC POLLING ---
                // Start/Restart interval when user is found
                if (pollInterval) clearInterval(pollInterval);

                pollInterval = setInterval(async () => {
                    try {
                        // Force reload user data from Firebase servers
                        await user.reload();

                        if (user.emailVerified) {
                            console.log("[Verification] Email verified! Triggering success...");
                            clearInterval(pollInterval);
                            if (onVerified) {
                                onVerified();
                            } else {
                                window.location.reload();
                            }
                        }
                    } catch (err) {
                        console.error("[Verification] Polling error:", err);
                    }
                }, 3000);
            }
        });

        return () => {
            unsub();
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [onVerified]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setError('');
        try {
            await authService.refreshUserStatus();

            if (auth.currentUser?.emailVerified) {
                if (onVerified) {
                    onVerified();
                } else {
                    window.location.reload();
                }
            } else {
                setError('Email still not verified. Please check your inbox.');
            }
        } catch (err: any) {
            console.error('Refresh error:', err);
            setError('Failed to refresh status. Please try again.');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleResend = async () => {
        setIsResending(true);
        setMessage('');
        setError('');
        try {
            await authService.resendVerificationEmail();
            setMessage('Verification email sent! Please check your inbox.');
        } catch (err: any) {
            console.error('Error resending email:', err);
            setError('Failed to resend email. Please try again later.');
        } finally {
            setIsResending(false);
        }
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await authService.logout();
            navigate('/signup', { replace: true });
        } catch (err: any) {
            console.error('Logout error:', err);
            setError('Failed to sign out. Please try refreshing.');
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-background-dark flex flex-col items-center justify-center p-6 space-y-10 animate-in fade-in duration-700">
            <div className="absolute inset-0 pointer-events-none opacity-5">
                <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, black 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
            </div>

            <div className="w-full max-w-[500px] border-2 border-black dark:border-white p-8 md:p-12 z-20 bg-white dark:bg-background-dark space-y-8 shadow-[20px_20px_0px_rgba(0,0,0,0.05)] dark:shadow-[20px_20px_0px_rgba(255,255,255,0.02)] text-center">
                <div className="bg-black dark:bg-white size-16 mx-auto flex items-center justify-center text-white dark:text-black mb-6">
                    <span className="material-symbols-outlined text-4xl font-black">mark_email_unread</span>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl md:text-4xl font-black  tracking-tighter leading-none">
                        Verify Your Identity
                    </h1>
                    {userEmail && (
                        <p className="text-[10px] font-black  tracking-widest text-emerald-500">
                            Sent to: {userEmail}
                        </p>
                    )}
                </div>

                <p className="text-[12px] font-bold  tracking-widest opacity-60 leading-relaxed">
                    Operational access requires a verified email address. We've sent a neural link to your inbox.
                </p>

                {/* Spam Warning Callout */}
                <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-500/30 p-4 space-y-2 text-left">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <span className="material-symbols-outlined text-sm font-black">warning</span>
                        <span className="text-[10px] font-black  tracking-widest">Spam Alert</span>
                    </div>
                    <p className="text-[11px] font-bold  tracking-wide text-amber-700/80 dark:text-amber-300/80 leading-snug">
                        Mails may land in your <span className="underline decoration-2 underline-offset-2">Spam / Junk folder</span>. Please check there if you don't see it within 60 seconds.
                    </p>
                </div>

                {message && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded text-[10px] font-black  tracking-widest text-green-700 dark:text-green-300">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded text-[10px] font-black  tracking-widest text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}

                <div className="space-y-4 pt-4">
                    <button
                        onClick={handleResend}
                        disabled={isResending}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-4 font-black  tracking-[0.4em] text-[10px] hover:invert transition-all disabled:opacity-40 flex items-center justify-center gap-3"
                    >
                        {isResending ? 'Sending Link...' : 'Resend Verification Link'}
                        <span className="material-symbols-outlined text-base">send</span>
                    </button>

                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="w-full border border-black dark:border-white py-4 font-black  tracking-[0.4em] text-[10px] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all flex items-center justify-center gap-3 disabled:opacity-40"
                    >
                        {isRefreshing ? 'Checking Status...' : "I've Verified My Email"}
                        <span className="material-symbols-outlined text-base">sync</span>
                    </button>
                </div>

                <div className="pt-6 border-t border-black/5 dark:border-white/5">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="text-[10px] font-black  tracking-widest opacity-40 hover:opacity-100 transition-opacity flex items-center justify-center gap-2 mx-auto"
                    >
                        <span className="material-symbols-outlined text-sm">logout</span>
                        Wrong email? Sign out & Fix it
                    </button>
                </div>
            </div>

            <p className="text-[8px] font-black  tracking-[0.4em] opacity-20 z-20">
                © 2024 Asterix-find. Identity Protocol: V.0.9.1
            </p>
        </div>
    );
};

export default VerifyEmailPage;
