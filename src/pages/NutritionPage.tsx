import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getNutritionLogs, getWasteLogs } from '@/lib/api';
import type { NutritionLog, WasteLog } from '@/types/types';
import { CURRENCY_SYMBOLS } from '@/types/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Flame, Dumbbell, Wheat, Droplets, TrendingDown,
  Calendar, AlertTriangle,
} from 'lucide-react';

const MACRO_COLORS = { calories: '#B87333', protein: '#E8A87C', carbs: '#60A5FA', fat: '#F59E0B' };

interface DayNutrition {
  date: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function NutritionPage() {
  const { user, profile } = useAuth();
  const currencySymbol = CURRENCY_SYMBOLS[profile?.currency ?? 'USD'];
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [nl, wl] = await Promise.all([
      getNutritionLogs(user.id),
      getWasteLogs(user.id),
    ]);
    setLogs(nl);
    setWasteLogs(wl);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.logged_at.startsWith(today));
  const todayCal = todayLogs.reduce((s, l) => s + l.calories, 0);
  const todayProtein = todayLogs.reduce((s, l) => s + l.protein, 0);
  const todayCarbs = todayLogs.reduce((s, l) => s + l.carbs, 0);
  const todayFat = todayLogs.reduce((s, l) => s + l.fat, 0);
  const target = profile?.daily_calorie_target ?? 2000;
  const remaining = Math.max(0, target - todayCal);

  // Build last-7-days chart
  const last7: DayNutrition[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayLogs = logs.filter(l => l.logged_at.startsWith(dateStr));
    return {
      date: dateStr,
      label: d.toLocaleDateString('en', { weekday: 'short' }),
      calories: dayLogs.reduce((s, l) => s + l.calories, 0),
      protein: dayLogs.reduce((s, l) => s + l.protein, 0),
      carbs: dayLogs.reduce((s, l) => s + l.carbs, 0),
      fat: dayLogs.reduce((s, l) => s + l.fat, 0),
    };
  });

  // Waste chart — last 30 days grouped by week
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const monthWaste = wasteLogs.filter(w => new Date(w.wasted_at) >= thisMonthStart);
  const totalMonthlyWaste = monthWaste.reduce((s, w) => s + w.cost, 0);

  const macroData = [
    { name: 'Protein', value: Math.round(todayProtein), color: MACRO_COLORS.protein },
    { name: 'Carbs',   value: Math.round(todayCarbs),   color: MACRO_COLORS.carbs },
    { name: 'Fat',     value: Math.round(todayFat),      color: MACRO_COLORS.fat },
  ].filter(d => d.value > 0);

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
        <div>
          <h1 className="text-2xl font-bold gradient-text text-balance">Nutrition Tracking</h1>
          <p className="text-sm text-muted-foreground">Daily macros, caloric banking, and food waste</p>
        </div>

        {/* Today's overview */}
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

        {/* Calorie banking */}
        <Card className="glass border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />Daily Caloric Bank
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Consumed</span>
              <span className="font-semibold">{todayCal} / {target} kcal</span>
            </div>
            <Progress value={Math.min(100, (todayCal / target) * 100)} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span className={`font-medium ${remaining > 0 ? 'text-success' : 'text-destructive'}`}>
                {remaining > 0 ? `${remaining} kcal remaining` : `${Math.abs(remaining)} kcal over`}
              </span>
              <span>{target}</span>
            </div>
            {todayCal > 0 && remaining > 0 && (
              <div className="glass-light rounded-lg p-2.5">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Suggested dinner:</strong> Aim for a meal around{' '}
                  <strong className="text-foreground">{Math.round(remaining * 0.6)}-{remaining} kcal</strong>{' '}
                  to hit your daily target.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 7-day calories chart */}
          <Card className="glass border-0 shadow-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Calories — Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full min-w-0 overflow-hidden" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7} margin={{ left: -20, right: 8 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v} kcal`, 'Calories']}
                    />
                    <Bar dataKey="calories" fill="#B87333" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Macro breakdown pie */}
          <Card className="glass border-0 shadow-card h-full">
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
        </div>

        {/* Waste Log */}
        <Card className="glass border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />Food Waste This Month
              </span>
              <Badge variant="outline" className="border-destructive text-destructive text-xs">
                {currencySymbol}{totalMonthlyWaste.toFixed(2)} wasted
              </Badge>
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
                      Use Meal Planning to prioritize expiring ingredients and reduce waste.
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

                {/* Waste bar chart */}
                {monthWaste.length > 2 && (
                  <div className="w-full min-w-0 overflow-hidden mt-4" style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={monthWaste.slice(0, 8).map(w => ({
                          name: w.item_name.slice(0, 8),
                          cost: w.cost,
                        }))}
                        margin={{ left: -20, right: 8 }}
                      >
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => [`${currencySymbol}${v.toFixed(2)}`, 'Wasted']} contentStyle={{ fontSize: 12 }} />
                        <Bar dataKey="cost" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
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
      </div>
    </AppLayout>
  );
}
