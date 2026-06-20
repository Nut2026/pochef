import { type ReactNode, useEffect, useRef } from 'react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, profile } = useAuth();
  const identifiedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (user && profile && identifiedUserRef.current !== user.id) {
      identifiedUserRef.current = user.id;
      pendo.identify({
        visitor: {
          id: user.id,
          email: profile.email,
          username: profile.username,
          plan: profile.plan,
          trialExpiresAt: profile.trial_expires_at,
          avatarType: profile.avatar_type,
          currency: profile.currency,
          dailyCalorieTarget: profile.daily_calorie_target,
          dietaryGoal: profile.dietary_goal,
          cookingDevices: profile.cooking_devices,
        }
      });
    }
  }, [user, profile]);

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        <main className="flex-1 p-4 md:p-6 pt-14 lg:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
