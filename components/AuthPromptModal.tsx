import { useNavigate } from 'react-router-dom';
import BrandLogo from './BrandLogo';


interface AuthPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthPromptModal: React.FC<AuthPromptModalProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#0a0a0a] border-2 border-black dark:border-white w-full max-w-md p-8 md:p-12 shadow-[20px_20px_0px_rgba(0,0,0,0.1)] dark:shadow-[20px_20px_0px_rgba(255,255,255,0.05)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>

                <div className="space-y-8 relative z-10">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-emerald-500">
                            <BrandLogo className="size-8" />
                            <span className="text-[10px] font-black tracking-[0.4em] uppercase">Security Protocol</span>
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-[0.85]">
                            READY TO <span className="text-emerald-500">APPLY?</span>
                        </h2>
                        <p className="text-sm font-bold tracking-tight text-black/60 dark:text-white/60 leading-relaxed">
                            Join 2,400+ members and unlock AI Mission Audits, Career Calibration, and fast-track job match routing.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => navigate('/signup')}
                            className="w-full bg-black dark:bg-white text-white dark:text-black py-4 text-[11px] font-black tracking-[0.2em] uppercase hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                        >
                            Create Identity
                        </button>
                        <button
                            onClick={() => navigate('/signup')}
                            className="w-full border-2 border-black dark:border-white text-black dark:text-white py-4 text-[11px] font-black tracking-[0.2em] uppercase hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                        >
                            Existing Member
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full text-[9px] font-black tracking-widest text-black/30 dark:text-white/30 uppercase hover:text-black dark:hover:text-white transition-colors"
                    >
                        Continue Browsing as Guest
                    </button>
                </div>

                {/* Aesthetic Background Elements */}
                <div className="absolute -bottom-10 -right-10 size-40 border border-black/[0.05] dark:border-white/[0.05] rounded-full group-hover:scale-110 transition-transform duration-700"></div>
                <div className="absolute -top-10 -left-10 size-24 border border-black/[0.05] dark:border-white/[0.05] rotate-45 group-hover:rotate-90 transition-transform duration-1000"></div>
            </div>
        </div>
    );
};

export default AuthPromptModal;
