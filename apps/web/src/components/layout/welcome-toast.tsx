'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

export function WelcomeToast() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const show = window.setTimeout(() => setVisible(true), 350);
    const hide = window.setTimeout(() => setLeaving(true), 3350);
    const remove = window.setTimeout(() => setVisible(false), 3650);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
      window.clearTimeout(remove);
    };
  }, [user]);

  if (!visible || !user) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-[72px] z-40 -translate-x-1/2 px-4">
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-white/75 bg-white/70 px-4 py-2.5 shadow-toast backdrop-blur-[20px]',
          leaving ? 'animate-welcome-out' : 'animate-welcome-in',
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-violet-100/80 text-violet-600">
          <Users className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-slate-800">Welcome back, {user.firstName}!</p>
          <p className="text-[11px] text-slate-500">
            Have a productive day at BRIE&apos;S HOME &amp; KITCHEN.
          </p>
        </div>
      </div>
    </div>
  );
}
