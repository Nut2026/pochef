import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export type PlanTier = 'free' | 'trial' | 'pro';

export interface PlanFeatures {
  tier: PlanTier;
  isPro: boolean;       // true for both 'pro' and active 'trial'
  maxInventory: number; // 50 for free, Infinity for pro/trial
  maxFermentation: number; // 2 for free, Infinity for pro/trial
  advancedNutrition: boolean;
  smartGrocery: boolean;
  sevenDayMealPlan: boolean;
  exportWatermarkFree: boolean;
  priorityAccess: boolean;
}

export function usePlan(): PlanFeatures {
  const { profile } = useAuth();

  return useMemo(() => {
    const plan = profile?.plan ?? 'free';
    const trialExpires = profile?.trial_expires_at;

    // Trial is active only if not yet expired
    const trialActive =
      plan === 'trial' && trialExpires
        ? new Date(trialExpires).getTime() > Date.now()
        : false;

    const tier: PlanTier =
      plan === 'pro' ? 'pro' : trialActive ? 'trial' : 'free';
    const isPro = tier === 'pro' || tier === 'trial';

    return {
      tier,
      isPro,
      maxInventory:    isPro ? Infinity : 50,
      maxFermentation: isPro ? Infinity : 2,
      advancedNutrition:    isPro,
      smartGrocery:         isPro,
      sevenDayMealPlan:     isPro,
      exportWatermarkFree:  isPro,
      priorityAccess:       isPro,
    };
  }, [profile]);
}
