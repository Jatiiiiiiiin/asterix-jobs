import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { readSessionUid } from './authService';

export type PlanTier = 'free' | 'student_premium' | 'premium_student' | 'premium' | 'enterprise';

interface PlanState {
  plan: PlanTier;
  isLoading: boolean;
  isPremium: boolean;
  canManualApply: boolean; // premium_student and above
}

/** All string values that mean "paid student access" */
const STUDENT_PLANS = new Set(['student_premium', 'premium_student', 'student']);
/** All string values that mean "paid (non-student) access" */
const PREMIUM_PLANS = new Set(['premium', 'enterprise', 'pro']);

function resolvePlan(data: any): PlanTier {
  // 1. Check every possible field location
  const candidates: unknown[] = [
    data?.plan,                        // top-level:  users/{uid}.plan
    data?.subscription?.plan,          // nested:     users/{uid}.subscription.plan
    // Derived from isPremium + isStudent flags
    data?.subscription?.status === 'active' && data?.subscription?.isPremium
      ? (data?.subscription?.isStudent ? 'student_premium' : 'premium')
      : null,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const v = c.toLowerCase().trim();
    if (STUDENT_PLANS.has(v)) return 'student_premium';
    if (PREMIUM_PLANS.has(v)) return 'premium';
    if (v === 'enterprise') return 'enterprise';
  }
  return 'free';
}

export function usePlan(): PlanState {
  const [plan, setPlan] = useState<PlanTier>('free');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlan = async () => {
      const uid = readSessionUid();
      if (!uid) { setIsLoading(false); return; }

      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          setPlan(resolvePlan(snap.data()));
        }
      } catch (err) {
        console.warn('[usePlan] Failed to fetch plan:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlan();
  }, []);

  const isPremium = plan !== 'free';
  const canManualApply = (
    plan === 'student_premium' ||
    plan === 'premium_student' ||
    plan === 'premium' ||
    plan === 'enterprise'
  );

  return { plan, isLoading, isPremium, canManualApply };
}