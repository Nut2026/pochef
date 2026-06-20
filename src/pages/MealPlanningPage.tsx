import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getInventory, createMealPlan, getSavedRecipes, saveRecipe, deleteSavedRecipe } from '@/lib/api';
import { getDaysUntilExpiry } from '@/lib/shelfLife';
import type { InventoryItem, MealType, DietaryGoal, CachedRecipe } from '@/types/types';
import { supabase } from '@/db/supabase';
import { cn } from '@/lib/utils';
import {
  ChefHat, Clock, Filter, Zap, UtensilsCrossed,
  RefreshCw, Plus, Sparkles, Timer, MonitorCheck,
  BookmarkCheck, Trash2, X,
} from 'lucide-react';

const COOKING_DEVICES = [
  'Stove', 'Oven', 'Air Fryer', 'Microwave',
  'Slow Cooker', 'Pressure Cooker', 'Rice Cooker', 'Grill/BBQ',
];

const DIETARY_GOALS: { value: DietaryGoal | 'all'; label: string }[] = [
  { value: 'all',          label: 'All Diets' },
  { value: 'balanced',     label: 'Balanced' },
  { value: 'keto',         label: 'Keto' },
  { value: 'vegan',        label: 'Vegan' },
  { value: 'high_protein', label: 'High Protein' },
  { value: 'low_carb',     label: 'Low Carb' },
];

const MEAL_TYPES: { value: MealType | 'all'; label: string }[] = [
  { value: 'all',       label: 'All Meals' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'brunch',    label: 'Brunch' },
  { value: 'lunch',     label: 'Lunch' },
  { value: 'snacks',    label: 'Snacks' },
  { value: 'dinner',    label: 'Dinner' },
  { value: 'supper',    label: 'Supper' },
];

const CUISINES = ['any', 'American', 'Italian', 'Chinese', 'Indian', 'Thai', 'Japanese', 'Mediterranean', 'Mexican'];
const DIFFICULTIES = ['any', 'beginner', 'intermediate', 'advanced'];

interface RecipeCard {
  id: string;
  name: string;
  thumbnail: string;
  cuisine: string;
  category: string;
  instructions: string;
  ingredients: { name: string; measure: string }[];
  prepTimeMins: number;
  difficulty: string;
  mealType: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imagePrompt?: string;
}

// ── Gemini image generation (sequential, unique per recipe) ─────

async function generateRecipeImage(imagePrompt: string, ingredients: string[]): Promise<string> {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return '';
    const ingredientList = ingredients.length > 0 ? ingredients.join(', ') : imagePrompt;
    const prompt = `Professional food photography of ${imagePrompt}. The dish must contain ONLY these exact ingredients: ${ingredientList}. Do not add, infer, or substitute any other ingredients. High-end cookbook style. Beautifully plated, natural lighting, shallow depth of field. No text, no watermarks.`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      }
    );
    if (!res.ok) return '';
    const data = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p: Record<string, unknown>) => p.inlineData);
    if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  } catch { /* non-fatal */ }
  return '';
}

// ── Recipe Detail Modal ──────────────────────────────────────────

