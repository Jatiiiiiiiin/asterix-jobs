import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../authService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { generateTestQuestions } from '../geminiService';
import { Video, Mic, AlertTriangle, CheckCircle, ShieldAlert, Monitor, LogOut } from 'lucide-react';

interface CampusConnectTestPageProps {
    onToggleTheme: () => void;
    isDarkMode: boolean;
}

interface Question {
    question: string;
    options: string[];
    answer: string;
    type: string;
    difficulty: string;
}

const CampusConnectTestPage: React.FC<CampusConnectTestPageProps> = ({ isDarkMode }) => {
    const navigate = useNavigate();

    // Auth & DB State
    const [userId, setUserId] = useState<string | null>(null);
    const [userSkills, setUserSkills] = useState<string[]>([]);
    const [isBlocked, setIsBlocked] = useState(false);

    // Media & Permissions
    const videoRef = useRef<HTMLVideoElement>(null);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const [hasPermissions, setHasPermissions] = useState(false);

    // Proctoring State
    const [warningCount, setWarningCount] = useState(0);
    const [isFullScreen, setIsFullScreen] = useState(false);

    // Test State
    const [testPhase, setTestPhase] = useState<'setup' | 'loading' | 'active' | 'completed' | 'terminated'>('setup');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [score, setScore] = useState(0);

    // Initial Load & Auth Check
    useEffect(() => {
        const init = async () => {
            const user = await authService.getCurrentUser();
            if (!user) {
                navigate('/');
                return;
            }
            setUserId(user.uid);

            try {
                const snap = await getDoc(doc(db, 'profiles', user.uid));
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.isBlocked) {
                        setTestPhase('terminated');
                        setIsBlocked(true);
                        return;
                    }

                    const skillsObj = data.skills || [];
                    const skillsList = skillsObj.map((s: any) => s.s || s.skill || s);
                    setUserSkills(skillsList.length > 0 ? skillsList : ['General Aptitude']);
                } else {
                    setUserSkills(['General Aptitude']); // Fallback
                }
            } catch (err) {
                console.error("Failed to load profile:", err);
                setUserSkills(['General Aptitude']);
            }
        };
        init();

        // Cleanup media on unmount
        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(t => t.stop());
            }
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.error(err));
            }
        };
    }, []);

    // Proctoring: Visibility Change (Tab Switching)
    useEffect(() => {
        if (testPhase !== 'active') return;

        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'hidden') {
                const newCount = warningCount + 1;
                setWarningCount(newCount);

                if (newCount > 2) {
                    await terminateTest();
                } else {
                    alert(`WARNING: Tab switching detected. Warning ${newCount}/2. Further violations will terminate your test.`);
                }
            }
        };

        const handleFullScreenChange = async () => {
            if (!document.fullscreenElement) {
                setIsFullScreen(false);
                const newCount = warningCount + 1;
                setWarningCount(newCount);

                if (newCount > 2) {
                    await terminateTest();
                } else {
                    alert(`WARNING: You have exited full-screen mode. Warning ${newCount}/2. Please return to full-screen immediately.`);
                }
            } else {
                setIsFullScreen(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullScreenChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullScreenChange);
        };
    }, [testPhase, warningCount]);

    const requestPermissions = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setMediaStream(stream);
            setHasPermissions(true);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Media permission denied", err);
            alert("Camera and Microphone access are mandatory for this proctored test.");
        }
    };

    const startTest = async () => {
        if (!hasPermissions) {
            alert("Please grant camera and microphone permissions first.");
            return;
        }

        try {
            await document.documentElement.requestFullscreen();
            setIsFullScreen(true);
        } catch (err) {
            console.error("Failed to enter fullscreen", err);
            alert("Full screen mode is required. Please allow full-screen access.");
            return;
        }

        setTestPhase('loading');

        // Fetch AI generated test
        const generatedQuestions = await generateTestQuestions(userSkills);
        if (generatedQuestions && generatedQuestions.length > 0) {
            setQuestions(generatedQuestions);
            setTestPhase('active');
        } else {
            alert("Failed to generate test questions. Please try again later.");
            setTestPhase('setup');
        }
    };

    const terminateTest = async () => {
        setTestPhase('terminated');
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(e => console.error(e));
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop());
            setMediaStream(null);
        }

        if (userId) {
            try {
                await setDoc(doc(db, 'profiles', userId), { isBlocked: true }, { merge: true });
                setIsBlocked(true);
            } catch (err) {
                console.error("Error updating blocked status", err);
            }
        }
    };

    const submitTest = async () => {
        setTestPhase('completed');
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(e => console.error(e));
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop());
            setMediaStream(null);
        }

        // Calculate score
        let totalScore = 0;
        questions.forEach((q, idx) => {
            if (answers[idx] === q.answer) {
                totalScore++;
            }
        });
        setScore(totalScore);

        // In a real app we would save the score to Firestore here
    };

    const handleAnswer = (option: string) => {
        setAnswers(prev => ({ ...prev, [currentIndex]: option }));
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            submitTest();
        }
    };

    // Render Sub-Components

    if (testPhase === 'terminated' || isBlocked) {
        return (
            <div className="flex h-screen w-screen bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100 flex-col items-center justify-center p-6 text-center">
                <ShieldAlert className="w-24 h-24 text-red-600 mb-6" />
                <h1 className="text-4xl font-black tracking-tighter mb-4 uppercase">Test Terminated</h1>
                <p className="text-lg font-bold tracking-widest opacity-80 max-w-2xl mb-8 leading-relaxed">
                    We detected multiple severe violations of the proctoring rules (e.g. tab switching, exiting full screen).
                    Your account has been blocked from further testing.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-4 font-black tracking-widest uppercase transition-colors"
                >
                    <LogOut className="w-5 h-5" /> Return to Home
                </button>
            </div>
        );
    }

    if (testPhase === 'setup') {
        return (
            <div className={`flex min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-500`}>
                <div className="max-w-4xl mx-auto w-full p-8 md:p-12 flex flex-col justify-center">

                    <div className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-8 md:p-12 shadow-2xl">
                        <div className="flex items-center gap-4 mb-8 border-b border-slate-200 dark:border-slate-700 pb-6">
                            <Monitor className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                            <h1 className="text-3xl font-black tracking-tighter">Proctored Assessment Setup</h1>
                        </div>

                        <div className="grid md:grid-cols-2 gap-12">
                            <div className="space-y-6">
                                <h2 className="text-sm font-black tracking-widest text-slate-500 uppercase">Testing Rules</h2>
                                <ul className="space-y-4">
                                    <li className="flex gap-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                                        <span className="text-sm font-medium">Full screen mode is strictly enforced. Exiting full screen counts as a violation.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                                        <span className="text-sm font-medium">Do not switch tabs or windows. More than 2 tab switches will result in immediate termination.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <Video className="w-5 h-5 text-indigo-500 shrink-0" />
                                        <span className="text-sm font-medium">Your camera and microphone must remain on and unobstructed.</span>
                                    </li>
                                </ul>

                                <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                                    {hasPermissions ? (
                                        <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
                                            <CheckCircle className="w-5 h-5" />
                                            <span className="text-sm font-bold">Hardware verified. You are ready.</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={requestPermissions}
                                            className="w-full flex items-center justify-center gap-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:invert transition-colors p-4 font-black tracking-widest uppercase text-sm"
                                        >
                                            <Mic className="w-4 h-4" /> <Video className="w-4 h-4" />
                                            Grant Camera & Mic Access
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col items-center justify-center bg-black aspect-video relative overflow-hidden border border-slate-300 dark:border-slate-700 shadow-inner">
                                {hasPermissions ? (
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
                                ) : (
                                    <div className="text-center text-slate-500 space-y-2">
                                        <Video className="w-12 h-12 mx-auto opacity-50" />
                                        <p className="text-xs font-black tracking-widest">CAMERA PREVIEW OFFLINE</p>
                                    </div>
                                )}

                                {hasPermissions && (
                                    <div className="absolute bottom-4 right-4 flex gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-[10px] text-white font-black tracking-widest uppercase shadow-black drop-shadow-md">Recording</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-12 flex justify-end">
                            <button
                                onClick={startTest}
                                disabled={!hasPermissions}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white px-10 py-4 font-black tracking-widest uppercase transition-colors disabled:cursor-not-allowed"
                            >
                                Enter Full Screen & Start Test
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (testPhase === 'loading') {
        return (
            <div className="flex h-screen w-screen bg-slate-900 text-white flex-col items-center justify-center p-6 text-center z-50 fixed inset-0">
                <div className="animate-spin w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full mb-8" />
                <h2 className="text-2xl font-black tracking-widest uppercase">Initializing Neural Sequence</h2>
                <p className="text-indigo-400 mt-4 font-medium tracking-wide">Compiling custom questions based on your profile skills...</p>
            </div>
        );
    }

    if (testPhase === 'completed') {
        return (
            <div className="flex h-screen w-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex-col items-center justify-center p-6 text-center">
                <CheckCircle className="w-24 h-24 text-emerald-500 mb-6" />
                <h1 className="text-4xl font-black tracking-tighter mb-4 uppercase text-emerald-600 dark:text-emerald-400">Test Submitted</h1>

                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 my-8 w-full max-w-sm">
                    <p className="text-sm font-black tracking-widest opacity-50 mb-2 uppercase">Your Final Score</p>
                    <p className="text-6xl font-black text-indigo-600 dark:text-indigo-400">{score} <span className="text-2xl opacity-50">/ {questions.length}</span></p>
                </div>

                <p className="text-sm font-medium tracking-widest opacity-80 mb-8 max-w-md">
                    Your assessment results have been securely recorded. The recruitment team will review your profile shortly.
                </p>

                <button
                    onClick={() => navigate('/candidate')}
                    className="border border-slate-900 dark:border-white px-8 py-4 font-black tracking-widest uppercase hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-colors"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    // Active Test Phase
    const currentQ = questions[currentIndex];

    return (
        <div className="flex flex-col h-screen w-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden select-none">
            {/* Header Toolbar */}
            <header className="flex justify-between items-center px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <Monitor className="w-6 h-6 text-indigo-600" />
                    <span className="text-sm font-black tracking-widest uppercase">Proctored Assessment</span>
                </div>

                {/* PIP Video Feed */}
                <div className="flex items-center gap-4">
                    {warningCount > 0 && (
                        <div className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1 border border-red-200 dark:border-red-800">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-xs font-bold tracking-wider">WARNINGS: {warningCount}/2</span>
                        </div>
                    )}
                    <div className="w-32 h-24 bg-black border-2 border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-lg">
                        <video
                            ref={(el) => {
                                if (el && mediaStream && !el.srcObject) {
                                    el.srcObject = mediaStream;
                                }
                            }}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover mirror"
                        />
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse border border-white" />
                    </div>
                </div>
            </header>

            {/* Test Content Core */}
            <main className="flex-1 flex w-full overflow-hidden relative">

                {/* Left Main Question Area */}
                <div className="flex-1 flex flex-col p-6 md:p-12 overflow-y-auto custom-scrollbar border-r border-slate-200 dark:border-slate-800">
                    {/* Progress Indicators */}
                    <div className="flex justify-between items-end mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
                        <div>
                            <span className="text-[10px] font-black tracking-[0.2em] text-indigo-600 dark:text-indigo-400 uppercase">
                                Question {currentIndex + 1} of {questions.length}
                            </span>
                            <div className="flex gap-2 mt-2">
                                <span className="text-[10px] font-bold tracking-widest opacity-50 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 uppercase">{currentQ?.type}</span>
                                <span className="text-[10px] font-bold tracking-widest opacity-50 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 uppercase">{currentQ?.difficulty}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Total Progress</span>
                            <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-800 mt-2 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-600 transition-all duration-300"
                                    style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Question Area */}
                    <div className="flex-1 max-w-3xl">
                        <h2 className="text-lg md:text-xl font-bold tracking-tight leading-relaxed mb-6">
                            {currentQ?.question}
                        </h2>

                        {currentQ?.type === 'coding' ? (
                            <div className="h-64">
                                <textarea
                                    value={answers[currentIndex] || ''}
                                    onChange={(e) => setAnswers(prev => ({ ...prev, [currentIndex]: e.target.value }))}
                                    className="w-full h-full p-4 border-2 border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none custom-scrollbar"
                                    placeholder="Write your code solution here in any language..."
                                />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {currentQ?.options?.map((opt, i) => {
                                    const isSelected = answers[currentIndex] === opt;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => handleAnswer(opt)}
                                            className={`w-full text-left p-4 border-2 transition-all group relative overflow-hidden ${isSelected
                                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
                                                : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-900'
                                                }`}
                                        >
                                            <div className="flex gap-4">
                                                <div className={`w-5 h-5 mt-0.5 shrink-0 border-2 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-400 dark:border-slate-600 group-hover:border-indigo-400'
                                                    }`}>
                                                    {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                </div>
                                                <span className="text-base font-medium leading-tight">{opt}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Navigation Footer */}
                    <div className="mt-12 flex justify-between max-w-4xl items-center">
                        <button
                            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentIndex === 0}
                            className="bg-transparent border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-8 py-4 font-black tracking-widest uppercase hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors disabled:opacity-30"
                        >
                            Previous
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={!answers[currentIndex]}
                            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-12 py-4 font-black tracking-widest uppercase hover:invert transition-colors disabled:opacity-30 disabled:hover:invert-0"
                        >
                            {currentIndex < questions.length - 1 ? 'Save & Next' : 'Submit Final Test'}
                        </button>
                    </div>
                </div>

                {/* Right Sidebar */}
                <aside className="w-80 flex-shrink-0 bg-slate-50 dark:bg-slate-900/40 p-6 flex flex-col overflow-y-auto">
                    <h3 className="text-xs font-black tracking-[0.1em] uppercase mb-6 opacity-60">Question Navigator</h3>

                    <div className="grid grid-cols-4 gap-3 mb-8">
                        {questions.map((q, idx) => {
                            const isAnswered = !!answers[idx];
                            const isCurrent = currentIndex === idx;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`w-12 h-12 flex items-center justify-center text-sm font-black rounded-lg transition-all ${isCurrent
                                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/30 border-none'
                                        : isAnswered
                                            ? 'bg-emerald-500 text-white border-none'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                        }`}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-auto space-y-4 pt-6 pb-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-emerald-500 rounded" />
                            <span className="text-xs font-semi-bold opacity-70 tracking-wide">Answered</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded" />
                            <span className="text-xs font-semi-bold opacity-70 tracking-wide">Unanswered</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-indigo-600 rounded" />
                            <span className="text-xs font-semi-bold opacity-70 tracking-wide">Current Question</span>
                        </div>

                        <div className="pt-6 mt-4 border-t border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => {
                                    if (window.confirm("Are you sure you want to finally submit the test? You cannot change your answers after this.")) {
                                        submitTest();
                                    }
                                }}
                                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 font-black tracking-widest uppercase hover:invert transition-colors"
                            >
                                Submit Test
                            </button>
                        </div>
                    </div>
                </aside>

            </main>
        </div>
    );
};

export default CampusConnectTestPage;
