import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getInventory, getWasteLogs, getFermentationBatches, getNutritionLogs,
  getAllActiveCookingSessions,
} from '@/lib/api';
import { getDaysUntilExpiry, getExpiryStatus } from '@/lib/shelfLife';
import type { InventoryItem, FermentationBatch, NutritionLog, CookingSession } from '@/types/types';
import { CURRENCY_SYMBOLS } from '@/types/types';
import {
  AlertTriangle, Package, Leaf, TrendingDown, ChefHat,
  ShoppingCart, ArrowRight, Flame, Dumbbell, Wheat,
  Droplets, Clock, Bell, Utensils,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const currencySymbol = CURRENCY_SYMBOLS[profile?.currency ?? 'USD'];
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [fermentationBatches, setFermentationBatches] = useState<FermentationBatch[]>([]);
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([]);
  const [cookingSessions, setCookingSessions] = useState<CookingSession[]>([]);
  const [wasteTotal, setWasteTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      getInventory(user.id),
      getFermentationBatches(user.id),
      getNutritionLogs(user.id, today),
      getWasteLogs(user.id),
      getAllActiveCookingSessions(user.id),
    ]).then(([inv, batches, nutrition, waste, sessions]) => {
      setInventory(inv);
      setFermentationBatches(batches);
      setNutritionLogs(nutrition);
      setCookingSessions(sessions);
      const thisMonth = new Date();
      thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
      setWasteTotal(waste.filter(w => new Date(w.wasted_at) >= thisMonth).reduce((s, w) => s + (w.cost || 0), 0));
    }).finally(() => setLoading(false));
  }, [user]);

  // Derived stats
  const expiringSoon = inventory.filter(item => {
    const days = getDaysUntilExpiry(item.expiry_date);
    return days >= 0 && days <= 3;
  });
  const expired = inventory.filter(item => getDaysUntilExpiry(item.expiry_date) < 0);

  const todayCalories = nutritionLogs.reduce((s, l) => s + l.calories, 0);
  const todayProtein = nutritionLogs.reduce((s, l) => s + l.protein, 0);
  const todayCarbs = nutritionLogs.reduce((s, l) => s + l.carbs, 0);
  const todayFat = nutritionLogs.reduce((s, l) => s + l.fat, 0);
  const calorieTarget = profile?.daily_calorie_target ?? 2000;
  const calorieProgress = Math.min(100, Math.round((todayCalories / calorieTarget) * 100));

  const activeBatches = fermentationBatches.filter(b => !b.is_complete);

  if (loading) return (
    <AppLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-balance">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
            <span className="gradient-text">{profile?.username ?? 'Chef'}</span>!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Here's your kitchen status at a glance.</p>
        </div>

        {/* Alert banner */}
        {(expiringSoon.length > 0 || expired.length > 0) && (
          <div className="glass rounded-xl p-4 border border-warning/30 bg-warning/5 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Bell className="h-5 w-5 text-warning" />
              <span className="font-semibold text-sm">Kitchen Alerts</span>
            </div>
            <div className="flex flex-wrap gap-2 flex-1">
              {expiringSoon.length > 0 && (
                <Badge variant="outline" className="border-warning text-warning bg-warning/10">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {expiringSoon.length} expiring soon
                </Badge>
              )}
              {expired.length > 0 && (
                <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {expired.length} expired
                </Badge>
              )}
            </div>
            <Button asChild size="sm" className="bg-copper-gradient text-primary-foreground shrink-0">
              <Link to="/inventory">View Board <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            icon={<Package className="h-5 w-5" />}
            label="In Stock"
            value={inventory.length.toString()}
            sub="ingredients"
            color="text-primary"
            href="/inventory"
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Expiring"
            value={(expiringSoon.length + expired.length).toString()}
            sub="need attention"
            color="text-warning"
            href="/inventory"
          />
          <StatCard
            icon={<Leaf className="h-5 w-5" />}
            label="Fermenting"
            value={activeBatches.length.toString()}
            sub="active batches"
            color="text-success"
            href="/fermentation"
          />
          <StatCard
            icon={<TrendingDown className="h-5 w-5" />}
            label="Wasted"
            value={`${currencySymbol}${wasteTotal.toFixed(2)}`}
            sub="this month"
            color="text-destructive"
            href="/nutrition"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Today's Nutrition */}
          <Card className="h-full glass border-0 shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                Today's Nutrition
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Calories</span>
                  <span className="font-semibold">{todayCalories} / {calorieTarget} kcal</span>
                </div>
                <Progress value={calorieProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{calorieProgress}% of daily target</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MacroChip icon={<Dumbbell className="h-3 w-3" />} label="Protein" value={`${todayProtein.toFixed(0)}g`} />
                <MacroChip icon={<Wheat className="h-3 w-3" />} label="Carbs" value={`${todayCarbs.toFixed(0)}g`} />
                <MacroChip icon={<Droplets className="h-3 w-3" />} label="Fat" value={`${todayFat.toFixed(0)}g`} />
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/nutrition">View Full Log <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>

          {/* Expiring Items */}
          <Card className="h-full glass border-0 shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                Use These First
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expiringSoon.length === 0 && expired.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  🎉 Everything is fresh!
                </p>
              ) : (
                <div className="space-y-2">
                  {[...expired, ...expiringSoon].slice(0, 5).map(item => {
                    const days = getDaysUntilExpiry(item.expiry_date);
                    const status = getExpiryStatus(days);
                    return (
                      <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.quantity} {item.unit}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            status === 'expired' ? 'border-destructive text-destructive bg-destructive/10 shrink-0' :
                            status === 'warning' ? 'border-destructive text-destructive bg-destructive/10 shrink-0' :
                            'border-warning text-warning bg-warning/10 shrink-0'
                          }
                        >
                          {days < 0 ? 'Expired' : days === 0 ? 'Today' : `${days}d`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
              <Button asChild size="sm" className="w-full mt-3 bg-copper-gradient text-primary-foreground">
                <Link to="/meal-planning">
                  <ChefHat className="h-3 w-3 mr-1" />Plan a Meal
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Live Cooking Sessions */}
        {cookingSessions.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Utensils className="h-4 w-4 text-primary" />
              Live Cooking Sessions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {cookingSessions.map(sess => {
                const progress = sess.total_steps > 0
                  ? Math.min(100, Math.round((sess.current_step / sess.total_steps) * 100))
                  : 0;
                return (
                  <Link key={sess.id} to={`/cooking/${sess.room_code}`}>
                    <Card className="glass border-0 shadow-card hover:shadow-hover transition-all duration-200 cursor-pointer h-full">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate">{sess.recipe_name}</p>
                          <Badge variant="outline" className="text-xs shrink-0 border-primary text-primary">
                            {sess.room_code}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Step {sess.current_step + 1} of {sess.total_steps}
                        </p>
                        <Progress value={progress} className="h-1.5" />
                        <p className="text-xs text-primary font-medium flex items-center gap-1">
                          <ChefHat className="h-3 w-3" />Resume cooking →
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Fermentation */}
        {activeBatches.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Leaf className="h-4 w-4 text-success" />
              Active Fermentation Batches
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {activeBatches.slice(0, 3).map(batch => {
                const progress = Math.min(100, Math.round((batch.current_day / batch.total_days) * 100));
                return (
                  <Card key={batch.id} className="glass border-0 shadow-card h-full">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold truncate">{batch.name}</p>
                        <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                          Day {batch.current_day}/{batch.total_days}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">
                        {batch.fermentation_type.replace('_', ' ')}
                      </p>
                      <Progress value={progress} className="h-1.5" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/fermentation">View All Batches <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Add Ingredients', icon: Package, href: '/inventory?add=true', color: 'bg-primary/10 text-primary' },
              { label: 'Plan a Meal', icon: ChefHat, href: '/meal-planning', color: 'bg-success/10 text-success' },
              { label: 'Start Fermenting', icon: Leaf, href: '/fermentation?new=true', color: 'bg-secondary text-secondary-foreground' },
              { label: 'Grocery List', icon: ShoppingCart, href: '/grocery', color: 'bg-info/10 text-info' },
            ].map(action => (
              <Link key={action.href} to={action.href}>
                <Card className="glass border-0 shadow-card hover:shadow-hover transition-all duration-200 cursor-pointer h-full">
                  <CardContent className="pt-4 pb-4 flex flex-col items-center gap-2 text-center">
                    <div className={`p-2.5 rounded-lg ${action.color}`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium text-pretty">{action.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ icon, label, value, sub, color, href }: {
  icon: React.ReactNode; label: string; value: string;
  sub: string; color: string; href: string;
}) {
  return (
    <Link to={href}>
      <Card className="glass border-0 shadow-card hover:shadow-hover transition-all duration-200 cursor-pointer h-full">
        <CardContent className="pt-4 pb-4">
          <div className={`${color} mb-2`}>{icon}</div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function MacroChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-lg p-2.5 text-center">
      <div className="flex justify-center text-primary mb-1">{icon}</div>
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
