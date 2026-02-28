import React, { useState, useEffect, useRef } from 'react';

import Sidebar from '../components/Sidebar';
import { authService, readSessionUid, AuthUser } from '../authService';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/* ================= TYPES ================= */

interface Deployment {
  id: number;
  date: string;
  role: string;
  co: string;
  desc: string;
}

interface SkillVector {
  id: number;
  s: string;
  l: number;
}

interface Profile {
  name: string;
  title: string;
  manifesto: string;
  availability: string;
  coordinates: string;
  accessLevel: string;
}

interface Contact {
  phone?: string;
  github?: string;
  linkedin?: string;
}

interface Preferences {
  minSalary?: string;
  remotePreference?: string;
}

interface StoredProfile {
  profile: Profile;
  deployments: Deployment[];
  skills: SkillVector[];
  contact: Contact;
  preferences: Preferences;
  education: string;
}

/* ================= CONSTANTS ================= */

const PROFILE_SKILLS_KEY = 'asterix_profile_skills';
const getProfileStorageKey = (uid: string) => `asterix_candidate_profile_${uid}`;

const DEFAULT_PROFILE: Profile = {
  name: '',
  title: '',
  manifesto: '',
  availability: '',
  coordinates: '',
  accessLevel: '',
};

const DEFAULT_STORED: StoredProfile = {
  profile: DEFAULT_PROFILE,
  deployments: [],
  skills: [],
  contact: {},
  preferences: {},
  education: '',
};

/* ================= HELPERS ================= */

function syncSkillsCache(skills: SkillVector[]) {
  localStorage.setItem(
    PROFILE_SKILLS_KEY,
    JSON.stringify(skills.map((v) => ({ skill: v.s.toLowerCase(), weight: v.l })))
  );
}

/* ================= INPUT COMPONENT ================= */

const Field = ({
  label,
  name,
  value,
  onChange,
  multiline = false,
  rows = 3,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  multiline?: boolean;
  rows?: number;
}) => (
  <div className="space-y-1">
    <label className="text-[8px] font-black tracking-[0.4em] opacity-40">{label}</label>
    {multiline ? (
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 p-2 text-sm font-medium outline-none focus:border-black dark:focus:border-white resize-none transition-colors"
      />
    ) : (
      <input
        name={name}
        value={value}
        onChange={onChange}
        className="w-full bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 p-2 text-sm font-medium outline-none focus:border-black dark:focus:border-white transition-colors"
      />
    )}
  </div>
);

/* ================= COMPONENT ================= */

