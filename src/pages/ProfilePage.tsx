import { useTheme as _useTheme } from 'next-themes'; 
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';void _useTheme;

import { Check, Copy, Mail, User } from 'lucide-react';
import { AvatarIcon } from '@/components/common/AvatarIcon';
import { cn } from '@/lib/utils';
import type { AvatarType, Currency } from '@/types/types';
import { CURRENCY_SYMBOLS } from '@/types/types';

// ── Constants ────────────────────────────────────────────────────

const ADMIN_EMAIL = 'nuzealouss@gmail.com';

const AVATAR_OPTIONS: AvatarType[] = [
  'initials', 'avocado', 'chefs_hat', 'fermentation_jar', 'grocery_basket', 'noodles',
];

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'USD', label: 'USD ($) — US Dollar' },
  { value: 'EUR', label: 'EUR (€) — Euro' },
  { value: 'GBP', label: 'GBP (£) — British Pound' },
  { value: 'MYR', label: 'MYR (RM) — Malaysian Ringgit' },
  { value: 'SGD', label: 'SGD (S$) — Singapore Dollar' },
  { value: 'AUD', label: 'AUD (A$) — Australian Dollar' },
  { value: 'JPY', label: 'JPY (¥) — Japanese Yen' },
  { value: 'CNY', label: 'CNY (¥) — Chinese Yuan' },
];

function planLabel(plan: string, trialExpires: string | null) {
  if (plan === 'trial') {
    if (trialExpires) {
      const ms = new Date(trialExpires).getTime() - Date.now();
      const days = Math.max(0, Math.ceil(ms / 86400000));
      return `Pro Trial (${days} day${days !== 1 ? 's' : ''} left)`;
    }
    return 'Pro Trial';
  }
  if (plan === 'pro') return 'Pro';
  return 'Free';
}

function planBadgeClass(plan: string) {
  if (plan === 'pro') return 'border-primary text-primary bg-primary/10';
  if (plan === 'trial') return 'border-warning text-warning bg-warning/10';
  return 'border-muted-foreground text-muted-foreground bg-muted/30';
}

// ── Pro Waitlist Section (admin only) ────────────────────────────

const WAITLIST_PAGE = 60;

function ProWaitlistSection() {
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(WAITLIST_PAGE);

  useEffect(() => {
    supabase
      .from('early_access_emails')
      .select('email')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEmails((data ?? []).map((r: { email: string }) => r.email));
        setLoading(false);
      });
  }, []);

  const handleCopyAll = () => {
    const text = emails.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Copied ${emails.length} emails to clipboard`);
    }).catch(() => {
      toast.error('Copy failed — try manually selecting the list');
    });
  };

  const visibleEmails = emails.slice(0, visibleCount);

  return (
    <Card className="glass border-0 shadow-card border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />Pro Waitlist
            {!loading && (
              <Badge variant="outline" className="text-xs ml-1">{emails.length} email{emails.length !== 1 ? 's' : ''}</Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={handleCopyAll}
            disabled={emails.length === 0}
          >
            <Copy className="h-3 w-3" />Copy All
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Users who clicked "Notify Me When Ready" on the Pricing page.</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : emails.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No waitlist emails yet</p>
        ) : (
          <>
            {/* Virtual-scroll style list — renders in batches */}
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              {visibleEmails.map((email, idx) => (
                <div
                  key={email}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm',
                    idx % 2 === 0 ? 'bg-muted/20' : 'bg-transparent'
                  )}
                >
                  <span className="text-xs text-muted-foreground w-7 shrink-0 text-right">{idx + 1}</span>
                  <span className="flex-1 min-w-0 font-mono text-xs truncate">{email}</span>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(email);
                      toast.success(`Copied ${email}`);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {visibleCount < emails.length && (
                <button
                  type="button"
                  className="w-full py-2 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                  onClick={() => setVisibleCount(v => v + WAITLIST_PAGE)}
                >
                  Load more ({emails.length - visibleCount} remaining)
                </button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function PreferencesPage() {
  const { user, profile, refreshProfile, updateColorScheme } = useAuth();
  const [saving, setSaving] = useState(false);

  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? 'PC';

  const [avatarType, setAvatarType] = useState<AvatarType>(profile?.avatar_type ?? 'initials');
  const [currency, setCurrency]     = useState<Currency>(profile?.currency ?? 'USD');

  const isAdmin = profile?.email === ADMIN_EMAIL || user?.email === ADMIN_EMAIL;

  // Sync when profile loads
  useEffect(() => {
    if (profile) {
      setAvatarType(profile.avatar_type ?? 'initials');
      setCurrency(profile.currency ?? 'USD');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_type: avatarType, currency, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Preferences saved!');
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isDark = (profile?.color_scheme ?? 'light') === 'dark';

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold gradient-text text-balance">Preferences</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your personal settings and preferences</p>
        </div>

        {/* Plan status */}
        <Card className="glass border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />Account Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground p-0">
                  <AvatarIcon avatarType={avatarType} initials={initials} size={48} />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{profile?.username ?? 'Chef'}</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
              <Badge variant="outline" className={cn('ml-auto shrink-0', planBadgeClass(profile?.plan ?? 'free'))}>
                {planLabel(profile?.plan ?? 'free', profile?.trial_expires_at ?? null)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Avatar picker */}
        <Card className="glass border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Avatar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {AVATAR_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setAvatarType(opt)}
                  className={cn(
                    'flex items-center justify-center p-3 rounded-xl border transition-all relative',
                    avatarType === opt
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-primary p-0">
                      <AvatarIcon avatarType={opt} initials={initials} size={40} />
                    </AvatarFallback>
                  </Avatar>
                  {avatarType === opt && (
                    <span className="absolute top-1 right-1">
                      <Check className="h-3 w-3 text-primary" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Currency */}
        <Card className="glass border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Currency</CardTitle>
            <p className="text-xs text-muted-foreground">Applies to ingredient prices, waste costs, and all monetary values in Pochef</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {CURRENCIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCurrency(c.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors',
                    currency === c.value
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/30'
                  )}
                >
                  <span className="font-bold w-8 shrink-0 text-primary">{CURRENCY_SYMBOLS[c.value]}</span>
                  <span className="text-xs">{c.label}</span>
                  {currency === c.value && <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="glass border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Dark Mode</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Switch between light and dark theme</p>
              </div>
              <Switch
                checked={isDark}
                onCheckedChange={checked => updateColorScheme(checked ? 'dark' : 'light')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pro Waitlist — admin only */}
        {isAdmin && <ProWaitlistSection />}

        <Separator />

        <Button onClick={handleSave} disabled={saving} className="w-full bg-copper-gradient text-primary-foreground">
          {saving ? 'Saving…' : 'Save Preferences'}
        </Button>
      </div>
    </AppLayout>
  );
}

