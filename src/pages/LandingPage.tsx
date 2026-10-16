import {
  ArrowDown, BarChart3, Brain, Check, 
  ChefHat, Crown,Droplets,Dumbbell, Flame, Leaf, 
  Package, Shield, ShoppingCart,Star, UtensilsCrossed, Wheat, X, Zap, 
} from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ── Section refs for smooth scrolling ──────────────────────────
const LOGO = '/pochef-logo.png';

const FEATURES = [
  {
    icon: Package,
    title: 'Smart Inventory',
    desc: 'Track every ingredient with real-time expiry alerts. Pochef warns you before food goes to waste — saving money effortlessly.',
    color: 'bg-primary/10 text-primary',
  },
  {
    icon: Leaf,
    title: 'Fermentation Studio',
    desc: 'Log and monitor your fermentation batches from kombucha to kimchi. Get progress updates and tasting notes in one place.',
    color: 'bg-success/10 text-success',
  },
  {
    icon: UtensilsCrossed,
    title: 'AI Meal Planning',
    desc: "Pochef's AI analyses your exact inventory and generates recipes that use what you already have — zero waste, endless variety.",
    color: 'bg-info/10 text-info',
  },
  {
    icon: ChefHat,
    title: 'Live Cooking Sessions',
    desc: 'Step-by-step AI-guided cooking with real-time assistance. Ask questions mid-cook and get instant answers from Pochef Apprentice.',
    color: 'bg-warning/10 text-warning',
  },
  {
    icon: BarChart3,
    title: 'Nutrition Tracking',
    desc: 'Log meals automatically and track daily calories, protein, carbs, and fat. Pro users unlock 7-day trends and macro breakdowns.',
    color: 'bg-chart-2/10 text-chart-2',
  },
  {
    icon: ShoppingCart,
    title: 'Grocery Intelligence',
    desc: 'Never forget an ingredient. Pochef builds smart grocery lists from your meal plans and inventory gaps — with Pro Smart Suggest.',
    color: 'bg-destructive/10 text-destructive',
  },
];

const TECH = [
  { icon: Brain, label: 'Groq AI', desc: 'Ultra-fast LLM inference powering recipe generation, shelf-life prediction, and smart suggestions.' },
  { icon: Zap, label: 'Real-time Sync', desc: 'Supabase Realtime keeps every device in perfect sync — changes appear instantly across all sessions.' },
  { icon: Shield, label: 'Private & Secure', desc: 'Row-level security ensures your kitchen data is only ever visible to you. No sharing, no selling.' },
];

interface PlanFeatureRow { label: string; free: string | boolean; pro: string | boolean }
const PLAN_FEATURES: PlanFeatureRow[] = [
  { label: 'Inventory Storage',    free: 'Up to 50 items',       pro: 'Unlimited' },
  { label: 'Fermentation Batches', free: 'Up to 2 active',       pro: 'Unlimited' },
  { label: 'Nutrition & Macros',   free: 'Daily tracking',       pro: 'Advanced weekly, monthly & yearly' },
  { label: 'Meal Planning',        free: 'Daily suggestions',    pro: 'Batch meal planning (7 days)' },
  { label: 'Smart Grocery Suggest',free: false,                  pro: true },
  { label: 'Export Meal Plans',    free: false,                  pro: 'Watermark-free PDFs' },
  { label: 'Export Nutrition',     free: 'Basic with watermarks',pro: 'Watermark-free PDFs' },
];

const FAQ = [
  {
    q: 'Is Pochef free to use?',
    a: "Yes! Pochef has a generous free tier with inventory tracking, meal planning, nutrition logging, and cooking sessions. Upgrade to Pro for advanced analytics, unlimited storage, batch planning, and watermark-free exports.",
  },
  {
    q: 'How does AI Meal Planning work?',
    a: "Pochef reads your current inventory — every ingredient, quantity, and expiry date — and sends it to our AI. The AI generates recipes tailored exactly to what you have, prioritising items that expire soonest.",
  },
  {
    q: 'What is a Cooking Session?',
    a: "When you start cooking a recipe, Pochef opens a live session with step-by-step instructions and an AI assistant (Pochef Apprentice) you can chat with in real time. Ask anything — substitutions, timings, techniques.",
  },
  {
    q: 'How does nutrition tracking work?',
    a: "When you mark a meal as eaten, Pochef automatically adds its calories, protein, carbs, and fat to your daily log. The matching ingredients are also deducted from your inventory automatically.",
  },
  {
    q: 'Can I try Pro before paying?',
    a: "Absolutely. Start a 28-day Pro Trial for free — no credit card required. You get full access to every Pro feature during the trial period.",
  },
  {
    q: 'Is my data private?',
    a: "Yes. All your kitchen data is protected with row-level security. Only you can read or modify your data. We never sell or share your information.",
  },
];

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === false) return <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  return (
    <div className="flex items-start gap-1.5 justify-center text-center">
      {value === true
        ? <Check className="h-4 w-4 text-success shrink-0" />
        : <><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /><span className="text-xs text-left">{value}</span></>
      }
    </div>
  );
}