interface ProfilePageProps {
  onToggleTheme: () => void;
  isDarkMode: boolean;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ onToggleTheme, isDarkMode }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // All data state
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [neuralVectors, setNeuralVectors] = useState<SkillVector[]>([]);
  const [contact, setContact] = useState<Contact>({});
  const [preferences, setPreferences] = useState<Preferences>({});
  const [education, setEducation] = useState('');

  // Deployment being edited inline
  const [editingDepId, setEditingDepId] = useState<number | null>(null);
  const [editDepData, setEditDepData] = useState<Deployment | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadUser = async () => {
      const uid = readSessionUid();
      if (!uid) return;
      const u = await authService.getCurrentUser();
      if (u) setAuthUser({ ...u, uid });
      else setAuthUser({ uid, email: null, role: 'candidate', isOnboarded: false });
    };
    loadUser();
  }, []);

  // ── Load from Firestore ───────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser?.uid) return;

    const fetchProfile = async () => {
      const snap = await getDoc(doc(db, 'profiles', authUser.uid));

      const raw: Partial<StoredProfile> = snap.exists()
        ? (snap.data() as Partial<StoredProfile>)
        : (() => {
          const cached = localStorage.getItem(getProfileStorageKey(authUser.uid));
          if (!cached) return {};
          try { return JSON.parse(cached) as Partial<StoredProfile>; } catch { return {}; }
        })();

      setProfile(raw.profile ?? DEFAULT_PROFILE);
      setDeployments(raw.deployments ?? []);
      setNeuralVectors(raw.skills ?? []);
      setContact(raw.contact ?? {});
      setPreferences(raw.preferences ?? {});
      setEducation(raw.education ?? '');
    };

    fetchProfile();
  }, [authUser]);

  // ── Refs — always hold latest state, no stale closure issues ─────────────
  const profileRef = useRef(profile);
  const deploymentsRef = useRef(deployments);
  const skillsRef = useRef(neuralVectors);
  const contactRef = useRef(contact);
  const prefsRef = useRef(preferences);
  const educationRef = useRef(education);
  const authUserRef = useRef(authUser);

  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { deploymentsRef.current = deployments; }, [deployments]);
  useEffect(() => { skillsRef.current = neuralVectors; }, [neuralVectors]);
  useEffect(() => { contactRef.current = contact; }, [contact]);
  useEffect(() => { prefsRef.current = preferences; }, [preferences]);
  useEffect(() => { educationRef.current = education; }, [education]);
  useEffect(() => { authUserRef.current = authUser; }, [authUser]);

  // ── Save — reads from refs so it never captures stale state ──────────────
  const handleSave = async () => {
    const uid = authUserRef.current?.uid;
    if (!uid) {
      alert('Not logged in — cannot save.');
      return;
    }

    const payload: StoredProfile = {
      profile: profileRef.current,
      deployments: deploymentsRef.current,
      skills: skillsRef.current,
      contact: contactRef.current,
      preferences: prefsRef.current,
      education: educationRef.current,
    };

    setIsSaving(true);
    try {
      localStorage.setItem(getProfileStorageKey(uid), JSON.stringify(payload));
      syncSkillsCache(payload.skills);
      await setDoc(doc(db, 'profiles', uid), payload, { merge: true });
      setIsEditing(false);
    } catch (err) {
      console.error('[ProfilePage] Save failed:', err);
      alert('Save failed — check console.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Generic change handlers ───────────────────────────────────────────────
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setProfile((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setContact((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePrefChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPreferences((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Deployment handlers ───────────────────────────────────────────────────
  const addDeployment = () => {
    const newDep: Deployment = {
      id: Date.now(),
      date: 'Present',
      role: 'New Role',
      co: 'Company',
      desc: 'Description...',
    };
    setDeployments((prev) => [newDep, ...prev]);
  };

  const removeDeployment = (id: number) =>
    setDeployments((prev) => prev.filter((d) => d.id !== id));

  const startEditDep = (d: Deployment) => {
    setEditingDepId(d.id);
    setEditDepData({ ...d });
  };

  const saveEditDep = async () => {
    if (!editDepData || editingDepId === null) return;
    const updated = deployments.map((d) => (d.id === editingDepId ? editDepData : d));
    setDeployments(updated);
    setEditingDepId(null);
    setEditDepData(null);
  };

  // ── Skill handlers ────────────────────────────────────────────────────────
  const handleSkillChange = (id: number, field: 's' | 'l', value: string | number) =>
    setNeuralVectors((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)));

  const addSkill = () =>
    setNeuralVectors((prev) => [...prev, { id: Date.now(), s: 'New Skill', l: 50 }]);

  const removeSkill = (id: number) =>
    setNeuralVectors((prev) => prev.filter((v) => v.id !== id));

  /* ================= RENDER ================= */

  return (
    <div className="flex h-screen bg-white dark:bg-background-dark text-black dark:text-white transition-colors duration-500 overflow-hidden">
      <Sidebar role="candidate" isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="flex-1 overflow-y-auto border-l border-black dark:border-white/10 p-4 md:p-8 lg:p-12 custom-scrollbar">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 md:mb-12 border-b border-black dark:border-white/10 pb-6 md:pb-10">
          <div className="flex flex-col sm:flex-row gap-5 md:gap-8 items-start w-full">

            {/* Avatar */}
            <div className="size-20 md:size-36 bg-black dark:bg-white shrink-0 group relative overflow-hidden border border-black dark:border-white">
              <span className="material-symbols-outlined text-[40px] md:text-[80px] text-white dark:text-black absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                fingerprint
              </span>
            </div>

            {/* Name / title */}
            <div className="space-y-2 md:space-y-4 flex-grow min-w-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 -ml-2 text-black dark:text-white">
                  <span className="material-symbols-outlined">menu</span>
                </button>
                <div className="text-[7px] md:text-[8px] font-black tracking-[0.5em] opacity-40">
                  Candidate Profile
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-2 max-w-2xl">
                  <input
                    name="name"
                    value={profile.name}
                    onChange={handleProfileChange}
                    placeholder="Full Name"
                    className="text-3xl md:text-4xl font-black tracking-tighter w-full bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 p-2 outline-none focus:border-black dark:focus:border-white"
                  />
                  <input
                    name="title"
                    value={profile.title}
                    onChange={handleProfileChange}
                    placeholder="Job Title"
                    className="text-base font-black tracking-widest w-full bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 p-2 outline-none focus:border-black dark:focus:border-white"
                  />
                </div>
              ) : (
                <div className="space-y-0.5 md:space-y-1">
                  <h1 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight break-words">
                    {profile.name || <span className="opacity-20">Your Name</span>}
                  </h1>
                  <p className="text-base md:text-lg font-black tracking-widest opacity-40">
                    {profile.title || <span>Add your title</span>}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1.5 text-[7px] md:text-[8px] font-black tracking-[0.4em] opacity-40">
                    <span className="truncate max-w-[120px] sm:max-w-none">UID: {authUser?.uid}</span>
                    <span className="truncate max-w-[150px] sm:max-w-none">EMAIL: {authUser?.email}</span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 sm:flex-none px-6 py-2 text-[9px] font-black tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save All Changes'}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 sm:flex-none px-6 py-2 text-[9px] font-black tracking-widest border border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 sm:flex-none px-6 py-2 text-[9px] font-black tracking-widest bg-black dark:bg-white text-white dark:text-black hover:invert transition-all"
                  >
                    Edit Profile
                  </button>
                )}
                <button
                  onClick={onToggleTheme}
                  className="p-2 border border-black dark:border-white hover:invert transition-all ml-auto md:hidden"
                >
                  <span className="material-symbols-outlined text-lg">
                    {isDarkMode ? 'light_mode' : 'dark_mode'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onToggleTheme}
            className="hidden md:block p-3 border border-black dark:border-white hover:invert transition-all"
          >
            <span className="material-symbols-outlined text-lg">
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </header>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">

          {/* Left column */}
          <div className="lg:col-span-7 space-y-10 md:space-y-14">

            {/* ── Work Experience ─────────────────────────────────────────── */}
            <section className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[9px] font-black tracking-[0.4em] opacity-40">
                  Work Experience
                </h3>
                {isEditing && (
                  <button
                    onClick={addDeployment}
                    className="flex items-center gap-1 text-[8px] font-black tracking-widest hover:opacity-50 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span> Add
                  </button>
                )}
              </div>

              <div className="space-y-8">
                {deployments.map((exp) => (
                  <div
                    key={exp.id}
                    className="group flex flex-col sm:flex-row gap-4 border-l-2 border-black/10 dark:border-white/10 pl-4 md:pl-6 relative"
                  >
                    {editingDepId === exp.id ? (
                      <div className="flex-grow space-y-3 bg-black/5 dark:bg-white/5 p-4 border border-black/20 dark:border-white/20">
                        <input
                          value={editDepData?.date ?? ''}
                          onChange={(e) => setEditDepData((p) => p ? { ...p, date: e.target.value } : p)}
                          placeholder="Date / Period"
                          className="w-full bg-white dark:bg-black border border-black/20 dark:border-white/20 p-2 text-xs font-black outline-none"
                        />
                        <input
                          value={editDepData?.role ?? ''}
                          onChange={(e) => setEditDepData((p) => p ? { ...p, role: e.target.value } : p)}
                          placeholder="Job Title"
                          className="w-full bg-white dark:bg-black border border-black/20 dark:border-white/20 p-2 text-xs font-black outline-none"
                        />
                        <input
                          value={editDepData?.co ?? ''}
                          onChange={(e) => setEditDepData((p) => p ? { ...p, co: e.target.value } : p)}
                          placeholder="Company"
                          className="w-full bg-white dark:bg-black border border-black/20 dark:border-white/20 p-2 text-xs font-black outline-none"
                        />
                        <textarea
                          value={editDepData?.desc ?? ''}
                          onChange={(e) => setEditDepData((p) => p ? { ...p, desc: e.target.value } : p)}
                          placeholder="Description"
                          rows={3}
                          className="w-full bg-white dark:bg-black border border-black/20 dark:border-white/20 p-2 text-xs font-medium outline-none resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveEditDep}
                            className="bg-black dark:bg-white text-white dark:text-black px-4 py-1.5 text-[9px] font-black tracking-widest hover:invert transition-all"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingDepId(null); setEditDepData(null); }}
                            className="border border-black dark:border-white px-4 py-1.5 text-[9px] font-black tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => { removeDeployment(exp.id); setEditingDepId(null); }}
                            className="ml-auto text-red-500 text-[9px] font-black tracking-widest hover:opacity-70 transition-opacity"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-grow space-y-1 relative pr-8">
                        <span className="text-[8px] font-black tracking-widest opacity-40">
                          {exp.date}
                        </span>
                        <h4 className="text-xl md:text-2xl font-black tracking-tighter leading-tight">
                          {exp.role} <span className="opacity-20">@</span> {exp.co}
                        </h4>
                        <p className="text-[10px] font-medium tracking-widest opacity-60 leading-relaxed">
                          {exp.desc}
                        </p>
                        {isEditing && (
                          <button
                            onClick={() => startEditDep(exp)}
                            className="absolute right-0 top-0 material-symbols-outlined text-lg hover:scale-110 transition-transform"
                          >
                            edit_note
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {deployments.length === 0 && (
                  <p className="text-[10px] font-black tracking-widest opacity-30">
                    No experience added yet. {isEditing ? 'Click + Add above.' : 'Click Edit Profile to add.'}
                  </p>
                )}
              </div>
            </section>

            {/* ── About Me ──────────────────────────────────────────────── */}
            <section className="space-y-6">
              <h3 className="text-[9px] font-black tracking-[0.4em] opacity-40">
                About Me
              </h3>
              {isEditing ? (
                <textarea
                  name="manifesto"
                  value={profile.manifesto}
                  onChange={handleProfileChange}
                  rows={4}
                  placeholder="Tell employers about yourself..."
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 p-3 text-lg font-black tracking-tighter outline-none focus:border-black dark:focus:border-white resize-none"
                />
              ) : (
                <p className="text-lg md:text-2xl font-black tracking-tighter leading-tight opacity-90">
                  {profile.manifesto || <span className="opacity-30">No bio added yet.</span>}
                </p>
              )}
            </section>

            {/* ── Job Preferences ───────────────────────────────────────── */}
            <section className="space-y-6">
              <h3 className="text-[9px] font-black tracking-[0.4em] opacity-40">
                Job Preferences
              </h3>
              {isEditing ? (
                <div className="space-y-4">
                  <Field label="Minimum Salary" name="minSalary" value={preferences.minSalary ?? ''} onChange={handlePrefChange} />
                  <Field label="Remote Preference" name="remotePreference" value={preferences.remotePreference ?? ''} onChange={handlePrefChange} />
                </div>
              ) : (
                <div className="space-y-3 text-[9px] font-black tracking-widest">
                  {[
                    { label: 'Min Salary', value: preferences.minSalary },
                    { label: 'Remote', value: preferences.remotePreference },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between border-b border-black/10 dark:border-white/10 pb-2">
                      <span className="opacity-40">{label}</span>
                      <span>{value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Session Access ────────────────────────────────────────── */}
            <section className="border border-black dark:border-white p-6 md:p-8 bg-neutral-100 dark:bg-neutral-900">
              <h3 className="text-[9px] font-black tracking-[0.4em] mb-6 opacity-60">
                Session Access
              </h3>
              {isEditing ? (
                <div className="space-y-4">
                  <Field label="Availability Status" name="availability" value={profile.availability} onChange={handleProfileChange} />
                  <Field label="Location / Coordinates" name="coordinates" value={profile.coordinates} onChange={handleProfileChange} />
                  <Field label="Access Level" name="accessLevel" value={profile.accessLevel} onChange={handleProfileChange} />
                </div>
              ) : (
                <div className="space-y-3 text-[9px] font-black tracking-widest">
                  {[
                    { label: 'Status', value: profile.availability },
                    { label: 'Location', value: profile.coordinates },
                    { label: 'Level', value: profile.accessLevel },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between border-b border-black/10 dark:border-white/10 pb-2">
                      <span className="opacity-50">{label}</span>
                      <span>{value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Contact ───────────────────────────────────────────────── */}
            <section className="space-y-6">
              <h3 className="text-[9px] font-black tracking-[0.4em] opacity-40">
                Contact
              </h3>
              {isEditing ? (
                <div className="space-y-4">
                  <Field label="Phone" name="phone" value={contact.phone ?? ''} onChange={handleContactChange} />
                  <Field label="GitHub" name="github" value={contact.github ?? ''} onChange={handleContactChange} />
                  <Field label="LinkedIn" name="linkedin" value={contact.linkedin ?? ''} onChange={handleContactChange} />
                </div>
              ) : (
                <div className="space-y-3 text-[9px] font-black tracking-widest">
                  {[
                    { label: 'Phone', value: contact.phone },
                    { label: 'GitHub', value: contact.github },
                    { label: 'LinkedIn', value: contact.linkedin },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between border-b border-black/10 dark:border-white/10 pb-2">
                      <span className="opacity-40">{label}</span>
                      <span className="truncate max-w-[60%]">{value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="lg:col-span-5 space-y-10 md:space-y-14">

            {/* ── Education ─────────────────────────────────────────────── */}
            <section className="space-y-6">
              <h3 className="text-[9px] font-black tracking-[0.4em] opacity-40">
                Education
              </h3>
              {isEditing ? (
                <textarea
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  rows={4}
                  placeholder="Your education background..."
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 p-3 text-xs font-medium tracking-widest outline-none focus:border-black dark:focus:border-white resize-none"
                />
              ) : (
                <p className="text-xs font-medium tracking-widest opacity-60 leading-relaxed">
                  {education || <span className="opacity-50">No education added yet.</span>}
                </p>
              )}
            </section>

            {/* ── Top Skills ────────────────────────────────────────────── */}
            <section className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[9px] font-black tracking-[0.4em] opacity-40">
                  Top Skills
                </h3>
                {isEditing && (
                  <button
                    onClick={addSkill}
                    className="flex items-center gap-1 text-[8px] font-black tracking-widest hover:opacity-50 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span> Add
                  </button>
                )}
              </div>

              <div className="space-y-5">
                {neuralVectors.map((skill) => (
                  <div key={skill.id} className="space-y-1.5 group cursor-default">
                    <div className="flex justify-between text-[9px] font-black tracking-widest">
                      {isEditing ? (
                        <div className="flex gap-2 w-full items-center">
                          <input
                            type="text"
                            value={skill.s}
                            onChange={(e) => handleSkillChange(skill.id, 's', e.target.value)}
                            className="flex-1 bg-transparent border-b border-black/20 dark:border-white/20 pb-0.5 outline-none font-black tracking-widest focus:border-black dark:focus:border-white"
                          />
                          <span className="opacity-40 shrink-0">{skill.l}%</span>
                          <button
                            onClick={() => removeSkill(skill.id)}
                            className="material-symbols-outlined text-red-500 text-sm shrink-0"
                          >
                            delete
                          </button>
                        </div>
                      ) : (
                        <>
                          <span>{skill.s}</span>
                          <span>{skill.l}%</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 border border-black dark:border-white p-0.5 relative">
                        {isEditing && (
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={skill.l}
                            onChange={(e) => handleSkillChange(skill.id, 'l', parseInt(e.target.value, 10))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                        )}
                        <div
                          className="h-full bg-black dark:bg-white transition-all"
                          style={{ width: `${skill.l}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {neuralVectors.length === 0 && (
                  <p className="text-[10px] font-black tracking-widest opacity-30">
                    No skills added yet. {isEditing ? 'Click + Add above.' : 'Click Edit Profile to add.'}
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* ── Floating Save Banner (visible when editing) ─────────────── */}
        {isEditing && (
          <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto flex gap-3 bg-black dark:bg-white text-white dark:text-black px-4 md:px-6 py-3 shadow-2xl z-[1000] animate-in fade-in slide-in-from-bottom-4 duration-300 border border-white/20 dark:border-black/20">
            <span className="text-[7px] md:text-[9px] font-black tracking-widest my-auto hidden sm:block">
              Unsaved changes
            </span>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 md:flex-none px-4 py-2 text-[8px] md:text-[9px] font-black tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Now'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 md:flex-none px-4 py-2 text-[8px] md:text-[9px] font-black tracking-widest border border-white/30 dark:border-black/20 hover:border-white transition-colors"
            >
              Discard
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProfilePage;
