import {ArrowRightLeft,
  BookmarkCheck, Check, 
  ChefHat, Clock, FileDown,Filter, Folder, 
  FolderOpen, MonitorCheck,Pencil, Plus, 
  RefreshCw, Sparkles, Timer, Trash2, Users, UtensilsCrossed,X, Zap, 
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { createCookingSession, createMealFolder, deleteMealFolder, deleteSavedRecipe, getInventory, getMealFolders, getSavedRecipes, saveRecipe, updateMealFolderName, updateSavedRecipeFolder } from '@/lib/api';
import { appCache, invalidateCache } from '@/lib/cache';
import { getDaysUntilExpiry } from '@/lib/shelfLife';
import { cn } from '@/lib/utils';
import type { CachedRecipe, DietaryGoal, InventoryItem, MealType } from '@/types/types';

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
  instructions: string | { step_number?: number; instruction: string; time_mins?: number }[];
  ingredients: { name: string; measure: string }[];
  prepTimeMins: number;
  difficulty: string;
  mealType: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servings: number;
  imagePrompt?: string;
}

// ── Gemini image generation removed ─────────────────────────────

// ── parseSteps helper ────────────────────────────────────────────

function parseStepsForModal(instructions: RecipeCard['instructions']): string[] {
  // Structured array from Groq
  if (Array.isArray(instructions)) {
    return instructions
      .sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0))
      .map(s => s.instruction.trim())
      .filter(s => s.length > 3);
  }
  if (!instructions || typeof instructions !== 'string') return [];
  const str = instructions.trim();
  // Split on numbered patterns: "1. " / "1) " / "(1) "
  const parts = str.split(/\n+|(?:\s*\(?[0-9]+[).]\s+)/).map(s => s.replace(/^\s*\(?[0-9]+[).]\s*/, '').trim()).filter(s => s.length > 4);
  if (parts.length > 1) return parts;
  // Sentence split fallback
  return str.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 10);
}

// ── Recipe Detail Modal ──────────────────────────────────────────

