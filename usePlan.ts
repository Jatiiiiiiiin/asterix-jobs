import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { readSessionUid } from './authService';

export type PlanTier = 'free' | 'premium_student' | 'premium' | 'enterprise';

interface PlanState {
  plan: PlanTier;
  isLoading: boolean;
  isPremium: boolean;
  canManualApply: boolean; // premium_student and above
}

function resolvePlan(data: any): PlanTier {
  // Check every possible location authService might write the plan to
  const candidates = [
    data?.plan,                        // top-level: users/{uid}.plan
    data?.subscription?.plan,         // nested:    users/{uid}.subscription.plan
    data?.subscription?.status === 'active' && data?.subscription?.isPremium
      ? (data?.subscription?.isStudent ? 'premium_student' : 'premium')
      : null,                          // derived from isPremium + isStudent flags
  ];

  for (const c of candidates) {
    if (c && typeof c === 'string' && c !== 'free') return c as PlanTier;
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
  const canManualApply = plan === 'premium_student' || plan === 'premium' || plan === 'enterprise';

  return { plan, isLoading, isPremium, canManualApply };
}