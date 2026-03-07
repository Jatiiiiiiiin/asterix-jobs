import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { COLLEGES } from '../data/colleges';
import { School, CheckCircle2 } from 'lucide-react';

interface CampusConnectPageProps {
    onToggleTheme: () => void;
    isDarkMode: boolean;
}

const CampusConnectPage: React.FC<CampusConnectPageProps> = ({ onToggleTheme, isDarkMode }) => {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedCollege, setSelectedCollege] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleProceed = () => {
        setError('');

        if (!selectedCollege) {
            setError('Please select your college from the dropdown.');
            return;
        }

        const college = COLLEGES.find(c => c.name === selectedCollege);

        if (!college) {
            setError('Invalid college selection.');
            return;
        }

        if (college.code !== code.join('')) {
            setError('The 6-digit code entered is incorrect for this college.');
            return;
        }

        setSuccess(true);
        setTimeout(() => {
            navigate('/candidate/test');
        }, 1500);
    };

    const handleCodeChange = (index: number, value: string) => {
        const char = value.slice(-1).replace(/\D/g, '');
        const newCode = [...code];
        newCode[index] = char;
        setCode(newCode);
        setError('');

        if (char && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pastedData) {
            const newCode = [...code];
            for (let i = 0; i < pastedData.length; i++) {
                newCode[i] = pastedData[i];
            }
            setCode(newCode);
            setError('');

            const nextIndex = Math.min(pastedData.length, 5);
            inputRefs.current[nextIndex]?.focus();
        }
    };

    return (
        <div className="flex h-screen bg-white dark:bg-background-dark text-black dark:text-white transition-colors duration-500 overflow-hidden">
            <Sidebar role="candidate" isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

            <main className="flex-1 overflow-y-auto border-l border-black dark:border-white/10 p-4 md:p-8 lg:p-12 custom-scrollbar flex flex-col items-center justify-center">

                {!success ? (
                    <div className="w-full max-w-lg space-y-8 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-8 md:p-12">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <School className="w-16 h-16 opacity-80" />
                            <div>
                                <h1 className="text-3xl font-black tracking-tighter leading-tight mb-2">Campus Connect</h1>
                                <p className="text-xs font-black tracking-widest opacity-40">ENTER YOUR COLLEGE ACCESS CODE TO BEGIN THE TEST</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black tracking-widest opacity-60">SELECT COLLEGE</label>
                                <select
                                    value={selectedCollege}
                                    onChange={(e) => {
                                        setSelectedCollege(e.target.value);
                                        setError('');
                                    }}
                                    className="w-full bg-white dark:bg-black border border-black/20 dark:border-white/20 p-4 text-sm font-medium outline-none focus:border-black dark:focus:border-white appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>Choose your college...</option>
                                    {COLLEGES.map(c => (
                                        <option key={c.name} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black tracking-widest opacity-60 text-center block w-full">ACCESS CODE</label>
                                <div className="flex justify-between gap-2 max-w-sm mx-auto" onPaste={handlePaste}>
                                    {code.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            ref={(el) => { inputRefs.current[idx] = el; }}
                                            type="text"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleCodeChange(idx, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(idx, e)}
                                            className="w-12 h-14 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-xl text-center text-2xl font-black outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                                        />
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 text-xs font-black tracking-widest text-center">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleProceed}
                                className="w-full bg-black dark:bg-white text-white dark:text-black hover:invert transition-all p-4 text-sm font-black tracking-widest uppercase mt-4"
                            >
                                Continue to Test
                            </button>
                        </div>

                        <p className="text-[9px] font-black tracking-[0.2em] opacity-30 text-center uppercase">
                            Codes are provided by your university placement cell or admin panel.
                        </p>
                    </div>
                ) : (
                    <div className="w-full max-w-lg flex flex-col items-center text-center space-y-6 bg-emerald-500/5 border border-emerald-500/20 p-12">
                        <CheckCircle2 className="w-24 h-24 text-emerald-500" />
                        <h2 className="text-3xl font-black tracking-tighter text-emerald-600 dark:text-emerald-400">ACCESS GRANTED</h2>
                        <p className="text-sm font-black tracking-widest opacity-70">
                            Your college ({selectedCollege}) has been successfully verified.
                        </p>
                        <p className="text-xs font-medium tracking-widest opacity-50 mt-4">
                            Proceeding to the test module...
                        </p>
                        <button
                            onClick={() => {
                                setSuccess(false);
                                setCode(['', '', '', '', '', '']);
                                setSelectedCollege('');
                            }}
                            className="mt-8 border border-black dark:border-white px-6 py-3 text-xs font-black tracking-widest hover:invert transition-all"
                        >
                            Back
                        </button>
                    </div>
                )}

            </main>
        </div>
    );
};

export default CampusConnectPage;