function RecipeDetailModal({ recipe, open, onClose, onCook, onSave, isSaved }: {
  recipe: RecipeCard | null;
  open: boolean;
  onClose: () => void;
  onCook: (r: RecipeCard) => void;
  onSave: (r: RecipeCard) => void;
  isSaved?: boolean;
}) {
  if (!recipe) return null;
  const fallback = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=60';
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance pr-6">{recipe.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted">
            <img src={recipe.thumbnail || fallback} alt={recipe.name} className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).src = fallback; }} />
          </div>
          <div className="flex flex-wrap gap-2">
            {recipe.cuisine && <Badge variant="secondary">{recipe.cuisine}</Badge>}
            {recipe.category && <Badge variant="outline">{recipe.category}</Badge>}
            {recipe.mealType && <Badge variant="outline" className="capitalize">{recipe.mealType}</Badge>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {[
              { label: 'Time', value: `${recipe.prepTimeMins} min` },
              { label: 'Difficulty', value: recipe.difficulty },
              { label: 'Calories', value: recipe.calories > 0 ? `${recipe.calories} kcal` : '—' },
              { label: 'Protein', value: recipe.protein > 0 ? `${recipe.protein}g` : '—' },
            ].map(item => (
              <div key={item.label} className="glass rounded-lg p-2.5">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
          {recipe.ingredients.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Ingredients</p>
              <div className="grid grid-cols-2 gap-1">
                {recipe.ingredients.map((ing, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex gap-1">
                    <span className="shrink-0">•</span>
                    <span>{ing.measure} {ing.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {recipe.instructions && (
            <div>
              <p className="text-sm font-semibold mb-2">Steps</p>
              <ol className="space-y-2">
                {recipe.instructions
                  .split(/\n+|(?=\s*\(?[0-9]+[.)]\s)/)
                  .map(s => s.replace(/^\s*\(?[0-9]+[.)]\s*/, '').trim())
                  .filter(s => s.length > 4)
                  .map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{i + 1}</span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
              </ol>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-copper-gradient text-primary-foreground" onClick={() => { onCook(recipe); onClose(); }}>
              <ChefHat className="h-4 w-4 mr-2" />Cook Now
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => { onSave(recipe); onClose(); }}>
              <BookmarkCheck className="h-4 w-4 mr-2" />{isSaved ? 'Saved' : '+ Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Recipe Card Component ────────────────────────────────────────

function RecipeCardComp({ recipe, onCook, onSave, onDetail, savedId, onRemoveSaved }: {
  recipe: RecipeCard;
  onCook: (r: RecipeCard) => void;
  onSave?: (r: RecipeCard) => void;
  onDetail?: (r: RecipeCard) => void;
  savedId?: string;
  onRemoveSaved?: (id: string) => void;
}) {
  const fallback = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60';
  return (
    <Card
      className="glass border-0 shadow-card hover:shadow-hover transition-all duration-200 h-full flex flex-col animate-scale-in cursor-pointer"
      onClick={() => onDetail?.(recipe)}
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-muted relative">
        <img
          src={recipe.thumbnail || fallback}
          alt={recipe.name}
          className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = fallback; }}
        />
        {!recipe.thumbnail && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-muted-foreground/40 animate-spin" />
          </div>
        )}
      </div>
      <CardContent className="pt-3 pb-4 flex flex-col flex-1 gap-2">
        <h3 className="font-semibold text-sm leading-tight text-balance line-clamp-2">{recipe.name}</h3>
        <div className="flex flex-wrap gap-1">
          {recipe.cuisine && <Badge variant="secondary" className="text-xs">{recipe.cuisine}</Badge>}
          {recipe.category && <Badge variant="outline" className="text-xs">{recipe.category}</Badge>}
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{recipe.prepTimeMins} min</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{recipe.difficulty}</span>
          {recipe.calories > 0 && <span>{recipe.calories} kcal</span>}
        </div>
        <div className="flex gap-2 mt-auto pt-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" className="flex-1 bg-copper-gradient text-primary-foreground" onClick={() => onCook(recipe)}>
            <ChefHat className="h-3 w-3 mr-1" />Cook Now
          </Button>
          {onSave && (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onSave(recipe)}>
              <BookmarkCheck className="h-3 w-3 mr-1" />+ Save
            </Button>
          )}
          {onRemoveSaved && savedId && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onRemoveSaved(savedId)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── SESSION STORAGE KEY ──────────────────────────────────────────
const SESSION_KEY = 'pochef_plan_recipes';

// ── Main Page ────────────────────────────────────────────────────

export default function MealPlanningPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSavedTab = location.pathname.endsWith('/saved');

  const [inventory, setInventory]         = useState<InventoryItem[]>([]);
  const [recipes, setRecipes]             = useState<RecipeCard[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]'); } catch { return []; }
  });
  const [savedRecipes, setSavedRecipes]   = useState<{ id: string; recipe: RecipeCard }[]>([]);
  const [loading, setLoading]             = useState(false);
  const [savedLoading, setSavedLoading]   = useState(false);
  const [cookingMinutes, setCookingMinutes] = useState(60);
  const [dietary, setDietary]             = useState<DietaryGoal | 'all'>('all');
  const [mealType, setMealType]           = useState<MealType | 'all'>('all');
  const [cuisine, setCuisine]             = useState('any');
  const [constraints, setConstraints]     = useState('');
  const [useUpMode, setUseUpMode]         = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [splitMode, setSplitMode]         = useState<'single' | 'split'>('single');
  const [prioritizeExpiring, setPrioritizeExpiring] = useState(true);
  const [hasSearched, setHasSearched]     = useState(recipes.length > 0);
  const [detailRecipe, setDetailRecipe]   = useState<RecipeCard | null>(null);
  const imageGenRef = useRef<number>(0);

  const [cookingDevices, setCookingDevices] = useState<string[]>(profile?.cooking_devices ?? []);
  useEffect(() => { if (profile?.cooking_devices) setCookingDevices(profile.cooking_devices); }, [profile]);

  // Persist plan recipes to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(recipes)); } catch { /* ignore */ }
  }, [recipes]);

  // Load inventory + saved recipes
  useEffect(() => {
    if (!user) return;
    getInventory(user.id).then(setInventory);
    loadSavedRecipes();
  }, [user]);

  const loadSavedRecipes = useCallback(async () => {
    if (!user) return;
    setSavedLoading(true);
    try {
      const data = await getSavedRecipes(user.id);
      setSavedRecipes(data.map(d => ({ id: d.id, recipe: d.recipe_json as unknown as RecipeCard })));
    } catch { /* ignore */ } finally {
      setSavedLoading(false);
    }
  }, [user]);

  const toggleDevice = (d: string) =>
    setCookingDevices(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const expiringIngredients = inventory
    .filter(item => getDaysUntilExpiry(item.expiry_date) <= 3)
    .sort((a, b) => getDaysUntilExpiry(a.expiry_date) - getDaysUntilExpiry(b.expiry_date));

  const generateRecipes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setHasSearched(true);
    setRecipes([]);
    const genId = ++imageGenRef.current;
    try {
      const inventoryContext = inventory
        .map(i => `${i.name} (qty:${i.quantity} ${i.unit}, expires in ${getDaysUntilExpiry(i.expiry_date)}d)`)
        .join(', ');

      const { data, error } = await supabase.functions.invoke('ai-recipe-suggestions', {
        body: {
          inventory: inventoryContext,
          filters: { dietary, mealType, cookingMinutes, cuisine, constraints, useUpMode, selectedIngredient, splitMode, cookingDevices, prioritizeExpiring },
        },
      });
      if (error) throw new Error(error.message);

      const rawRecipes: RecipeCard[] = (data?.recipes || []).map((r: Record<string, unknown>) => ({
        id: (r.id as string) || Math.random().toString(36).slice(2),
        name: r.name as string,
        thumbnail: '',
        cuisine: (r.area as string) || cuisine,
        category: (r.category as string) || '',
        instructions: (r.instructions as string) || '',
        ingredients: (r.ingredients as { name: string; measure: string }[]) || [],
        prepTimeMins: Number(r.prepTimeMins) || cookingMinutes,
        difficulty: (r.difficulty as string) || 'intermediate',
        mealType: (r.mealType as string) || (mealType === 'all' ? 'dinner' : mealType),
        calories: Number(r.calories) || 0,
        protein: Number(r.protein) || 0,
        carbs: Number(r.carbs) || 0,
        fat: Number(r.fat) || 0,
        imagePrompt: (r.imagePrompt as string) || (r.name as string),
      }));

      setRecipes(rawRecipes);

      if (typeof pendo !== 'undefined') {
        pendo.track('recipe_suggestions_generated', {
          recipe_count: rawRecipes.length,
          dietary_filter: dietary,
          meal_type_filter: mealType,
          cuisine_filter: cuisine,
          cooking_minutes: cookingMinutes,
          use_up_mode: useUpMode,
          selected_ingredient: selectedIngredient || null,
          split_mode: splitMode,
          prioritize_expiring: prioritizeExpiring,
          cooking_devices_count: cookingDevices.length,
          has_constraints: !!constraints.trim(),
          inventory_size: inventory.length,
        });
      }

      // Sequential unique image generation — one at a time to avoid duplicates
      (async () => {
        for (let idx = 0; idx < rawRecipes.length; idx++) {
          if (imageGenRef.current !== genId) break; // abort if new generation started
          const recipe = rawRecipes[idx];
          const imageUrl = await generateRecipeImage(
            recipe.imagePrompt || recipe.name,
            recipe.ingredients.map(ing => `${ing.measure} ${ing.name}`)
          );
          if (imageGenRef.current !== genId) break;
          if (imageUrl) {
            setRecipes(prev => prev.map((r, i) => i === idx ? { ...r, thumbnail: imageUrl } : r));
          }
        }
      })();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  }, [user, inventory, dietary, mealType, cookingMinutes, cuisine, constraints, useUpMode, selectedIngredient, splitMode, cookingDevices, prioritizeExpiring]);

  const handleCookNow = async (recipe: RecipeCard) => {
    try {
      const { data } = await supabase.from('cached_recipes').upsert({
        meal_db_id: null,
        name: recipe.name,
        cuisine: recipe.cuisine,
        category: recipe.category,
        instructions: recipe.instructions,
        ingredients: recipe.ingredients,
        thumbnail_url: recipe.thumbnail,
        prep_time_mins: recipe.prepTimeMins,
        difficulty: recipe.difficulty,
        meal_type: recipe.mealType,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        updated_at: new Date().toISOString(),
      }).select().maybeSingle();
      navigate(`/cooking`, { state: { recipe } });
      void data;
    } catch {
      navigate('/cooking', { state: { recipe } });
    }
  };

  const handleSave = async (recipe: RecipeCard) => {
    if (!user) return;
    try {
      const id = await saveRecipe(user.id, recipe as unknown as Record<string, unknown>);
      setSavedRecipes(prev => [{ id, recipe }, ...prev]);
      if (typeof pendo !== 'undefined') {
        pendo.track('recipe_saved', {
          recipe_name: recipe.name,
          cuisine: recipe.cuisine,
          meal_type: recipe.mealType,
          difficulty: recipe.difficulty,
          prep_time_mins: recipe.prepTimeMins,
          calories: recipe.calories,
        });
      }
      toast.success(`${recipe.name} saved!`);
    } catch { toast.error('Failed to save recipe'); }
  };

  const handleRemoveSaved = async (id: string) => {
    const removed = savedRecipes.find(r => r.id === id);
    if (typeof pendo !== 'undefined' && removed) {
      pendo.track('recipe_unsaved', {
        recipe_name: removed.recipe?.name ?? '',
      });
    }
    const snapshot = savedRecipes;
    setSavedRecipes(prev => prev.filter(r => r.id !== id));
    try { await deleteSavedRecipe(id); }
    catch { setSavedRecipes(snapshot); toast.error('Failed to remove'); }
  };

  const savedIds = new Set(savedRecipes.map(r => r.recipe?.name));

  return (
    <AppLayout>
      {/* Tab nav */}
      <div className="flex gap-1 mb-5 border-b border-border">
        <button
          onClick={() => navigate('/meal-planning/plan')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
            !isSavedTab
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <ChefHat className="h-3.5 w-3.5 inline mr-1.5" />Plan
        </button>
        <button
          onClick={() => navigate('/meal-planning/saved')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
            isSavedTab
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <BookmarkCheck className="h-3.5 w-3.5 inline mr-1.5" />Saved ({savedRecipes.length})
        </button>
      </div>

      {/* ── PLAN TAB ── */}
      {!isSavedTab && (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold gradient-text text-balance">Meal Planning</h1>
            <p className="text-sm text-muted-foreground">Smart suggestions from and for your inventory</p>
          </div>

          {/* Cooking Devices */}
          <Card className="glass border-0 shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MonitorCheck className="h-4 w-4 text-primary" />Cooking Devices
              </CardTitle>
              <p className="text-xs text-muted-foreground">Select available devices so AI only suggests recipes you can actually make</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {COOKING_DEVICES.map(d => (
                  <button key={d} onClick={() => toggleDevice(d)}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      cookingDevices.includes(d)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                    )}>{d}</button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card className="glass border-0 shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />Filters & Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-normal text-muted-foreground">Dietary Goal</Label>
                  <Select value={dietary} onValueChange={v => setDietary(v as DietaryGoal | 'all')}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{DIETARY_GOALS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-normal text-muted-foreground">Meal Type</Label>
                  <Select value={mealType} onValueChange={v => setMealType(v as MealType | 'all')}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{MEAL_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-normal text-muted-foreground">Cuisine</Label>
                  <Select value={cuisine} onValueChange={setCuisine}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CUISINES.map(c => <SelectItem key={c} value={c}>{c === 'any' ? 'Any Cuisine' : c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-normal text-muted-foreground">Difficulty</Label>
                  <Select defaultValue="any">
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d === 'any' ? 'Any Difficulty' : d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                  <Timer className="h-3 w-3" />Pantry to Plate:{' '}
                  <span className="font-semibold text-foreground ml-1">
                    {cookingMinutes < 60 ? `${cookingMinutes} min` : `${Math.floor(cookingMinutes / 60)}h${cookingMinutes % 60 > 0 ? ` ${cookingMinutes % 60}m` : ''}`}
                  </span>
                </Label>
                <Slider value={[cookingMinutes]} onValueChange={([v]) => setCookingMinutes(v)} min={15} max={180} step={5} className="mt-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>15 min</span><span>3 hours</span></div>
              </div>
              <div>
                <Label className="text-xs font-normal text-muted-foreground">Natural Language Constraints</Label>
                <Input value={constraints} onChange={e => setConstraints(e.target.value)}
                  placeholder='e.g. "No nuts, use broccoli, avoid spicy"' className="mt-1 text-sm" />
              </div>
              <div className="glass-light rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => setUseUpMode(m => !m)}
                    className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${useUpMode ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                    {useUpMode && <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-7z" /></svg>}
                  </button>
                  <Label className="text-xs font-medium cursor-pointer">Use-Up Mode — choose an ingredient to use up completely</Label>
                </div>
                {useUpMode && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Select value={selectedIngredient} onValueChange={setSelectedIngredient}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select ingredient" /></SelectTrigger>
                      <SelectContent>
                        {expiringIngredients.map(i => <SelectItem key={i.id} value={i.name}>{i.name} ({i.quantity}{i.unit})</SelectItem>)}
                        {inventory.filter(i => !expiringIngredients.find(e => e.id === i.id)).slice(0, 10).map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={splitMode} onValueChange={v => setSplitMode(v as 'single' | 'split')}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">One dish (100%)</SelectItem>
                        <SelectItem value="split">Split between 2 meals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPrioritizeExpiring(e => !e)}
                  className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${prioritizeExpiring ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                  {prioritizeExpiring && <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-7z" /></svg>}
                </button>
                <Label className="text-xs font-normal">Prioritize expiring ingredients first</Label>
              </div>
              <Button onClick={generateRecipes} disabled={loading} className="w-full bg-copper-gradient text-primary-foreground h-10">
                {loading
                  ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Generating with AI…</>
                  : <><Sparkles className="h-4 w-4 mr-2" />Generate Recipe Suggestions</>}
              </Button>
            </CardContent>
          </Card>

          {expiringIngredients.length > 0 && !hasSearched && (
            <div className="glass rounded-xl p-3 border border-warning/30 bg-warning/5">
              <p className="text-sm font-medium text-warning flex items-center gap-2">
                <Zap className="h-4 w-4 shrink-0" />
                {expiringIngredients.length} ingredient{expiringIngredients.length > 1 ? 's' : ''} expiring soon:{' '}
                <span className="font-normal text-foreground">{expiringIngredients.slice(0, 3).map(i => i.name).join(', ')}</span>
              </p>
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <Card key={i} className="border-0 h-full">
                  <Skeleton className="aspect-[4/3] rounded-t-xl bg-muted" />
                  <CardContent className="pt-3 space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-muted" /><Skeleton className="h-3 w-1/2 bg-muted" />
                    <div className="flex gap-2 mt-3"><Skeleton className="h-8 flex-1 bg-muted" /><Skeleton className="h-8 flex-1 bg-muted" /></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!loading && hasSearched && recipes.length === 0 && (
            <div className="glass rounded-2xl p-12 text-center">
              <UtensilsCrossed className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="font-semibold text-muted-foreground">No recipes matched your filters</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your constraints or time limit</p>
            </div>
          )}
          {!loading && recipes.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{recipes.length} suggestions — click a recipe to see details</p>
                <Button variant="ghost" size="sm" onClick={generateRecipes}><RefreshCw className="h-3 w-3 mr-1" />Regenerate</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {recipes.map(recipe => (
                  <RecipeCardComp
                    key={recipe.id}
                    recipe={recipe}
                    onCook={handleCookNow}
                    onSave={handleSave}
                    onDetail={setDetailRecipe}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SAVED TAB ── */}
      {isSavedTab && (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold gradient-text text-balance">Saved Recipes</h1>
            <p className="text-sm text-muted-foreground">Recipes you've saved for later</p>
          </div>
          {savedLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-xl bg-muted" />)}
            </div>
          ) : savedRecipes.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <BookmarkCheck className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="font-semibold text-muted-foreground">No saved recipes yet</p>
              <p className="text-sm text-muted-foreground mt-1">Go to Plan and click "+ Save" on any recipe</p>
              <Button className="mt-4 bg-copper-gradient text-primary-foreground" onClick={() => navigate('/meal-planning/plan')}>
                <ChefHat className="h-4 w-4 mr-2" />Go to Plan
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {savedRecipes.map(({ id, recipe }) => (
                <RecipeCardComp
                  key={id}
                  recipe={recipe}
                  onCook={handleCookNow}
                  onDetail={setDetailRecipe}
                  savedId={id}
                  onRemoveSaved={handleRemoveSaved}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={detailRecipe}
        open={!!detailRecipe}
        onClose={() => setDetailRecipe(null)}
        onCook={handleCookNow}
        onSave={handleSave}
        isSaved={detailRecipe ? savedIds.has(detailRecipe.name) : false}
      />
    </AppLayout>
  );
}
