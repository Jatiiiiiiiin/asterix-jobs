import React, { useState, useEffect } from "react";
import {
    Layout,
    Plus,
    LogOut,
    Sun,
    Moon,
    Globe,
    Briefcase,
    Building2,
    MapPin,
    DollarSign,
    Search,
    ExternalLink,
    Trash2,
    FileText,
    School,
    ShieldAlert,
    Unlock,
    BarChart2,
    Download
} from "lucide-react";
import { db, auth } from "../firebase";
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    deleteDoc,
    doc,
    setDoc,
    serverTimestamp,
    updateDoc,
    orderBy
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { authService } from "../authService";
import { LiveJob } from "../Jobservice";
import { parseJobDescription } from "../geminiService";
import { COLLEGES } from "../data/colleges";

interface AdminPortalProps {
    onToggleTheme: () => void;
    isDarkMode: boolean;
}

const DEPARTMENTS = ['Engineering', 'Design', 'Product', 'Operations', 'Marketing', 'Sales', 'Finance', 'Legal'];
const EMP_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Freelance', 'Internship'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'SGD', 'AUD'];

const AdminPortal: React.FC<AdminPortalProps> = ({ onToggleTheme, isDarkMode }) => {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState<LiveJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);
    const [activeTab, setActiveTab] = useState<'jobs' | 'codes' | 'blocked' | 'results'>('jobs');
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [testResults, setTestResults] = useState<any[]>([]);
    const [selectedCollege, setSelectedCollege] = useState('All');

    // AI Parsing State
    const [rawJD, setRawJD] = useState("");
    const [isParsing, setIsParsing] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: "",
        companyName: "",
        city: "",
        type: "On-site",
        employmentType: "Full-Time",
        salaryMin: "",
        salaryMax: "",
        currency: "INR",
        externalUrl: "",
        jobSummary: "",
        department: "Engineering",
        experienceRequired: "",
        openings: "1",
        responsibilities: "",
        requiredSkills: "",
        preferredSkills: "",
        techStack: "",
        benefits: "",
        applicationDeadline: "",
        matchThreshold: 75,
    });

    useEffect(() => {
        const q = query(collection(db, "jobs"), where("isAdminPosted", "==", true));
        const unsub = onSnapshot(q, (snap) => {
            const fetchedJobs = snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveJob));
            setJobs(fetchedJobs.sort((a, b) => (b.postedDate || "").localeCompare(a.postedDate || "")));
            setIsLoading(false);
        });
        return unsub;
    }, []);

    useEffect(() => {
        const q = query(collection(db, "profiles"), where("isBlocked", "==", true));
        const unsub = onSnapshot(q, (snap) => {
            const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setBlockedUsers(fetched);
        });
        return unsub;
    }, []);

    // Subscribe to test results, sorted score desc
    useEffect(() => {
        const q = query(collection(db, "test_results"), orderBy("scorePercent", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTestResults(rows);
        });
        return unsub;
    }, []);

    // CSV Export — grouped by college, sorted high→low within each group
    const downloadCSV = (results: any[]) => {
        // Sort a copy high→low
        const sorted = [...results].sort((a, b) => (b.scorePercent ?? 0) - (a.scorePercent ?? 0));

        // Group by college
        const grouped: Record<string, any[]> = {};
        sorted.forEach(r => {
            const key = r.college || 'Unknown';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(r);
        });

        const escCSV = (v: any) => {
            const s = String(v ?? '').replace(/"/g, '""');
            return `"${s}"`;
        };

        const header = ['Rank', 'Name', 'Email', 'College', 'Score (%)', 'Correct / Total', 'Skills', 'Resume URL', 'Submitted'];
        const lines: string[] = [header.map(escCSV).join(',')];

        Object.entries(grouped).forEach(([college, rows]) => {
            // College separator row
            lines.push(`"--- ${college} ---",,,,,,,,`);
            rows.forEach((r, idx) => {
                const submittedAt = r.submittedAt?.toDate
                    ? r.submittedAt.toDate().toLocaleString('en-IN')
                    : '';

                // Truncate Base64 to avoid bloating CSV
                const cleanResumeUrl = r.resumeUrl?.startsWith('data:')
                    ? 'Resume Included (Base64)'
                    : r.resumeUrl;

                lines.push([
                    escCSV(idx + 1),
                    escCSV(r.name),
                    escCSV(r.email),
                    escCSV(r.college),
                    escCSV(r.scorePercent ?? 0),
                    escCSV(`${r.score ?? 0} / ${r.totalQuestions ?? 0}`),
                    escCSV(Array.isArray(r.skills) ? r.skills.join(', ') : r.skills),
                    escCSV(cleanResumeUrl),
                    escCSV(submittedAt)
                ].join(','));
            });
        });

        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `campus_connect_results_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleUnblock = async (id: string) => {
        if (window.confirm("Are you sure you want to unblock this user?")) {
            try {
                // Use setDoc with merge in case updateDoc has some field issues
                await setDoc(doc(db, "profiles", id), { isBlocked: false }, { merge: true });
                alert("Candidate unblocked successfully.");
            } catch (err: any) {
                console.error(err);
                alert(`Failed to unblock: ${err.message}`);
            }
        }
    };

    const handleLogout = async () => {
        await authService.logout();
        navigate("/", { replace: true });
    };

    const splitLines = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean);
    const splitCommas = (s: string) => s.split(',').map(l => l.trim()).filter(Boolean);

    const handleParseJD = async () => {
        if (!rawJD.trim()) {
            alert("Please paste a job description first.");
            return;
        }
        setIsParsing(true);
        try {
            const parsed = await parseJobDescription(rawJD);
            if (parsed && !parsed.status) {
                setFormData(prev => ({
                    ...prev,
                    title: parsed.title || prev.title,
                    companyName: parsed.companyName || prev.companyName,
                    city: parsed.city || prev.city,
                    employmentType: parsed.employmentType || prev.employmentType,
                    experienceRequired: parsed.experienceRequired || prev.experienceRequired,
                    openings: parsed.openings || prev.openings,
                    jobSummary: parsed.jobSummary || prev.jobSummary,
                    responsibilities: Array.isArray(parsed.responsibilities) && parsed.responsibilities.length > 0 ? parsed.responsibilities.join('\n') : prev.responsibilities,
                    requiredSkills: Array.isArray(parsed.requiredSkills) && parsed.requiredSkills.length > 0 ? parsed.requiredSkills.join(', ') : prev.requiredSkills,
                    preferredSkills: Array.isArray(parsed.preferredSkills) && parsed.preferredSkills.length > 0 ? parsed.preferredSkills.join(', ') : prev.preferredSkills,
                    techStack: Array.isArray(parsed.techStack) && parsed.techStack.length > 0 ? parsed.techStack.join(', ') : (Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills.join(', ') : prev.techStack),
                    benefits: Array.isArray(parsed.benefits) && parsed.benefits.length > 0 ? parsed.benefits.join('\n') : prev.benefits,
                }));
                alert("Auto-filled fields successfully!");
            } else {
                alert("Failed to extract data: " + (parsed?.message || "Unknown error"));
            }
        } catch (err) {
            console.error("Failed to parse JD:", err);
            alert("Network error. Could not parse Job Description.");
        } finally {
            setIsParsing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsPosting(true);

        try {
            const newJob = {
                title: formData.title.trim(),
                department: formData.department,
                employmentType: formData.employmentType,
                company: {
                    name: formData.companyName.trim(),
                    industry: "Technology",
                },
                location: {
                    city: formData.city.trim(),
                    type: formData.type,
                    remoteAllowed: formData.type.toLowerCase().includes("remote"),
                },
                salaryRange: {
                    min: formData.salaryMin ? parseInt(formData.salaryMin) : null,
                    max: formData.salaryMax ? parseInt(formData.salaryMax) : null,
                    currency: formData.currency,
                },
                openings: parseInt(formData.openings) || 1,
                experienceRequired: formData.experienceRequired.trim(),
                jobSummary: formData.jobSummary.trim(),
                responsibilities: splitLines(formData.responsibilities),
                requiredSkills: splitCommas(formData.requiredSkills),
                preferredSkills: splitCommas(formData.preferredSkills),
                techStack: splitCommas(formData.techStack),
                benefits: splitLines(formData.benefits),
                matchThreshold: formData.matchThreshold,
                applicationDeadline: formData.applicationDeadline || null,
                externalUrl: formData.externalUrl.trim(),
                isAdminPosted: true,
                recruiterId: auth.currentUser?.uid || "admin",
                status: "active",
                postedDate: new Date().toISOString().split('T')[0],
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, "jobs"), newJob);

            // Reset form
            setFormData({
                title: "",
                companyName: "",
                city: "",
                type: "On-site",
                employmentType: "Full-Time",
                salaryMin: "",
                salaryMax: "",
                currency: "INR",
                externalUrl: "",
                jobSummary: "",
                department: "Engineering",
                experienceRequired: "",
                openings: "1",
                responsibilities: "",
                requiredSkills: "",
                preferredSkills: "",
                techStack: "",
                benefits: "",
                applicationDeadline: "",
                matchThreshold: 75,
            });
            alert("Job posted successfully!");
        } catch (err) {
            console.error("Error posting job:", err);
            alert("Failed to post job.");
        } finally {
            setIsPosting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Delete this job?")) {
            await deleteDoc(doc(db, "jobs", id));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
            {/* Header */}
            <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#826BF0] rounded-lg">
                        <Globe className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Asterix Admin</h1>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={onToggleTheme}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Post Job Form */}
                <div className="lg:col-span-5">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Plus className="w-5 h-5 text-[#826BF0]" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Post Admin Job</h2>
                        </div>

                        {/* AI Auto-Fill Section */}
                        <div className="mb-8 p-5 bg-[#826BF0]/10 dark:bg-[#826BF0]/5 border border-[#826BF0]/20 dark:border-[#826BF0]/20 rounded-xl space-y-4">
                            <h3 className="text-sm font-bold text-[#826BF0] flex items-center gap-2">
                                <Sun className="w-4 h-4" /> AI Auto-Fill
                            </h3>
                            <textarea
                                rows={4}
                                value={rawJD}
                                onChange={e => setRawJD(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-[#826BF0]/20 dark:border-[#826BF0]/20 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none text-sm placeholder:text-gray-400"
                                placeholder='Paste whole "About the Role" or Job Description here to auto-fill fields...'
                            />
                            <button
                                type="button"
                                onClick={handleParseJD}
                                disabled={isParsing || !rawJD.trim()}
                                className="w-full bg-[#826BF0]/10 hover:bg-[#826BF0]/20 dark:bg-[#826BF0]/20 dark:hover:bg-[#826BF0]/30 text-[#826BF0] font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
                            >
                                {isParsing ? "Extracting Details..." : "Extract & Auto-Fill Fields"}
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Role Identity */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Role Identity</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Title *</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        placeholder="Senior Software Engineer"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                                        <select
                                            value={formData.department}
                                            onChange={e => setFormData({ ...formData, department: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        >
                                            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employment Type</label>
                                        <select
                                            value={formData.employmentType}
                                            onChange={e => setFormData({ ...formData, employmentType: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        >
                                            {EMP_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Experience Required</label>
                                        <input
                                            type="text"
                                            value={formData.experienceRequired}
                                            onChange={e => setFormData({ ...formData, experienceRequired: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                            placeholder="3-5 years"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Openings</label>
                                        <input
                                            type="number"
                                            value={formData.openings}
                                            onChange={e => setFormData({ ...formData, openings: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Company & Link */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Company & Application</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name *</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.companyName}
                                        onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        placeholder="Google"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City *</label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.city}
                                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                            placeholder="Bangalore"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Work Type</label>
                                        <select
                                            value={formData.type}
                                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        >
                                            <option>On-site</option>
                                            <option>Remote</option>
                                            <option>Hybrid</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">External Apply Link *</label>
                                    <input
                                        required
                                        type="url"
                                        value={formData.externalUrl}
                                        onChange={e => setFormData({ ...formData, externalUrl: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>

                            {/* Compensation */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Compensation</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min</label>
                                        <input
                                            type="number"
                                            value={formData.salaryMin}
                                            onChange={e => setFormData({ ...formData, salaryMin: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max</label>
                                        <input
                                            type="number"
                                            value={formData.salaryMax}
                                            onChange={e => setFormData({ ...formData, salaryMax: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
                                        <select
                                            value={formData.currency}
                                            onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        >
                                            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Skills & Stack */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Skills & Stack</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Required Skills (comma-separated) *</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.requiredSkills}
                                        onChange={e => setFormData({ ...formData, requiredSkills: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        placeholder="React, TypeScript, Node.js"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preferred Skills</label>
                                    <input
                                        type="text"
                                        value={formData.preferredSkills}
                                        onChange={e => setFormData({ ...formData, preferredSkills: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        placeholder="GraphQL, Docker"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tech Stack</label>
                                    <input
                                        type="text"
                                        value={formData.techStack}
                                        onChange={e => setFormData({ ...formData, techStack: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        placeholder="AWS, PostgreSQL"
                                    />
                                </div>
                            </div>

                            {/* Description & Details */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Role Description</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary *</label>
                                    <textarea
                                        required
                                        rows={3}
                                        value={formData.jobSummary}
                                        onChange={e => setFormData({ ...formData, jobSummary: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                        placeholder="High-level overview..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Responsibilities (one per line)</label>
                                    <textarea
                                        rows={4}
                                        value={formData.responsibilities}
                                        onChange={e => setFormData({ ...formData, responsibilities: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder={"Build scalable APIs\nLead project modules"}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Benefits (one per line)</label>
                                    <textarea
                                        rows={3}
                                        value={formData.benefits}
                                        onChange={e => setFormData({ ...formData, benefits: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder={"Health Insurance\nRemote work support"}
                                    />
                                </div>
                            </div>

                            {/* Settings */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Settings</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Application Deadline</label>
                                    <input
                                        type="date"
                                        value={formData.applicationDeadline}
                                        onChange={e => setFormData({ ...formData, applicationDeadline: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Match Threshold</label>
                                        <span className="text-sm font-bold text-[#826BF0]">{formData.matchThreshold}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={formData.matchThreshold}
                                        onChange={e => setFormData({ ...formData, matchThreshold: parseInt(e.target.value) })}
                                        className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#826BF0]"
                                    />
                                </div>
                            </div>

                            <button
                                disabled={isPosting}
                                type="submit"
                                className="w-full bg-[#826BF0] hover:bg-[#826BF0]/90 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-[#826BF0]/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isPosting ? "Publishing Protocol..." : "Activate Admin Listing"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Column: Content Area */}
                <div className="lg:col-span-7 space-y-6">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 border-b border-gray-200 dark:border-slate-700 pb-2 flex-wrap">
                        <button
                            onClick={() => setActiveTab('jobs')}
                            className={`flex items-center gap-2 px-4 py-2 font-semibold transition-colors border-b-2 ${activeTab === 'jobs' ? 'text-[#826BF0] border-[#826BF0]' : 'text-gray-500 border-transparent hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                        >
                            <Briefcase className="w-5 h-5" />
                            Active Jobs ({jobs.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('codes')}
                            className={`flex items-center gap-2 px-4 py-2 font-semibold transition-colors border-b-2 ${activeTab === 'codes' ? 'text-[#826BF0] border-[#826BF0]' : 'text-gray-500 border-transparent hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                        >
                            <School className="w-5 h-5" />
                            Campus Codes
                        </button>
                        <button
                            onClick={() => setActiveTab('blocked')}
                            className={`flex items-center gap-2 px-4 py-2 font-semibold transition-colors border-b-2 ${activeTab === 'blocked' ? 'text-[#826BF0] border-[#826BF0]' : 'text-gray-500 border-transparent hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                        >
                            <ShieldAlert className="w-5 h-5" />
                            Blocked Candidates
                        </button>
                        <button
                            onClick={() => setActiveTab('results')}
                            className={`flex items-center gap-2 px-4 py-2 font-semibold transition-colors border-b-2 ${activeTab === 'results' ? 'text-[#826BF0] border-[#826BF0]' : 'text-gray-500 border-transparent hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                        >
                            <BarChart2 className="w-5 h-5" />
                            Test Results {testResults.length > 0 && <span className="ml-1 text-xs bg-[#826BF0] text-white rounded-full px-1.5 py-0.5">{testResults.length}</span>}
                        </button>
                    </div>

                    {activeTab === 'jobs' ? (
                        <>
                            {isLoading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-32 bg-gray-200 dark:bg-slate-800 animate-pulse rounded-2xl" />
                                    ))}
                                </div>
                            ) : jobs.length === 0 ? (
                                <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">
                                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-500 dark:text-gray-400">No admin jobs posted yet.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {jobs.map(job => (
                                        <div key={job.id} className="group bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all">
                                            <div className="flex justify-between items-start">
                                                <div className="flex gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                                                        <Building2 className="w-6 h-6 text-[#826BF0]" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{job.title}</h3>
                                                        <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                            {typeof job.company === 'string' ? job.company : job.company.name} • {typeof job.location === 'string' ? job.location : job.location.city}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <a
                                                        href={job.externalUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-[#826BF0] hover:bg-[#826BF0]/10 dark:hover:bg-[#826BF0]/20 rounded-lg"
                                                    >
                                                        <ExternalLink className="w-5 h-5" />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDelete(job.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
                                                <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded-md">
                                                    <Briefcase className="w-3 h-3" />
                                                    {job.department}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <DollarSign className="w-4 h-4" />
                                                    {job.salaryRange?.min} - {job.salaryRange?.max} {job.salaryRange?.currency}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="w-4 h-4" />
                                                    {typeof job.location === 'string' ? job.location : job.location.type}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <FileText className="w-4 h-4" />
                                                    {job.employmentType}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Plus className="w-3 h-3" />
                                                    {job.openings} Openings
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : activeTab === 'codes' ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Campus Connect Access Codes</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Provide these securely generated 6-digit codes to placement officers.</p>
                            </div>
                            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50 sticky top-0 backdrop-blur-md">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Institution Name</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Access Code</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                        {COLLEGES.map((c, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{c.name}</td>
                                                <td className="px-6 py-4 text-sm font-mono font-bold text-[#826BF0] dark:text-[#826BF0]/80 text-right">{c.code}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : activeTab === 'blocked' ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 overflow-hidden">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Blocked Test Candidates</h3>
                            {blockedUsers.length === 0 ? (
                                <p className="text-gray-500 dark:text-gray-400">No blocked users found.</p>
                            ) : (
                                <div className="space-y-4">
                                    {blockedUsers.map(user => (
                                        <div key={user.id} className="flex justify-between items-center p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">{user.name || user.email || user.id}</p>
                                                <p className="text-sm text-gray-500">{user.email || ""}</p>
                                            </div>
                                            <button
                                                onClick={() => handleUnblock(user.id)}
                                                className="flex items-center gap-2 px-4 py-2 bg-[#826BF0]/10 hover:bg-[#826BF0]/20 text-[#826BF0] font-bold rounded-lg transition-colors text-sm"
                                            >
                                                <Unlock className="w-4 h-4" />
                                                Unblock
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ===== TEST RESULTS TAB ===== */
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                            {/* Header Row */}
                            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Campus Test Results</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Sorted by score (high → low) · {testResults.length} total submissions</p>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* College filter */}
                                    <select
                                        value={selectedCollege}
                                        onChange={e => setSelectedCollege(e.target.value)}
                                        className="text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#826BF0] outline-none"
                                    >
                                        <option value="All">All Colleges</option>
                                        {COLLEGES.map(c => (
                                            <option key={c.name} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                    {/* CSV download */}
                                    <button
                                        onClick={() => {
                                            const filtered = selectedCollege === 'All'
                                                ? testResults
                                                : testResults.filter(r => r.college === selectedCollege);
                                            downloadCSV(filtered);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#826BF0] hover:bg-[#826BF0]/90 text-white font-semibold rounded-lg transition-colors text-sm"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download CSV
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            {(() => {
                                const filtered = selectedCollege === 'All'
                                    ? testResults
                                    : testResults.filter(r => r.college === selectedCollege);

                                if (filtered.length === 0) {
                                    return (
                                        <div className="text-center py-20">
                                            <BarChart2 className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
                                            <p className="text-gray-500 dark:text-gray-400">No test results yet.</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="overflow-x-auto max-h-[650px] overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-[#1A1A1A] dark:bg-black sticky top-0 z-10 border-b border-white/10">
                                                <tr>
                                                    {['Rank', 'Candidate Profile', 'College & Match', 'Skills Inventory', 'Resume', 'Timestamp'].map(h => (
                                                        <th key={h} className="px-6 py-5 text-[9px] font-black text-white/40 uppercase tracking-[0.3em] whitespace-nowrap">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-white/5 bg-white dark:bg-slate-800/20">
                                                {filtered.map((r, idx) => {
                                                    const submittedAt = r.submittedAt?.toDate
                                                        ? r.submittedAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                        : '—';
                                                    const pct = r.scorePercent ?? 0;

                                                    // High-end score styling
                                                    let scoreBg = 'bg-black dark:bg-white text-white dark:text-black';
                                                    let scoreLabel = 'NEURAL MATCH';
                                                    if (pct >= 80) { scoreBg = 'bg-[#826BF0] text-white'; scoreLabel = 'ELITE PERFORMER'; }
                                                    else if (pct >= 60) { scoreBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'; scoreLabel = 'QUALIFIED'; }
                                                    else if (pct < 40) { scoreBg = 'bg-red-500/10 text-red-500 border border-red-500/20'; scoreLabel = 'LOW SCORE'; }

                                                    return (
                                                        <tr key={r.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-all group">
                                                            {/* RANK */}
                                                            <td className="px-6 py-6">
                                                                <div className="text-[10px] font-black text-gray-300 dark:text-white/10 font-mono tracking-tighter">
                                                                    {String(idx + 1).padStart(3, '0')}
                                                                </div>
                                                            </td>

                                                            {/* CANDIDATE PROFILE */}
                                                            <td className="px-6 py-6">
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="text-sm font-black tracking-tight text-gray-900 dark:text-white group-hover:text-[#826BF0] transition-colors">
                                                                        {r.name || 'Anonymous User'}
                                                                    </div>
                                                                    <div className="text-[10px] font-medium text-gray-400 dark:text-white/30 tracking-tight lowercase">
                                                                        {r.email || 'no-email@asterix.io'}
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* COLLEGE & MATCH */}
                                                            <td className="px-6 py-6">
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="text-[10px] font-black tracking-widest text-gray-400 dark:text-white/20 uppercase truncate max-w-[200px]">
                                                                        {r.college || 'Direct Entry'}
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`px-2.5 py-1 text-[8px] font-black tracking-[0.2em] rounded-sm shadow-sm ${scoreBg}`}>
                                                                            {pct}% • {scoreLabel}
                                                                        </div>
                                                                        <div className="text-[9px] font-bold text-gray-300 dark:text-white/20 whitespace-nowrap">
                                                                            {r.score}/{r.totalQuestions} POINTS
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* SKILLS */}
                                                            <td className="px-6 py-6 max-w-[240px]">
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {(Array.isArray(r.skills) ? r.skills : (r.skills || '').split(',')).slice(0, 3).map((s: string, i: number) => (
                                                                        <span key={i} className="px-2 py-0.5 border border-black/5 dark:border-white/5 text-[8px] font-black tracking-widest text-gray-500 uppercase">
                                                                            {s.trim()}
                                                                        </span>
                                                                    ))}
                                                                    <span className="text-[8px] font-black text-[#826BF0] opacity-40">+ MORE</span>
                                                                </div>
                                                            </td>

                                                            {/* RESUME */}
                                                            <td className="px-6 py-6 text-center">
                                                                {r.resumeUrl ? (
                                                                    <a
                                                                        href={r.resumeUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="size-10 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl group/btn"
                                                                    >
                                                                        <FileText className="w-4 h-4 group-hover/btn:animate-pulse" />
                                                                    </a>
                                                                ) : (
                                                                    <div className="size-10 rounded-full border border-dashed border-gray-200 dark:border-white/10 flex items-center justify-center opacity-30">
                                                                        <ShieldAlert className="w-4 h-4" />
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* TIMESTAMP */}
                                                            <td className="px-6 py-6">
                                                                <div className="text-[10px] font-black text-gray-400 dark:text-white/20 tracking-widest uppercase">
                                                                    {submittedAt}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminPortal;
