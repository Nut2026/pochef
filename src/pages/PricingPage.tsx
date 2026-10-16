import { Check, Crown, Sparkles, X, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription,DialogHeader, DialogTitle, 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { cn } from '@/lib/utils';

// ── Feature table data ───────────────────────────────────────────

interface PlanFeature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
}

const FEATURES: PlanFeature[] = [
  { label: 'Price',                    free: '$0 / Month',              pro: '$4.99 / mo  ·  $39.99/yr (Save 33%)' },
  { label: 'Inventory Storage',        free: 'Up to 50 items',          pro: 'Unlimited' },
  { label: 'Fermentation Batches',     free: 'Up to 2 active',          pro: 'Unlimited' },
  { label: 'Nutrition & Macro Tracking', free: 'Basic tracking',        pro: 'Advanced weekly, monthly, and yearly breakdowns' },
  { label: 'Smart Grocery Lists',      free: 'Standard list',           pro: 'Smart auto-replenish' },
  { label: 'Meal Planning',            free: 'Daily smart planner',     pro: 'Batch meal planning' },
  { label: 'Export Meal Plans',        free: false,                     pro: 'Watermark-free clean exports' },
  { label: 'Export Nutrition Logs',    free: 'Basic exports with watermarks', pro: 'Watermark-free clean exports' },
  { label: 'Priority Access',          free: false,                     pro: 'Early access to new features' },
];

function FeatureCell({ value, isPro }: { value: string | boolean; isPro?: boolean }) {
  if (value === false) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground/50">
        <X className="h-4 w-4 shrink-0" />
        <span className="text-xs">{isPro ? '' : 'Not included'}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-1.5">
      <Check className={cn('h-4 w-4 shrink-0 mt-0.5', isPro ? 'text-primary' : 'text-success')} />
      <span className="text-sm">{value}</span>
    </div>
  );
}

// ── Claim Early Access Modal ─────────────────────────────────────

function ClaimEarlyAccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) { toast.error('Please enter a valid email'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('early_access_emails').insert({
        email: email.trim().toLowerCase(),
        user_id: user?.id ?? null,
      });
      if (error && !error.message.includes('duplicate')) throw error;
      setDone(true);
      toast.success("You're on the list! We'll email you when payments go live.");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { onClose(); setDone(false); } }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />Claim Early Access
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed">
            We're currently fine-tuning our payment system for launch. As an early adopter, you can lock in the{' '}
            <strong>Lifetime 40% discount</strong> right now. We'll email you the second payments go live!
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="text-center py-4 space-y-3">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-success/15 flex items-center justify-center">
                <Check className="h-6 w-6 text-success" />
              </div>
            </div>
            <p className="font-semibold">You're on the list!</p>
            <p className="text-sm text-muted-foreground">We'll notify you at <strong>{email}</strong> when Pochef Pro launches.</p>
            <Button onClick={() => { onClose(); setDone(false); }} className="w-full bg-copper-gradient text-primary-foreground">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-normal">Your Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className="mt-1" type="email" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-copper-gradient text-primary-foreground">
                {submitting ? 'Submitting…' : 'Notify Me When Ready'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────

// ── 40% Lifetime Discount Modal (Pro Trial users) ───────────────

function TrialDiscountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) { toast.error('Please enter a valid email'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('early_access_emails').insert({
        email: email.trim().toLowerCase(),
        user_id: user?.id ?? null,
      });
      if (error && !error.message.includes('duplicate')) throw error;
      setDone(true);
      toast.success("You're locked in! We'll email you the moment payments go live.");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { onClose(); setDone(false); } }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />40% Lifetime Discount
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed">
            Lock in your <strong>40% lifetime discount</strong> now! We're finalizing our payment system.
            Click below to secure your early adopter rate, and we'll notify you the moment we launch.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="text-center py-4 space-y-3">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-success/15 flex items-center justify-center">
                <Check className="h-6 w-6 text-success" />
              </div>
            </div>
            <p className="font-semibold">You're locked in!</p>
            <p className="text-sm text-muted-foreground">We'll notify you at <strong>{email}</strong> when payments go live.</p>
            <Button onClick={() => { onClose(); setDone(false); }} className="w-full bg-copper-gradient text-primary-foreground">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-normal">Your Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className="mt-1" type="email" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Not now</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-copper-gradient text-primary-foreground">
                {submitting ? 'Submitting…' : 'Count Me In!'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function PricingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [earlyAccessOpen, setEarlyAccessOpen] = useState(false);
  const [trialDiscountOpen, setTrialDiscountOpen] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);

  const isProOrTrial = profile?.plan === 'pro' || profile?.plan === 'trial';
  const isTrial = profile?.plan === 'trial';

  const handleStartTrial = async () => {
    if (!user) return;
    if (isProOrTrial) { toast.info('You already have Pro access!'); return; }
    setTrialLoading(true);
    try {
      const trialExpires = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({ plan: 'trial', trial_expires_at: trialExpires, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('🎉 Your 28-day Pro Trial is active! Enjoy all Pro features.');
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setTrialLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold gradient-text text-balance">Choose Your Plan</h1>
          <p className="text-muted-foreground mt-2 text-sm">Everything you need to run a smarter kitchen</p>
        </div>

        {/* Current plan banner */}
        {isProOrTrial && (
          <div className="glass rounded-xl p-4 border border-primary/20 bg-primary/5 flex items-center gap-3">
            <Crown className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                {profile?.plan === 'pro' ? 'You have Pro — full access!' : `Pro Trial active`}
              </p>
              {profile?.plan === 'trial' && profile.trial_expires_at && (
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(profile.trial_expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free */}
          <Card className="glass border border-border shadow-card h-full flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">Free</CardTitle>
                <Badge variant="secondary">The Starter</Badge>
              </div>
              <p className="text-3xl font-bold mt-2">$0<span className="text-base font-normal text-muted-foreground"> / month</span></p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <div className="space-y-3 flex-1">
                {FEATURES.slice(1).map(f => (
                  <div key={f.label} className="flex flex-col gap-0.5">
                    <p className="text-xs text-muted-foreground font-medium">{f.label}</p>
                    <FeatureCell value={f.free} />
                  </div>
                ))}
              </div>
              {/* Current Plan — always non-interactive */}
              <Button
                type="button"
                variant="outline"
                className="w-full mt-auto cursor-default pointer-events-none opacity-70"
                tabIndex={-1}
                aria-disabled
                onClick={() => {}}
              >
                Current Plan
              </Button>
            </CardContent>
          </Card>

          {/* Pro — animated border */}
          <div className={cn('relative rounded-xl p-[2px]', isProOrTrial ? 'pricing-pro-border' : 'pricing-pro-border')}>
            {/* Animated border gradient */}
            <div className="pricing-border-anim rounded-xl absolute inset-0 pointer-events-none" />
            <Card className={cn(
              'glass border-0 shadow-hover h-full flex flex-col relative overflow-hidden rounded-[10px]',
              isTrial && 'pricing-trial-glow'
            )}>
              <div className="absolute top-0 left-0 right-0 h-1 bg-copper-gradient" />
              <CardHeader className="pb-4 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />Pro
                  </CardTitle>
                  <Badge className="bg-copper-gradient text-primary-foreground">The Powerhouse</Badge>
                </div>
                <div className="mt-2 space-y-0.5">
                  <p className="text-3xl font-bold">$4.99<span className="text-base font-normal text-muted-foreground"> / month</span></p>
                  <p className="text-sm text-success font-medium">or $39.99/yr — Save 33%</p>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                <div className="space-y-3 flex-1">
                  {FEATURES.slice(1).map(f => (
                    <div key={f.label} className="flex flex-col gap-0.5">
                      <p className="text-xs text-muted-foreground font-medium">{f.label}</p>
                      <FeatureCell value={f.pro} isPro />
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Trial button */}
                {!isProOrTrial && (
                  <Button
                    onClick={handleStartTrial}
                    disabled={trialLoading}
                    variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary/10"
                  >
                    {trialLoading ? 'Activating…' : '🎁 Start 28-day Pro Trial — Free'}
                  </Button>
                )}

                {/* Main CTA */}
                <Button
                  onClick={() => isProOrTrial ? undefined : setEarlyAccessOpen(true)}
                  className={cn(
                    'w-full text-primary-foreground',
                    isProOrTrial
                      ? 'bg-primary/50 cursor-default pointer-events-none opacity-70'
                      : 'bg-copper-gradient'
                  )}
                  disabled={profile?.plan === 'pro'}
                  tabIndex={isProOrTrial ? -1 : 0}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  <span>
                    {profile?.plan === 'pro' ? 'Already Pro' : isTrial ? 'Pro Trial Active' : 'Unlock Your Kitchen Potential'}
                  </span>
                </Button>

                {/* Pro Trial — subscribe to 40% discount */}
                {isTrial && (
                  <Button
                    variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary/10"
                    onClick={() => setTrialDiscountOpen(true)}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />Unleash Your Culinary Potential
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full comparison table */}
        <Card className="glass border-0 shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold" style={{ maxWidth: 220, width: 220 }}>Feature</th>
                    <th className="text-center py-3 px-4 font-semibold text-[16px] whitespace-nowrap">Free</th>
                    <th className="text-center py-3 px-4 font-semibold text-primary text-[20px] whitespace-nowrap">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map((f, i) => (
                    <tr key={f.label} className={cn('border-b border-border/50 last:border-0', i % 2 === 1 && 'bg-muted/20')}>
                      <td className="py-3 px-4 text-sm font-medium whitespace-nowrap" style={{ maxWidth: 220 }}>{f.label}</td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center">
                          <FeatureCell value={f.free} />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center">
                          <FeatureCell value={f.pro} isPro />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Early Access Modal */}
      <ClaimEarlyAccessModal open={earlyAccessOpen} onClose={() => setEarlyAccessOpen(false)} />
      {/* Trial Discount Modal */}
      <TrialDiscountModal open={trialDiscountOpen} onClose={() => setTrialDiscountOpen(false)} />
    </AppLayout>
  );
}