function RecipeDetailModal({ recipe, open, onClose, onCook, onSave, isSaved, pax, onPaxChange, maxPax }: {
  recipe: RecipeCard | null;
  open: boolean;
  onClose: () => void;
  onCook: (r: RecipeCard) => void;
  onSave: (r: RecipeCard) => void;
  isSaved?: boolean;
  pax: number;
  onPaxChange: (p: number) => void;
  maxPax?: number;
}) {
  if (!recipe) return null;

  const steps = parseStepsForModal(recipe.instructions);

  // Scale ingredient measure by pax ratio (base pax = recipe.servings ?? 2)
  const baseServings = (recipe as RecipeCard & { servings?: number }).servings ?? 2;
  const ratio = pax / baseServings;
  const scaledIngredients = recipe.ingredients.map(ing => {
    const num = parseFloat(ing.measure);
    if (!isNaN(num) && num > 0) {
      const scaled = Math.round(num * ratio * 100) / 100;
      const unit = ing.measure.replace(/^[\d.]+\s*/, '');
      return { ...ing, measure: `${scaled}${unit ? ' ' + unit : ''}` };
    }
    return ing;
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance pr-6">{recipe.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
              { label: 'Carbs', value: recipe.carbs > 0 ? `${recipe.carbs}g` : '—' },
              { label: 'Fat', value: recipe.fat > 0 ? `${recipe.fat}g` : '—' },
            ].map(item => (
              <div key={item.label} className="glass rounded-lg p-2.5">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Pax slider */}
          {(maxPax ?? 10) > 1 && (
            <div className="glass rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />Serves
                </span>
                <span className="text-sm font-semibold text-primary">{pax} pax</span>
              </div>
              <Slider value={[pax]} onValueChange={([v]) => onPaxChange(v)} min={1} max={maxPax ?? 10} step={1} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>1</span><span>{maxPax ?? 10}</span></div>
            </div>
          )}
          {(maxPax ?? 10) <= 1 && (
            <div className="glass rounded-lg p-3">
              <p className="text-sm text-muted-foreground text-center">
                Enough for <span className="font-semibold text-foreground">1 pax</span> with current inventory
              </p>
            </div>
          )}

          {scaledIngredients.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Ingredients</p>
              <div className="grid grid-cols-2 gap-1">
                {scaledIngredients.map((ing, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex gap-1">
                    <span className="shrink-0">•</span>
                    <span>{ing.measure} {ing.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {steps.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Steps</p>
              <ol className="space-y-2">
                {steps.map((step, i) => (
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

function RecipeCardComp({ recipe, onCook, onSave, onDetail, savedId, onRemoveSaved, onMoveToFolder, pax, onPaxChange, maxPax }: {
  recipe: RecipeCard;
  onCook: (r: RecipeCard) => void;
  onSave?: (r: RecipeCard) => void;
  onDetail?: (r: RecipeCard) => void;
  savedId?: string;
  onRemoveSaved?: (id: string) => void;
  onMoveToFolder?: (id: string) => void;
  pax: number;
  onPaxChange: (p: number) => void;
  maxPax?: number;
}) {
  return (
    <Card
      className="glass border-0 shadow-card hover:shadow-hover transition-all duration-200 h-full flex flex-col animate-scale-in cursor-pointer"
      onClick={() => onDetail?.(recipe)}
    >
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
        {/* Pax slider per card */}
        <div className="space-y-1 pt-1" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />Serves</span>
            <span className="font-semibold text-foreground">{pax} pax</span>
          </div>
          {(maxPax ?? 10) > 1 ? (
            <Slider value={[pax]} onValueChange={([v]) => onPaxChange(v)} min={1} max={maxPax ?? 10} step={1} className="h-1" />
          ) : (
            <p className="text-xs text-muted-foreground text-center">Enough for 1 pax</p>
          )}
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
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive shrink-0 px-2" onClick={() => onRemoveSaved(savedId)}>
              <X className="h-3 w-3 mr-1" />Remove
            </Button>
          )}
          {onMoveToFolder && savedId && (
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-primary shrink-0 px-2" onClick={() => onMoveToFolder(savedId)}>
              <ArrowRightLeft className="h-3 w-3 mr-1" />Move
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { ProUpgradeModal } from '@/components/common/ProUpgradeModal';
import { useCacheKey } from '@/hooks/useCacheKey';
import { usePlan } from '@/hooks/usePlan';

// ── SESSION STORAGE KEY ──────────────────────────────────────────
const SESSION_KEY = 'pochef_plan_recipes';
// ── FILTER DEFAULTS KEY ──────────────────────────────────────────
const FILTER_DEFAULTS_KEY = 'pochef_filter_defaults';

// ── Main Page ────────────────────────────────────────────────────

// Load saved filter defaults from localStorage
function loadFilterDefaults() {
  try {
    return JSON.parse(localStorage.getItem(FILTER_DEFAULTS_KEY) || 'null');
  } catch { return null; }
}

export default function MealPlanningPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isPro } = usePlan();
  const isSavedTab = location.pathname.endsWith('/saved') || location.pathname === '/meal-planning/saved';

  // Reactive cache key — re-fetch when inventory is mutated elsewhere
  const invVersion = useCacheKey('inventory');

  // Pro upgrade modal state
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // PDF export loading for Saved tab
  const [exportingPdf, setExportingPdf] = useState(false);
  // Saved export selection
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(new Set());
  // Export mode: checkboxes only visible when true
  const [exportMode, setExportMode] = useState(false);

  const defaults = loadFilterDefaults();

  const [inventory, setInventory]         = useState<InventoryItem[]>([]);
  const [recipes, setRecipes]             = useState<RecipeCard[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]'); } catch { return []; }
  });
  const [savedRecipes, setSavedRecipes]   = useState<{ id: string; recipe: RecipeCard; folder_id?: string | null }[]>([]);
  const [folders, setFolders]             = useState<{ id: string; name: string }[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue]     = useState('');
  const [moveRecipeId, setMoveRecipeId]   = useState<string | null>(null);
  const [moveTargetFolder, setMoveTargetFolder] = useState<string>('');
  const [loading, setLoading]             = useState(false);
  const [savedLoading, setSavedLoading]   = useState(false);
  const [cookingMinutes, setCookingMinutes] = useState<number>(defaults?.cookingMinutes ?? 45);
  const [dietary, setDietary]             = useState<DietaryGoal | 'all'>(defaults?.dietary ?? 'all');
  const [mealType, setMealType]           = useState<MealType | 'all'>(defaults?.mealType ?? 'all');
  const [cuisine, setCuisine]             = useState<string>(defaults?.cuisine ?? 'any');
  const [difficulty, setDifficulty]       = useState<string>(defaults?.difficulty ?? 'any');
  const [constraints, setConstraints]     = useState<string>(defaults?.constraints ?? '');
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [splitMode, setSplitMode]         = useState<'single' | 'split'>('single');
  const [prioritizeExpiring, setPrioritizeExpiring] = useState<boolean>(defaults?.prioritizeExpiring ?? true);
  const [hasSearched, setHasSearched]     = useState(recipes.length > 0);
  const [detailRecipe, setDetailRecipe]   = useState<RecipeCard | null>(null);
  const [paxMap, setPaxMap] = useState<Record<string, number>>({});

  const [cookingDevices, setCookingDevices] = useState<string[]>(profile?.cooking_devices ?? []);
  useEffect(() => { if (profile?.cooking_devices) setCookingDevices(profile.cooking_devices); }, [profile]);

  // Batch meal planning state
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchDays, setBatchDays] = useState(3);
  const [batchMeals, setBatchMeals] = useState<string[]>(['lunch', 'dinner']);
  const [batchLoading, setBatchLoading] = useState(false);

  const batchMealOptions = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'dinner', label: 'Dinner' },
  ];

  // Save current filter settings as default
  const handleSetDefault = () => {
    const defaults = { cookingMinutes, dietary, mealType, cuisine, difficulty, constraints, prioritizeExpiring };
    localStorage.setItem(FILTER_DEFAULTS_KEY, JSON.stringify(defaults));
    toast.success('Filter defaults saved! These settings will load next time.');
  };

  // Export selected saved recipes as PDF
  const handleExportPdf = async () => {
    if (!isPro) { setUpgradeOpen(true); return; }
    if (!exportMode) {
      // Enter export mode
      setExportMode(true);
      return;
    }
    // Export Now clicked
    if (selectedForExport.size === 0) { toast.error('Select at least 1 recipe to export'); return; }
    const toExport = savedRecipes.filter(r => selectedForExport.has(r.id));
    if (toExport.length === 0) { toast.error('No recipes to export'); return; }
    setExportingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      let y = 20;
      doc.setFontSize(18);
      doc.text('Pochef — Saved Recipes', 14, y);
      y += 12;
      toExport.forEach(({ recipe }, idx) => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`${idx + 1}. ${recipe.name}`, 14, y);
        y += 7;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const meta = [
          recipe.difficulty && `Difficulty: ${recipe.difficulty}`,
          recipe.prepTimeMins && `Time: ${recipe.prepTimeMins} min`,
          recipe.calories && `Calories: ${recipe.calories} kcal`,
        ].filter(Boolean).join('  |  ');
        if (meta) { doc.text(meta, 14, y); y += 6; }
        if (recipe.ingredients?.length) {
          doc.setFont('helvetica', 'bold');
          doc.text('Ingredients:', 14, y); y += 5;
          doc.setFont('helvetica', 'normal');
          recipe.ingredients.forEach(ing => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(`• ${ing.measure} ${ing.name}`, 18, y); y += 5;
          });
        }
        const steps = parseStepsForModal(recipe.instructions);
        if (steps.length) {
          if (y > 260) { doc.addPage(); y = 20; }
          doc.setFont('helvetica', 'bold');
          doc.text('Steps:', 14, y); y += 5;
          doc.setFont('helvetica', 'normal');
          steps.forEach((step, si) => {
            const lines = doc.splitTextToSize(`${si + 1}. ${step}`, 180);
            if (y + lines.length * 5 > 270) { doc.addPage(); y = 20; }
            doc.text(lines, 14, y); y += lines.length * 5 + 2;
          });
        }
        y += 8;
      });
      doc.save('pochef-saved-recipes.pdf');
      toast.success(`Exported ${toExport.length} recipe${toExport.length !== 1 ? 's' : ''}`);
      setExportMode(false);
      setSelectedForExport(new Set());
    } catch {
      toast.error('PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  // Persist plan recipes to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(recipes)); } catch { /* ignore */ }
  }, [recipes]);

  // Load inventory + saved recipes — always fetch fresh, version dep re-fetches on invalidation
  useEffect(() => {
    if (!user) return;
    getInventory(user.id).then(data => {
      setInventory(data);
      appCache.set('inventory', data);
    });
    loadSavedRecipes();
  }, [user, invVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase Realtime — live inventory sync while on this page
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('mealplan-inventory-rt')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items', filter: `user_id=eq.${user.id}` },
        () => { invalidateCache('inventory'); }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const loadSavedRecipes = useCallback(async () => {
    if (!user) return;
    setSavedLoading(true);
    try {
      const [recipeData, folderData] = await Promise.all([
        getSavedRecipes(user.id),
        getMealFolders(user.id),
      ]);
      setSavedRecipes(recipeData.map(d => ({ id: d.id, recipe: d.recipe_json as unknown as RecipeCard, folder_id: (d as { folder_id?: string | null }).folder_id ?? null })));
      setFolders(folderData.map(f => ({ id: f.id, name: f.name })));
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
    if (!isPro) { setUpgradeOpen(true); return; }
    if (inventory.length === 0) {
      toast.error('Add at least 1 ingredient to your inventory before generating recipes.');
      return;
    }
    setLoading(true);
    setHasSearched(true);
    setRecipes([]);
    try {
      const inventoryContext = inventory
        .map(i => `${i.name} (qty:${i.quantity} ${i.unit}, amount:${i.amount_value}${i.amount_unit}, expires in ${getDaysUntilExpiry(i.expiry_date)}d)`)
        .join(', ');

      const { data, error } = await supabase.functions.invoke('ai-recipe-suggestions', {
        body: {
          inventory: inventoryContext,
          filters: { dietary, mealType, cookingMinutes, cuisine, difficulty, constraints, selectedIngredient, splitMode, cookingDevices, prioritizeExpiring },
        },
      });
      if (error) throw new Error(error.message);

      const rawRecipes: RecipeCard[] = (data?.recipes || []).map((r: Record<string, unknown>) => ({
        id: (r.id as string) || Math.random().toString(36).slice(2),
        name: r.name as string,
        thumbnail: '',
        cuisine: (r.area as string) || cuisine,
        category: (r.category as string) || '',
        instructions: (r.instructions as string | { instruction: string; time_mins?: number }[]) || '',
        ingredients: (r.ingredients as { name: string; measure: string }[]) || [],
        prepTimeMins: Number(r.prepTimeMins) || cookingMinutes,
        difficulty: (r.difficulty as string) || 'intermediate',
        mealType: (r.mealType as string) || (mealType === 'all' ? 'dinner' : mealType),
        calories: Number(r.calories) || 0,
        protein: Number(r.protein) || 0,
        carbs: Number(r.carbs) || 0,
        fat: Number(r.fat) || 0,
        imagePrompt: '',
        servings: Number(r.servings) || 2,
      }));

      setRecipes(rawRecipes);
      setPaxMap(prev => {
        const next = { ...prev };
        rawRecipes.forEach(r => { if (!(r.id in next)) next[r.id] = 2; });
        return next;
      });
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  }, [user, isPro, inventory, dietary, mealType, cookingMinutes, cuisine, difficulty, constraints, selectedIngredient, splitMode, cookingDevices, prioritizeExpiring]);

  const handleCookNow = async (recipe: RecipeCard) => {
    if (!user) return;
    const pax = paxMap[recipe.id ?? ''] ?? recipe.servings ?? 2;
    const recipeWithPax = { ...recipe, servings: pax };
    try {
      const session = await createCookingSession(user.id, {
        recipe_name: recipeWithPax.name,
        current_step: 0,
        total_steps: Array.isArray(recipeWithPax.instructions) ? recipeWithPax.instructions.length : 0,
        is_active: true,
        messages: [],
        steps_json: [],
        // Store full recipe data so it survives re-entry without location.state
        recipe_json: {
          name: recipeWithPax.name,
          ingredients: recipeWithPax.ingredients,
          instructions: recipeWithPax.instructions,
          calories: recipeWithPax.calories,
          protein: recipeWithPax.protein,
          carbs: recipeWithPax.carbs,
          fat: recipeWithPax.fat,
          servings: recipeWithPax.servings,
          difficulty: recipeWithPax.difficulty,
          prepTimeMins: recipeWithPax.prepTimeMins,
          cuisine: recipeWithPax.cuisine,
          mealType: recipeWithPax.mealType,
        } as Record<string, unknown>,
      });
      navigate(`/cooking/${session.room_code}`, { state: { recipe: recipeWithPax } });
    } catch {
      // Fallback: navigate without session
      navigate('/cooking', { state: { recipe: recipeWithPax } });
    }
  };

  // Compute max pax per recipe based on available inventory quantities
  const getMaxPax = useCallback((recipe: RecipeCard): number => {
    if (!recipe.ingredients?.length || !inventory.length) return 10;
    let maxPax = 10;
    const base = recipe.servings ?? 2;
    for (const ing of recipe.ingredients) {
      const invItem = inventory.find(i =>
        i.name.toLowerCase().includes(ing.name.toLowerCase()) ||
        ing.name.toLowerCase().includes(i.name.toLowerCase())
      );
      if (!invItem) continue;
      const needed = parseFloat(ing.measure);
      if (isNaN(needed) || needed <= 0) continue;
      const perServing = needed / base;
      if (perServing <= 0) continue;
      const possible = Math.floor(invItem.quantity / perServing);
      if (possible < maxPax) maxPax = possible;
    }
    return Math.max(1, maxPax);
  }, [inventory]);

  const handleSaveRecipe = async (recipe: RecipeCard) => {
    if (!user) return;
    try {
      const id = await saveRecipe(user.id, recipe as unknown as Record<string, unknown>);
      setSavedRecipes(prev => [{ id, recipe }, ...prev]);
      toast.success(`${recipe.name} saved!`);
    } catch { toast.error('Failed to save recipe'); }
  };

  const handleRemoveSaved = async (id: string) => {
    const snapshot = savedRecipes;
    setSavedRecipes(prev => prev.filter(r => r.id !== id));
    try { await deleteSavedRecipe(id); }
    catch { setSavedRecipes(snapshot); toast.error('Failed to remove'); }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!renameValue.trim()) { setRenameFolderId(null); return; }
    try {
      await updateMealFolderName(folderId, renameValue.trim());
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: renameValue.trim() } : f));
      setRenameFolderId(null);
      toast.success('Folder renamed');
    } catch { toast.error('Failed to rename folder'); }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder? Recipes inside will remain but become ungrouped.')) return;
    try {
      await deleteMealFolder(folderId);
      setFolders(prev => prev.filter(f => f.id !== folderId));
      setSavedRecipes(prev => prev.map(r => r.folder_id === folderId ? { ...r, folder_id: null } : r));
      toast.success('Folder deleted');
    } catch { toast.error('Failed to delete folder'); }
  };

  const handleMoveRecipe = async (recipeId: string, folderId: string | null) => {
    try {
      await updateSavedRecipeFolder(recipeId, folderId);
      setSavedRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, folder_id: folderId } : r));
      setMoveRecipeId(null);
      toast.success(folderId ? 'Recipe moved to folder' : 'Recipe removed from folder');
    } catch { toast.error('Failed to move recipe'); }
  };

  const handleBatchGenerate = async () => {
    if (!user || !isPro) { setUpgradeOpen(true); return; }
    if (inventory.length === 0) {
      toast.error('Add at least 1 ingredient to your inventory before generating recipes.');
      return;
    }
    if (batchMeals.length === 0) { toast.error('Select at least 1 meal type'); return; }
    setBatchLoading(true);
    try {
      const inventoryContext = inventory
        .map(i => `${i.name} (qty:${i.quantity} ${i.unit}, amount:${i.amount_value}${i.amount_unit}, expires in ${getDaysUntilExpiry(i.expiry_date)}d)`)
        .join(', ');

      const daysRecipes: RecipeCard[][] = [];
      for (let day = 1; day <= batchDays; day++) {
        const { data, error } = await supabase.functions.invoke('ai-recipe-suggestions', {
          body: {
            inventory: inventoryContext,
            filters: { dietary, mealType: batchMeals, cookingMinutes, cuisine, difficulty, constraints, selectedIngredient, splitMode, cookingDevices, prioritizeExpiring, dayNumber: day, totalDays: batchDays },
          },
        });
        if (error) throw new Error(error.message);
        const rawRecipes: RecipeCard[] = (data?.recipes || []).map((r: Record<string, unknown>) => ({
          id: (r.id as string) || Math.random().toString(36).slice(2),
          name: r.name as string,
          thumbnail: '',
          cuisine: (r.area as string) || cuisine,
          category: (r.category as string) || '',
          instructions: (r.instructions as string | { instruction: string; time_mins?: number }[]) || '',
          ingredients: (r.ingredients as { name: string; measure: string }[]) || [],
          prepTimeMins: Number(r.prepTimeMins) || cookingMinutes,
          difficulty: (r.difficulty as string) || 'intermediate',
          mealType: (r.mealType as string) || (batchMeals[0] ?? 'dinner'),
          calories: Number(r.calories) || 0,
          protein: Number(r.protein) || 0,
          carbs: Number(r.carbs) || 0,
          fat: Number(r.fat) || 0,
          imagePrompt: '',
          servings: Number(r.servings) || 2,
        }));
        daysRecipes.push(rawRecipes);
      }

      // Create folder and save all recipes
      const folderName = `${batchDays}-Day ${batchMeals.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join('/')} Plan`;
      const folderId = await createMealFolder(user.id, folderName);
      const allSaved: { id: string; recipe: RecipeCard; folder_id: string | null }[] = [];
      for (const dayRecipes of daysRecipes) {
        for (const recipe of dayRecipes) {
          const id = await saveRecipe(user.id, recipe as unknown as Record<string, unknown>);
          // Update folder_id directly after save
          await updateSavedRecipeFolder(id, folderId);
          allSaved.push({ id, recipe, folder_id: folderId });
        }
      }
      setSavedRecipes(prev => [...allSaved, ...prev]);
      setFolders(prev => [{ id: folderId, name: folderName }, ...prev]);
      setExpandedFolders(prev => new Set(prev).add(folderId));
      setBatchOpen(false);
      toast.success(`Created ${folderName} with ${allSaved.length} recipes`);
      navigate('/meal-planning/saved');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Batch generation failed');
    } finally {
      setBatchLoading(false);
    }
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
              <p className="text-xs text-muted-foreground">{"Select available devices so Pochef suggests recipes you can actually make"}</p>
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" />Filters & Preferences
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleSetDefault}
                >
                  <BookmarkCheck className="h-3 w-3" />Set as Default
                </Button>
              </div>
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
                  <Select value={difficulty} onValueChange={setDifficulty}>
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
                <Label className="text-xs font-normal text-muted-foreground">Additional Requirements (optional)</Label>
                <Input value={constraints} onChange={e => setConstraints(e.target.value)}
                  placeholder='e.g. "No nuts, use broccoli, avoid spicy"' className="mt-1 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPrioritizeExpiring(e => !e)}
                  className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${prioritizeExpiring ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                  {prioritizeExpiring && <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-7z" /></svg>}
                </button>
                <Label className="text-xs font-normal">Prioritize expiring ingredients first</Label>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={generateRecipes} disabled={loading} className="w-full bg-copper-gradient text-primary-foreground h-10">
                  {loading
                    ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Smart Generating Recipes…</>
                    : <><Sparkles className="h-4 w-4 mr-2" />{isPro ? 'Smart Generate Recipes' : '🔒 Smart Generate (Pro)'}</>}
                </Button>
                {isPro && (
                  <Button variant="outline" onClick={() => setBatchOpen(true)} className="w-full h-10">
                    <FolderOpen className="h-4 w-4 mr-2" />Batch Meal Plan
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

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
                    onSave={handleSaveRecipe}
                    onDetail={setDetailRecipe}
                    pax={paxMap[recipe.id] ?? 2}
                    onPaxChange={p => setPaxMap(prev => ({ ...prev, [recipe.id]: p }))}
                    maxPax={getMaxPax(recipe)}
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold gradient-text text-balance">Saved Recipes</h1>
              <p className="text-sm text-muted-foreground">Recipes you've saved for later</p>
            </div>
            {savedRecipes.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                {exportMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setExportMode(false); setSelectedForExport(new Set()); }}
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={exportingPdf || (exportMode && selectedForExport.size === 0)}
                  variant={exportMode ? 'default' : 'outline'}
                  className={exportMode ? 'bg-copper-gradient text-primary-foreground' : ''}
                >
                  {exportingPdf
                    ? <><RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />Exporting…</>
                    : exportMode
                      ? <><FileDown className="h-3.5 w-3.5 mr-1.5" />Export Now</>
                      : <><FileDown className="h-3.5 w-3.5 mr-1.5" />{isPro ? 'Export PDF' : '🔒 Export PDF'}</>}
                </Button>
              </div>
            )}
          </div>
          {exportMode && selectedForExport.size > 0 && (
            <p className="text-xs text-muted-foreground">{selectedForExport.size} recipe{selectedForExport.size !== 1 ? 's' : ''} selected</p>
          )}
          {savedLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-xl bg-muted" />)}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Folders */}
              {folders.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Folder className="h-4 w-4 text-primary" />Meal Plans
                  </h3>
                  {folders.map(folder => {
                    const folderRecipes = savedRecipes.filter(r => r.folder_id === folder.id);
                    const isExpanded = expandedFolders.has(folder.id);
                    return (
                      <div key={folder.id} className="glass rounded-xl border border-border/50 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedFolders(prev => {
                            const next = new Set(prev);
                            if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id);
                            return next;
                          })}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                            {renameFolderId === folder.id ? (
                              <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                                <Input
                                  value={renameValue}
                                  onChange={e => setRenameValue(e.target.value)}
                                  className="h-7 text-sm py-0"
                                  autoFocus
                                  onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setRenameFolderId(null); }}
                                />
                                <Button size="sm" className="h-7 px-2" onClick={() => handleRenameFolder(folder.id)}><Check className="h-3 w-3" /></Button>
                              </div>
                            ) : (
                              <span className="text-sm font-medium truncate">{folder.name}</span>
                            )}
                            <span className="text-xs text-muted-foreground shrink-0">({folderRecipes.length})</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {renameFolderId !== folder.id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={e => { e.stopPropagation(); setRenameFolderId(folder.id); setRenameValue(folder.name); }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={e => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <span className={cn('ml-1 transition-transform', isExpanded ? 'rotate-180' : '')}>▼</span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {folderRecipes.map(({ id, recipe }) => (
                              <div key={id} className="relative">
                                {exportMode && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedForExport(prev => {
                                      const next = new Set(prev);
                                      if (next.has(id)) next.delete(id); else next.add(id);
                                      return next;
                                    })}
                                    className={cn(
                                      'absolute top-2 right-2 z-10 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors',
                                      selectedForExport.has(id)
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : 'bg-background/80 border-border hover:border-primary'
                                    )}
                                  >
                                    {selectedForExport.has(id) && <Check className="h-3 w-3" />}
                                  </button>
                                )}
                                <RecipeCardComp
                                  recipe={recipe}
                                  onCook={handleCookNow}
                                  onDetail={setDetailRecipe}
                                  savedId={id}
                                  onRemoveSaved={handleRemoveSaved}
                                  onMoveToFolder={setMoveRecipeId}
                                  pax={paxMap[recipe.id ?? id] ?? recipe.servings ?? 2}
                                  onPaxChange={p => setPaxMap(prev => ({ ...prev, [recipe.id ?? id]: p }))}
                                  maxPax={getMaxPax(recipe)}
                                />
                              </div>
                            ))}
                            {folderRecipes.length === 0 && (
                              <p className="text-sm text-muted-foreground col-span-full text-center py-4">No recipes in this folder</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Ungrouped recipes */}
              {savedRecipes.some(r => !r.folder_id) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Individual Recipes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {savedRecipes.filter(r => !r.folder_id).map(({ id, recipe }) => (
                      <div key={id} className="relative">
                        {exportMode && (
                          <button
                            type="button"
                            onClick={() => setSelectedForExport(prev => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id); else next.add(id);
                              return next;
                            })}
                            className={cn(
                              'absolute top-2 right-2 z-10 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors',
                              selectedForExport.has(id)
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'bg-background/80 border-border hover:border-primary'
                            )}
                          >
                            {selectedForExport.has(id) && <Check className="h-3 w-3" />}
                          </button>
                        )}
                        <RecipeCardComp
                          recipe={recipe}
                          onCook={handleCookNow}
                          onDetail={setDetailRecipe}
                          savedId={id}
                          onRemoveSaved={handleRemoveSaved}
                          onMoveToFolder={setMoveRecipeId}
                          pax={paxMap[recipe.id ?? id] ?? recipe.servings ?? 2}
                          onPaxChange={p => setPaxMap(prev => ({ ...prev, [recipe.id ?? id]: p }))}
                          maxPax={getMaxPax(recipe)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Move recipe modal */}
              <Dialog open={!!moveRecipeId} onOpenChange={o => { if (!o) setMoveRecipeId(null); }}>
                <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Move to Folder</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" onClick={() => moveRecipeId && handleMoveRecipe(moveRecipeId, null)}>
                      <ArrowRightLeft className="h-4 w-4 mr-2" />Remove from folder
                    </Button>
                    {folders.map(f => (
                      <Button key={f.id} variant="outline" className="w-full justify-start" onClick={() => moveRecipeId && handleMoveRecipe(moveRecipeId, f.id)}>
                        <Folder className="h-4 w-4 mr-2" />{f.name}
                      </Button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      )}
      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={detailRecipe}
        open={!!detailRecipe}
        onClose={() => setDetailRecipe(null)}
        onCook={r => { handleCookNow({ ...r, servings: paxMap[r.id ?? ''] ?? r.servings }); }}
        onSave={handleSaveRecipe}
        isSaved={detailRecipe ? savedIds.has(detailRecipe.name) : false}
        pax={detailRecipe ? (paxMap[detailRecipe.id ?? ''] ?? detailRecipe.servings ?? 2) : 2}
        onPaxChange={p => detailRecipe && setPaxMap(prev => ({ ...prev, [detailRecipe.id ?? '']: p }))}
        maxPax={detailRecipe ? getMaxPax(detailRecipe) : 10}
      />
      {/* Batch Meal Plan Dialog */}
      <Dialog open={batchOpen} onOpenChange={o => { if (!o) setBatchOpen(false); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />Batch Meal Plan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-normal text-muted-foreground">Number of Days (1–7)</Label>
              <div className="flex items-center gap-3 mt-1">
                <Slider value={[batchDays]} onValueChange={([v]) => setBatchDays(v)} min={1} max={7} step={1} />
                <span className="text-sm font-semibold w-8 text-center">{batchDays}</span>
              </div>
            </div>
            <div>
              <Label className="text-xs font-normal text-muted-foreground">Meals per Day</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {batchMealOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBatchMeals(prev => prev.includes(opt.value) ? prev.filter(m => m !== opt.value) : [...prev, opt.value])}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      batchMeals.includes(opt.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                    )}
                  >
                    {batchMeals.includes(opt.value) && <Check className="h-3 w-3 inline mr-1" />}{opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              Pochef will generate <strong>{batchDays}</strong> day{batchDays !== 1 ? 's' : ''} of{' '}
              <strong>{batchMeals.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')}</strong>{' '}
              recipes based on your inventory.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setBatchOpen(false)}>Cancel</Button>
              <Button onClick={handleBatchGenerate} disabled={batchLoading || batchMeals.length === 0} className="flex-1 bg-copper-gradient text-primary-foreground">
                {batchLoading ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Generating…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Batch</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </AppLayout>
  );
}
