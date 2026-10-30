import { AlertTriangle, Crown, Droplets, Dumbbell, FileDown, Flame, Lock, Pencil, Trash2, TrendingDown, Wheat } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';import { Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { useCacheKey } from '@/hooks/useCacheKey';
import { usePlan } from '@/hooks/usePlan';
import { clearWasteLogs, getNutritionLogs, getWasteLogs, updateProfile } from '@/lib/api';
import { appCache, invalidateCache } from '@/lib/cache';
import { cn } from '@/lib/utils';
import type { NutritionLog, WasteLog } from '@/types/types';
import { CURRENCY_SYMBOLS } from '@/types/types';

const MACRO_COLORS = { calories: '#B87333', protein: '#E8A87C', carbs: '#60A5FA', fat: '#F59E0B' };

interface DayNutrition {
  date: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ── Macro Bank Card ──────────────────────────────────────────────

function MacroBankCard({
  icon, label, value, unit, consumed, target, color, note,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  consumed: number;
  target: number;
  color: string;
  note?: string;
}) {
  const pct = Math.min(100, target > 0 ? (consumed / target) * 100 : 0);
  const remaining = Math.max(0, target - consumed);
  const over = consumed > target;
  return (
    <Card className="glass border-0 shadow-card h-full">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className={cn('flex items-center gap-2', color)}>
            {icon}
            <span className="text-sm font-semibold">{label}</span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">{consumed.toFixed(0)} / {target} {unit}</span>
        </div>
        <Progress value={pct} className="h-2" />
        <p className={cn('text-xs font-medium', over ? 'text-destructive' : 'text-success')}>
          {over ? `${Math.abs(target - consumed).toFixed(0)} ${unit} over` : `${remaining.toFixed(0)} ${unit} remaining`}
        </p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        <p className="text-xs text-muted-foreground">Today's total: <strong className="text-foreground">{value.toFixed(0)} {unit}</strong></p>
      </CardContent>
    </Card>
  );
}

// ── Breakdown period selector ────────────────────────────────────

type BreakdownPeriod = 'today' | 'weekly' | 'monthly' | 'yearly';

export default function NutritionPage() {
  const { user, profile } = useAuth();
  const { isPro } = usePlan();
  const currencySymbol = CURRENCY_SYMBOLS[profile?.currency ?? 'USD'];
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Reactive cache keys — bump on invalidation from other pages
  const logsVersion  = useCacheKey('logs');
  const wasteVersion = useCacheKey('waste');

  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearingWaste, setClearingWaste] = useState(false);
  const [editTargetOpen, setEditTargetOpen] = useState(false);
  const [targetInput, setTargetInput] = useState(String(profile?.daily_calorie_target ?? 2000));
  const [savingTarget, setSavingTarget] = useState(false);
  const [breakdownPeriod, setBreakdownPeriod] = useState<BreakdownPeriod>('today');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Always fetch fresh — version deps force re-fetch after mutations
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [nl, wl] = await Promise.all([
      getNutritionLogs(user.id),
      getWasteLogs(user.id),
    ]);
    setLogs(nl);
    setWasteLogs(wl);
    appCache.set('logs', nl);
    appCache.set('waste', wl);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData, logsVersion, wasteVersion]);

  // Supabase Realtime — live sync while on this page
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('nutrition-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'nutrition_logs', filter: `user_id=eq.${user.id}` },
        () => { invalidateCache('logs'); }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const handleClearWaste = async () => {
    if (!user) return;
    setClearingWaste(true);
    try {
      await clearWasteLogs(user.id);
      setWasteLogs([]);
      toast.success('Food waste history cleared');
    } catch {
      toast.error('Failed to clear waste history');
    } finally {
      setClearingWaste(false);
    }
  };

  const handleSaveTarget = async () => {
    if (!user) return;
    const val = parseInt(targetInput, 10);
    if (isNaN(val) || val < 500 || val > 10000) {
      toast.error('Please enter a value between 500 and 10,000');
      return;
    }
    setSavingTarget(true);
    try {
      await updateProfile(user.id, { daily_calorie_target: val });
      toast.success('Daily calorie target updated');
      setEditTargetOpen(false);
    } catch {
      toast.error('Failed to update target');
    } finally {
      setSavingTarget(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.logged_at.startsWith(today));
  const todayCal     = todayLogs.reduce((s, l) => s + l.calories, 0);
  const todayProtein = todayLogs.reduce((s, l) => s + l.protein, 0);
  const todayCarbs   = todayLogs.reduce((s, l) => s + l.carbs, 0);
  const todayFat     = todayLogs.reduce((s, l) => s + l.fat, 0);
  const target = profile?.daily_calorie_target ?? 2000;
  const remaining = Math.max(0, target - todayCal);

  // Derived macro targets (standard ratios of calorie target)
  const proteinTarget = Math.round(target * 0.3 / 4);  // 30% kcal as grams
  const carbsTarget   = Math.round(target * 0.45 / 4); // 45% kcal as grams
  const fatTarget     = Math.round(target * 0.25 / 9); // 25% kcal as grams

  // Build last-7-days chart data
  const last7: DayNutrition[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayLogs = logs.filter(l => l.logged_at.startsWith(dateStr));
    return {
      date: dateStr,
      label: d.toLocaleDateString('en', { weekday: 'short' }),
      calories: dayLogs.reduce((s, l) => s + l.calories, 0),
      protein:  dayLogs.reduce((s, l) => s + l.protein, 0),
      carbs:    dayLogs.reduce((s, l) => s + l.carbs, 0),
      fat:      dayLogs.reduce((s, l) => s + l.fat, 0),
    };
  });

  // Waste chart — last 7 days line
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1); thisMonthStart.setHours(0, 0, 0, 0);
  const monthWaste = wasteLogs.filter(w => new Date(w.wasted_at) >= thisMonthStart);
  const totalMonthlyWaste = monthWaste.reduce((s, w) => s + w.cost, 0);

  const last7WasteData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayWaste = wasteLogs.filter(w => w.wasted_at.startsWith(dateStr));
    return {
      date: dateStr,
      label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      cost: dayWaste.reduce((s, w) => s + w.cost, 0),
    };
  });

  const macroData = [
    { name: 'Protein', value: Math.round(todayProtein), color: MACRO_COLORS.protein },
    { name: 'Carbs',   value: Math.round(todayCarbs),   color: MACRO_COLORS.carbs },
    { name: 'Fat',     value: Math.round(todayFat),      color: MACRO_COLORS.fat },
  ].filter(d => d.value > 0);

  // ── Breakdown period aggregation ───────────────────────────────
  function buildBreakdown(period: BreakdownPeriod) {
    const now = new Date();
    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      const todayFiltered = logs.filter(l => l.logged_at.startsWith(todayStr));
      return [{
        label: 'Today',
        calories: todayFiltered.reduce((s, l) => s + l.calories, 0),
        protein:  todayFiltered.reduce((s, l) => s + l.protein, 0),
        carbs:    todayFiltered.reduce((s, l) => s + l.carbs, 0),
        fat:      todayFiltered.reduce((s, l) => s + l.fat, 0),
      }];
    }
    if (period === 'weekly') return last7;
    if (period === 'monthly') {
      // Group by week of month
      return Array.from({ length: 4 }, (_, wk) => {
        const start = new Date(now.getFullYear(), now.getMonth(), wk * 7 + 1);
        const end   = new Date(now.getFullYear(), now.getMonth(), (wk + 1) * 7 + 1);
        const wLogs = logs.filter(l => {
          const d = new Date(l.logged_at);
          return d >= start && d < end;
        });
        return {
          label: `Wk ${wk + 1}`,
          calories: wLogs.reduce((s, l) => s + l.calories, 0),
          protein:  wLogs.reduce((s, l) => s + l.protein, 0),
          carbs:    wLogs.reduce((s, l) => s + l.carbs, 0),
          fat:      wLogs.reduce((s, l) => s + l.fat, 0),
        };
      });
    }
    // yearly — last 12 months
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const mLogs = logs.filter(l => {
        const ld = new Date(l.logged_at);
        return ld.getFullYear() === d.getFullYear() && ld.getMonth() === d.getMonth();
      });
      return {
        label: d.toLocaleDateString('en', { month: 'short' }),
        calories: mLogs.reduce((s, l) => s + l.calories, 0),
        protein:  mLogs.reduce((s, l) => s + l.protein, 0),
        carbs:    mLogs.reduce((s, l) => s + l.carbs, 0),
        fat:      mLogs.reduce((s, l) => s + l.fat, 0),
      };
    });
  }

  const breakdownData = buildBreakdown(breakdownPeriod);

  // ── PDF Export ─────────────────────────────────────────────────
  const handleExportPdf = async () => {
    setExportLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const addWatermark = !isPro;
      let y = 20;

      doc.setFontSize(18);
      doc.text('Pochef — Nutrition Report', 14, y);
      y += 10;
      doc.setFontSize(11);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated: ${new Date().toLocaleDateString()} ${addWatermark ? '(Free Plan)' : '(Pro)'}`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 12;

      if (addWatermark) {
        doc.setFontSize(48);
        doc.setTextColor(200, 200, 200);
        doc.text('POCHEF FREE', 30, 160, { angle: 45 });
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
      }

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text("Today's Summary", 14, y); y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(`Calories: ${todayCal} kcal  |  Protein: ${todayProtein.toFixed(0)}g  |  Carbs: ${todayCarbs.toFixed(0)}g  |  Fat: ${todayFat.toFixed(0)}g`, 14, y); y += 14;

      // Last 7 days table
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Last 7 Days', 14, y); y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Date          Calories  Protein  Carbs   Fat', 14, y); y += 6;
      doc.setDrawColor(180); doc.line(14, y, 200, y); y += 4;
      last7.forEach(d => {
        doc.text(
          `${d.label.padEnd(14)}${String(d.calories).padEnd(10)}${String(d.protein.toFixed(0)).padEnd(9)}${String(d.carbs.toFixed(0)).padEnd(8)}${d.fat.toFixed(0)}g`,
          14, y
        );
        y += 6;
        if (y > 270) { doc.addPage(); y = 20; }
      });

      // Recent meals
      y += 6;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Recent Meals', 14, y); y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      logs.slice(0, 15).forEach(log => {
        if (y > 270) { doc.addPage(); y = 20; }
        const date = new Date(log.logged_at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
        doc.text(`${date} — ${log.recipe_name}: ${log.calories} kcal, P:${log.protein.toFixed(0)}g C:${log.carbs.toFixed(0)}g F:${log.fat.toFixed(0)}g`, 14, y);
        y += 6;
      });

      doc.save('pochef-nutrition-report.pdf');
      toast.success('Nutrition report exported!');
      setExportOpen(false);
    } catch {
      toast.error('PDF export failed');
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) return (
    <AppLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 bg-muted rounded-xl" />)}
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold gradient-text text-balance">Nutrition Tracking</h1>
            <p className="text-sm text-muted-foreground">Daily macros, caloric banking, and food waste</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            onClick={() => setExportOpen(true)}
          >
            <FileDown className="h-3.5 w-3.5" />Export PDF
          </Button>
        </div>

        {/* Today's overview chips */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { icon: <Flame className="h-4 w-4" />, label: 'Calories', value: todayCal, unit: 'kcal', color: 'text-primary' },
            { icon: <Dumbbell className="h-4 w-4" />, label: 'Protein', value: Math.round(todayProtein), unit: 'g', color: 'text-chart-2' },
            { icon: <Wheat className="h-4 w-4" />, label: 'Carbs', value: Math.round(todayCarbs), unit: 'g', color: 'text-info' },
            { icon: <Droplets className="h-4 w-4" />, label: 'Fat', value: Math.round(todayFat), unit: 'g', color: 'text-warning' },
          ].map(m => (
            <Card key={m.label} className="glass border-0 shadow-card h-full">
              <CardContent className="pt-4 pb-4">
                <div className={`${m.color} mb-1`}>{m.icon}</div>
                <p className="text-xl font-bold">{m.value}<span className="text-sm font-normal text-muted-foreground ml-1">{m.unit}</span></p>
                <p className="text-xs text-muted-foreground">{m.label} today</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Macro Banks (ALL users) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <MacroBankCard
            icon={<Flame className="h-4 w-4" />}
            label="Daily Caloric Bank"
            value={todayCal}
            unit="kcal"
            consumed={todayCal}
            target={target}
            color="text-primary"
            note={todayCal > 0 && remaining > 0 ? `Suggested dinner: ~${Math.round(remaining * 0.6)}–${remaining} kcal` : undefined}
          />
          <MacroBankCard
            icon={<Dumbbell className="h-4 w-4" />}
            label="Daily Protein Bank"
            value={Math.round(todayProtein)}
            unit="g"
            consumed={todayProtein}
            target={proteinTarget}
            color="text-chart-2"
          />
          <MacroBankCard
            icon={<Wheat className="h-4 w-4" />}
            label="Daily Carbs Bank"
            value={Math.round(todayCarbs)}
            unit="g"
            consumed={todayCarbs}
            target={carbsTarget}
            color="text-info"
          />
          <MacroBankCard
            icon={<Droplets className="h-4 w-4" />}
            label="Daily Fat Bank"
            value={Math.round(todayFat)}
            unit="g"
            consumed={todayFat}
            target={fatTarget}
            color="text-warning"
          />
        </div>

        {/* Edit calorie target inline button */}
        <div className="flex justify-end -mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => { setTargetInput(String(target)); setEditTargetOpen(true); }}
          >
            <Pencil className="h-3 w-3" />Edit daily targets
          </Button>
        </div>

        {/* ── Charts: Pro only for 7-day / stacked ── */}
        {isPro ? (
          <>
            {/* 4x last-7-days charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                { key: 'calories', label: 'Calories — Last 7 Days', color: MACRO_COLORS.calories, unit: 'kcal' },
                { key: 'protein',  label: 'Protein — Last 7 Days',  color: MACRO_COLORS.protein,  unit: 'g' },
                { key: 'carbs',    label: 'Carbs — Last 7 Days',    color: MACRO_COLORS.carbs,    unit: 'g' },
                { key: 'fat',      label: 'Fat — Last 7 Days',      color: MACRO_COLORS.fat,      unit: 'g' },
              ] as const).map(({ key, label, color, unit }) => (
                <Card key={key} className="glass border-0 shadow-card h-full" ref={el => { chartRefs.current[key] = el; }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full min-w-0 overflow-hidden" style={{ height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={last7} margin={{ left: -20, right: 8 }}>
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number) => [`${v.toFixed(0)} ${unit}`, label.split(' — ')[0]]}
                          />
                          <Bar dataKey={key} fill={color} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Stacked bar — all macros last 7 days */}
            <Card className="glass border-0 shadow-card" ref={el => { chartRefs.current['stacked'] = el; }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Macro Breakdown — Last 7 Days (Stacked)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 overflow-hidden" style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={last7} margin={{ left: -20, right: 8 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                      <Bar dataKey="protein" name="Protein (g)" stackId="a" fill={MACRO_COLORS.protein} />
                      <Bar dataKey="carbs"   name="Carbs (g)"   stackId="a" fill={MACRO_COLORS.carbs} />
                      <Bar dataKey="fat"     name="Fat (g)"     stackId="a" fill={MACRO_COLORS.fat} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Breakdown period selector */}
            <Card className="glass border-0 shadow-card" ref={el => { chartRefs.current['breakdown'] = el; }}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-semibold">Macro Breakdown</CardTitle>
                  <div className="flex gap-1">
                    {(['today', 'weekly', 'monthly', 'yearly'] as BreakdownPeriod[]).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setBreakdownPeriod(p)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors capitalize',
                          breakdownPeriod === p
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 overflow-hidden" style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={breakdownData} margin={{ left: -20, right: 8 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                      <Bar dataKey="calories" name="Calories (kcal)" fill={MACRO_COLORS.calories} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="protein"  name="Protein (g)"     fill={MACRO_COLORS.protein} />
                      <Bar dataKey="carbs"    name="Carbs (g)"       fill={MACRO_COLORS.carbs} />
                      <Bar dataKey="fat"      name="Fat (g)"         fill={MACRO_COLORS.fat} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          /* Teaser for free users */
          <Card className="glass border border-primary/20 shadow-card">
            <CardContent className="py-8 text-center space-y-3">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="font-semibold">Advanced Charts — Pro Feature</p>
              <p className="text-sm text-muted-foreground text-pretty max-w-xs mx-auto">
                Unlock 7-day macro trend charts, stacked breakdowns, and weekly/monthly/yearly insights with Pochef Pro.
              </p>
              <Button asChild size="sm" className="bg-copper-gradient text-primary-foreground">
                <Link to="/pricing"><Crown className="h-3.5 w-3.5 mr-1.5" />Upgrade to Pro</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Today's macro pie — all users */}
        <Card className="glass border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Today's Macro Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {macroData.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No meals logged today</p>
              </div>
            ) : (
              <div className="w-full min-w-0 overflow-hidden" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={macroData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {macroData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [`${v}g`, name]} contentStyle={{ fontSize: 12 }} />
                    <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waste Log */}
        <Card className="glass border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />Food Waste This Month
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-destructive text-destructive text-xs">
                  {currencySymbol}{totalMonthlyWaste.toFixed(2)} wasted
                </Badge>
                {wasteLogs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={handleClearWaste}
                    disabled={clearingWaste}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />Clear History
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthWaste.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-4xl mb-2">🎉</p>
                <p className="text-sm font-semibold">Zero waste this month!</p>
                <p className="text-xs text-muted-foreground mt-1">Keep up the great work</p>
              </div>
            ) : (
              <>
                {totalMonthlyWaste > 20 && (
                  <div className="flex items-start gap-2 glass-light rounded-lg p-3 mb-3 border border-warning/30">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      You've wasted <strong className="text-foreground">{currencySymbol}{totalMonthlyWaste.toFixed(2)}</strong> this month.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  {monthWaste.slice(0, 8).map(w => (
                    <div key={w.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium">{w.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(w.wasted_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <span className="text-destructive font-semibold shrink-0 ml-4">{currencySymbol}{w.cost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="w-full min-w-0 overflow-hidden mt-4" style={{ height: 160 }}>
                  <p className="text-xs text-muted-foreground mb-2">Food Waste — Last 7 Days</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={last7WasteData} margin={{ left: -20, right: 8 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`${currencySymbol}${v.toFixed(2)}`, 'Wasted']} contentStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="cost" stroke="hsl(var(--destructive))" strokeWidth={2}
                        dot={{ r: 3, fill: 'hsl(var(--destructive))' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent meals */}
        <Card className="glass border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Meals</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No meals logged yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Meal', 'Cal', 'Protein', 'Carbs', 'Fat', 'Date'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 10).map(log => (
                      <tr key={log.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 font-medium whitespace-nowrap">{log.recipe_name}</td>
                        <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{log.calories}</td>
                        <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{log.protein.toFixed(0)}g</td>
                        <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{log.carbs.toFixed(0)}g</td>
                        <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{log.fat.toFixed(0)}g</td>
                        <td className="py-2 text-muted-foreground whitespace-nowrap text-xs">
                          {new Date(log.logged_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit daily calorie target */}
        <Dialog open={editTargetOpen} onOpenChange={setEditTargetOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">Edit Daily Targets</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">Set your daily calorie target. Macro targets are automatically calculated from it (30% protein, 45% carbs, 25% fat).</p>
              <div>
                <label className="text-sm font-medium mb-1 block">Calorie Target (kcal)</label>
                <Input
                  type="number"
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  min={500}
                  max={10000}
                  className="text-sm"
                />
              </div>
              <div className="glass rounded-lg p-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div><p className="font-semibold text-chart-2">{Math.round(parseInt(targetInput || '2000') * 0.3 / 4)}g</p><p className="text-muted-foreground">Protein</p></div>
                <div><p className="font-semibold text-info">{Math.round(parseInt(targetInput || '2000') * 0.45 / 4)}g</p><p className="text-muted-foreground">Carbs</p></div>
                <div><p className="font-semibold text-warning">{Math.round(parseInt(targetInput || '2000') * 0.25 / 9)}g</p><p className="text-muted-foreground">Fat</p></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditTargetOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveTarget} disabled={savingTarget} className="flex-1 bg-copper-gradient text-primary-foreground">
                  {savingTarget ? 'Saving…' : 'Save Target'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PDF Export Dialog */}
        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileDown className="h-4 w-4 text-primary" />Export Nutrition Report
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="glass rounded-lg p-3 space-y-2 text-sm">
                <p className="font-medium">Your PDF will include:</p>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Today's macro summary</li>
                  <li>• Last 7 days breakdown table</li>
                  <li>• Recent meals log</li>
                  {isPro && <li className="text-success">• All charts (Pro — no watermark)</li>}
                  {!isPro && <li className="text-warning">• Watermarked (Free Plan)</li>}
                </ul>
              </div>
              {!isPro && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Upgrade to Pro for watermark-free exports.{' '}
                    <Link to="/pricing" className="text-primary underline font-medium" onClick={() => setExportOpen(false)}>View Plans</Link>
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setExportOpen(false)}>Cancel</Button>
                <Button onClick={handleExportPdf} disabled={exportLoading} className="flex-1 bg-copper-gradient text-primary-foreground">
                  {exportLoading ? <><Flame className="h-3.5 w-3.5 animate-spin mr-2" />Generating…</> : <><FileDown className="h-3.5 w-3.5 mr-2" />Download PDF</>}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

