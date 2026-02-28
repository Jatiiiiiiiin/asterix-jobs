import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export type PlanTier = 'free' | 'student_premium' | 'premium_student' | 'premium' | 'enterprise';

interface PlanState {
  plan: PlanTier;
  planLabel: string;
  isLoading: boolean;
  isPremium: boolean;
  canManualApply: boolean; // premium_student and above
}

const STUDENT_PLANS = new Set(['student_premium', 'premium_student', 'student']);
const PREMIUM_PLANS = new Set(['premium', 'enterprise', 'pro']);

function resolvePlan(data: any): PlanTier {
  const candidates: unknown[] = [
    data?.plan,
    data?.subscription?.plan,
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPlan('free');
        setIsLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          setPlan(resolvePlan(snap.data()));
        }
      } catch (err) {
        console.warn('[usePlan] Failed to fetch plan:', err);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const isPremium = plan !== 'free';
  const canManualApply = (
    plan === 'student_premium' ||
    plan === 'premium_student' ||
    plan === 'premium' ||
    plan === 'enterprise'
  );

  let planLabel = 'Free Plan';
  if (plan === 'student_premium' || plan === 'premium_student') planLabel = 'Student Plan';
  else if (plan === 'premium') planLabel = 'Premium Plan';
  else if (plan === 'enterprise') planLabel = 'Enterprise Plan';

  return { plan, planLabel, isLoading, isPremium, canManualApply };
}