export default function LandingPage() {
  const featuresRef  = useRef<HTMLDivElement | null>(null);
  const techRef      = useRef<HTMLDivElement | null>(null);
  const pricingRef   = useRef<HTMLDivElement | null>(null);
  const faqRef       = useRef<HTMLDivElement | null>(null);

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-background)' }}>
      {/* ── Sticky Navigation ── */}
      <header className="sticky top-0 z-50 glass-heavy border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={LOGO} alt="Pochef" className="h-8 w-8 rounded-lg" />
            <span className="font-bold gradient-text text-lg leading-none">Pochef</span>
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            {[
              { label: 'Features', ref: featuresRef },
              { label: 'Technology', ref: techRef },
              { label: 'Pricing', ref: pricingRef },
              { label: 'FAQ', ref: faqRef },
            ].map(({ label, ref }) => (
              <button
                key={label}
                type="button"
                onClick={() => scrollTo(ref)}
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                {label}
              </button>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
              <Link to="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild className="bg-copper-gradient text-primary-foreground">
              <Link to="/login">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </header>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none opacity-20 -z-0"
             style={{ background: 'radial-gradient(circle, #E8A87C55, transparent 70%)', transform: 'translate(30%, -20%)' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full pointer-events-none opacity-15 -z-0"
             style={{ background: 'radial-gradient(circle, #B8733344, transparent 70%)', transform: 'translate(-30%, 20%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 py-20 md:py-32 text-center">
          <Badge variant="outline" className="mb-5 border-primary/30 text-primary bg-primary/5 text-xs px-3 py-1">
            <Star className="h-3 w-3 mr-1.5 fill-current" />Your Digital Kitchen Twin
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold gradient-text text-balance leading-tight mb-5">
            Cook Smarter.<br />Waste Less.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground text-pretty max-w-2xl mx-auto mb-8">
            Pochef is the AI-powered kitchen companion that tracks your inventory, plans your meals, guides your cooking,
            and monitors your nutrition — all in one beautifully designed app.
          </p>
          <div className="flex flex-col md:flex-row gap-3 justify-center items-center">
            <Button size="lg" asChild className="bg-copper-gradient text-primary-foreground w-full md:w-auto px-8">
              <Link to="/login">
                <Zap className="h-4 w-4 mr-2" />Start for Free
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full md:w-auto px-8" onClick={() => scrollTo(featuresRef)}>
              <ArrowDown className="h-4 w-4 mr-2" />See Features
            </Button>
          </div>

          {/* Quick macro preview chips */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg mx-auto">
            {[
              { icon: <Flame className="h-4 w-4" />, label: 'Calories', color: 'text-primary' },
              { icon: <Dumbbell className="h-4 w-4" />, label: 'Protein', color: 'text-chart-2' },
              { icon: <Wheat className="h-4 w-4" />, label: 'Carbs', color: 'text-info' },
              { icon: <Droplets className="h-4 w-4" />, label: 'Fat', color: 'text-warning' },
            ].map(m => (
              <div key={m.label} className="glass rounded-xl py-3 px-2 flex flex-col items-center gap-1">
                <span className={m.color}>{m.icon}</span>
                <span className="text-xs font-medium">{m.label}</span>
                <span className="text-[10px] text-muted-foreground">Tracked daily</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ── Features ── */}
      <section ref={featuresRef} className="max-w-6xl mx-auto px-4 md:px-6 py-20 scroll-mt-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold gradient-text text-balance mb-3">Everything Your Kitchen Needs</h2>
          <p className="text-muted-foreground text-pretty max-w-xl mx-auto">
            Six powerful modules working together to make your kitchen smarter, healthier, and waste-free.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <Card key={f.title} className="glass border-0 shadow-card h-full hover:shadow-hover transition-shadow duration-300">
              <CardContent className="pt-6 pb-6 flex flex-col gap-3 h-full">
                <div className={cn('p-3 rounded-xl w-fit', f.color)}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-base">{f.title}</h3>
                <p className="text-sm text-muted-foreground text-pretty flex-1">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      {/* ── Technology ── */}
      <section ref={techRef} className="scroll-mt-16 py-20" style={{ background: 'rgba(184,115,51,0.04)' }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold gradient-text text-balance mb-3">Built on Modern Technology</h2>
            <p className="text-muted-foreground text-pretty max-w-xl mx-auto">
              Pochef combines the fastest AI models with real-time infrastructure for a seamless, responsive experience.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TECH.map(t => (
              <div key={t.label} className="glass rounded-2xl p-6 text-center space-y-3 h-full">
                <div className="flex justify-center">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <t.icon className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold">{t.label}</h3>
                <p className="text-sm text-muted-foreground text-pretty">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ── Pricing ── */}
      <section ref={pricingRef} className="max-w-5xl mx-auto px-4 md:px-6 py-20 scroll-mt-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold gradient-text text-balance mb-3">Simple, Honest Pricing</h2>
          <p className="text-muted-foreground text-pretty max-w-xl mx-auto">
            Start free forever. Upgrade to Pro when you're ready to unlock the full kitchen experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Free */}
          <Card className="glass border border-border shadow-card h-full flex flex-col">
            <CardContent className="pt-6 pb-6 flex flex-col gap-4 h-full">
              <div>
                <p className="font-bold text-xl mb-1">Free</p>
                <p className="text-3xl font-bold">$0<span className="text-base font-normal text-muted-foreground"> / month</span></p>
              </div>
              <p className="text-sm text-muted-foreground">Everything you need to get started. No credit card required.</p>
              <Button variant="outline" className="w-full mt-auto" asChild>
                <Link to="/login">Get Started Free</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Pro */}
          <div className="relative rounded-xl p-[2px] pricing-pro-border">
            <div className="pricing-border-anim rounded-xl absolute inset-0 pointer-events-none" />
            <Card className="glass border-0 shadow-hover h-full flex flex-col relative overflow-hidden rounded-[10px]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-copper-gradient" />
              <CardContent className="pt-7 pb-6 flex flex-col gap-4 h-full">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="h-4 w-4 text-primary" />
                    <p className="font-bold text-xl">Pro</p>
                    <Badge className="bg-copper-gradient text-primary-foreground text-[10px]">The Powerhouse</Badge>
                  </div>
                  <p className="text-3xl font-bold">$4.99<span className="text-base font-normal text-muted-foreground"> / month</span></p>
                  <p className="text-sm text-success font-medium mt-0.5">or $39.99/yr — Save 33%</p>
                </div>
                <p className="text-sm text-muted-foreground">Full power, unlimited everything, AI-powered features.</p>
                <Button className="w-full mt-auto bg-copper-gradient text-primary-foreground" asChild>
                  <Link to="/pricing">
                    <Crown className="h-4 w-4 mr-2" />
                    <span>Start 28-day Free Trial</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Comparison table */}
        <Card className="glass border-0 shadow-card overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left py-3 px-4 text-sm font-semibold whitespace-nowrap" style={{ maxWidth: 200 }}>Feature</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm whitespace-nowrap">Free</th>
                    <th className="text-center py-3 px-4 font-semibold text-primary text-sm whitespace-nowrap">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_FEATURES.map((f, i) => (
                    <tr key={f.label} className={cn('border-b border-border/50 last:border-0', i % 2 === 1 && 'bg-muted/10')}>
                      <td className="py-2.5 px-4 text-sm font-medium whitespace-nowrap">{f.label}</td>
                      <td className="py-2.5 px-4 text-center"><FeatureCell value={f.free} /></td>
                      <td className="py-2.5 px-4 text-center"><FeatureCell value={f.pro} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
      {/* ── FAQ ── */}
      <section ref={faqRef} className="scroll-mt-16 py-20" style={{ background: 'rgba(184,115,51,0.04)' }}>
        <div className="max-w-3xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold gradient-text text-balance mb-3">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="glass rounded-xl overflow-hidden group">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer font-medium text-sm select-none list-none">
                  {q}
                  <span className="shrink-0 text-muted-foreground group-open:rotate-180 transition-transform duration-200">▾</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-muted-foreground text-pretty border-t border-border/50 pt-3">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
      {/* ── Footer CTA ── */}
      <section className="py-20 text-center px-4">
        <div className="max-w-2xl mx-auto space-y-5">
          <img src={LOGO} alt="Pochef" className="h-14 w-14 rounded-2xl mx-auto shadow-lg" />
          <h2 className="font-bold gradient-text text-balance text-[3px] md:text-[3px]">Ready for a Smarter Kitchen?</h2>
          <p className="text-muted-foreground text-pretty">
            Join thousands of home cooks already using Pochef to eat better, waste less, and cook with confidence.
          </p>
          <Button size="lg" asChild className="bg-copper-gradient text-primary-foreground px-10">
            <Link to="/login">
              <Zap className="h-4 w-4 mr-2" />
              <span>Get Started — It's Free</span>
            </Link>
          </Button>
        </div>
      </section>
      {/* ── Footer ── */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={LOGO} alt="Pochef" className="h-5 w-5 rounded" />
            <span>Pochef — Your Digital Kitchen Twin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">Sign Up</Link>
          </div>
          <p>© {new Date().getFullYear()} Pochef. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
