import { supabase } from '@/db/supabase';
import type {
  InventoryItem, FermentationBatch, FermentationStage,
  WasteLog, CachedRecipe, MealPlan, CookingSession,
  NutritionLog, GroceryListItem, RipeningItem, StorageLocation,
  GrocerySetting,
} from '@/types/types';
import { estimateExpiryDate } from '@/lib/shelfLife';

// ── Inventory ──────────────────────────────────────────────────

export async function getInventory(userId: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('user_id', userId)
    .eq('is_consumed', false)
    .order('expiry_date', { ascending: true })
    .limit(200);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function addInventoryItem(
  userId: string,
  item: Partial<InventoryItem> & { name: string; storage_location: StorageLocation }
): Promise<void> {
  const purchaseDate = item.purchase_date ? new Date(item.purchase_date) : new Date();

  // Determine expiry_date: prefer ai_shelf_life for the chosen storage, else local estimate
  let expiryDate = item.expiry_date;
  if (!expiryDate) {
    const aiSL = item.ai_shelf_life;
    if (aiSL) {
      const daysForStorage = aiSL[item.storage_location];
      if (typeof daysForStorage === 'number' && daysForStorage > 0) {
        const d = new Date(purchaseDate);
        d.setDate(d.getDate() + daysForStorage);
        expiryDate = d.toISOString().split('T')[0];
      }
    }
    if (!expiryDate) {
      expiryDate = estimateExpiryDate(item.name, purchaseDate, item.storage_location)
        .toISOString()
        .split('T')[0];
    }
  }

  const { error } = await supabase.from('inventory_items').insert({
    user_id: userId,
    name: item.name,
    quantity: item.quantity ?? 1,
    unit: item.unit ?? 'piece',
    amount_value: item.amount_value ?? 0,
    amount_unit: item.amount_unit ?? 'g',
    storage_location: item.storage_location,
    purchase_date: purchaseDate.toISOString().split('T')[0],
    expiry_date: expiryDate,
    price: item.price ?? 0,
    category: item.category ?? 'other',
    ai_shelf_life: item.ai_shelf_life ?? null,
    is_fruit: item.is_fruit ?? false,
    ripening_days: item.ripening_days ?? null,
    position_x: item.position_x ?? Math.floor(Math.random() * 800),
    position_y: item.position_y ?? Math.floor(Math.random() * 400),
  });
  if (error) throw error;
}

export async function updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<void> {
  const { error } = await supabase
    .from('inventory_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from('inventory_items').delete().eq('id', id);
  if (error) throw error;
}

export async function markItemConsumed(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_items')
    .update({ is_consumed: true, consumed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateItemPosition(id: string, x: number, y: number): Promise<void> {
  const { error } = await supabase
    .from('inventory_items')
    .update({ position_x: x, position_y: y, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function autoLogNutrition(
  userId: string,
  description: string,
  servings: number = 1
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('auto-log-nutrition', {
      body: { description, servings },
    });
    if (error) throw error;
    const { calories = 0, protein = 0, carbs = 0, fat = 0 } = data ?? {};
    await logNutrition(userId, {
      recipe_name: description,
      calories,
      protein,
      carbs,
      fat,
      servings,
      logged_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Auto-log nutrition failed (non-blocking):', err);
  }
}

// ── Ripening ───────────────────────────────────────────────────

export async function getRipeningItems(userId: string): Promise<RipeningItem[]> {
  const { data, error } = await supabase
    .from('ripening_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function upsertRipeningItem(item: Partial<RipeningItem>): Promise<void> {
  const { error } = await supabase.from('ripening_items').upsert({
    ...item,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ── Fermentation ───────────────────────────────────────────────

export async function getFermentationBatches(userId: string): Promise<FermentationBatch[]> {
  const { data, error } = await supabase
    .from('fermentation_batches')
    .select('*')
    .eq('user_id', userId)
    .eq('is_complete', false)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createFermentationBatch(
  userId: string,
  batch: Partial<FermentationBatch>
): Promise<FermentationBatch> {
  const { data, error } = await supabase
    .from('fermentation_batches')
    .insert({ user_id: userId, ...batch })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as FermentationBatch;
}

export async function updateFermentationBatch(id: string, updates: Partial<FermentationBatch>): Promise<void> {
  const { error } = await supabase
    .from('fermentation_batches')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteFermentationBatch(id: string): Promise<void> {
  const { error } = await supabase.from('fermentation_batches').delete().eq('id', id);
  if (error) throw error;
}

export async function getFermentationStages(batchId: string): Promise<FermentationStage[]> {
  const { data, error } = await supabase
    .from('fermentation_stages')
    .select('*')
    .eq('batch_id', batchId)
    .order('day_number', { ascending: true })
    .limit(100);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function upsertFermentationStage(stage: Partial<FermentationStage>): Promise<void> {
  const { error } = await supabase.from('fermentation_stages').upsert(stage);
  if (error) throw error;
}

// ── Waste Log ──────────────────────────────────────────────────

export async function logWaste(
  userId: string,
  itemName: string,
  cost: number,
  inventoryItemId?: string
): Promise<void> {
  const { error } = await supabase.from('waste_log').insert({
    user_id: userId,
    item_name: itemName,
    cost,
    inventory_item_id: inventoryItemId ?? null,
  });
  if (error) throw error;
}

export async function getWasteLogs(userId: string): Promise<WasteLog[]> {
  const { data, error } = await supabase
    .from('waste_log')
    .select('*')
    .eq('user_id', userId)
    .order('wasted_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ── Recipes ────────────────────────────────────────────────────

export async function getCachedRecipes(limit = 20): Promise<CachedRecipe[]> {
  const { data, error } = await supabase
    .from('cached_recipes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function upsertCachedRecipe(recipe: Partial<CachedRecipe>): Promise<CachedRecipe> {
  const { data, error } = await supabase
    .from('cached_recipes')
    .upsert({ ...recipe, updated_at: new Date().toISOString() })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as CachedRecipe;
}

// ── Meal Plans ─────────────────────────────────────────────────

export async function getMealPlans(userId: string, date?: string): Promise<MealPlan[]> {
  let q = supabase
    .from('meal_plans')
    .select('*')
    .eq('user_id', userId)
    .order('planned_date', { ascending: true })
    .limit(50);
  if (date) q = q.eq('planned_date', date);
  const { data, error } = await q;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createMealPlan(userId: string, plan: Partial<MealPlan>): Promise<void> {
  const { error } = await supabase.from('meal_plans').insert({ user_id: userId, ...plan });
  if (error) throw error;
}

export async function markMealCooked(id: string): Promise<void> {
  const { error } = await supabase
    .from('meal_plans')
    .update({ is_cooked: true, cooked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Cooking Sessions ───────────────────────────────────────────

export async function getCookingSession(userId: string, recipeId?: string): Promise<CookingSession | null> {
  let q = supabase
    .from('cooking_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  if (recipeId) q = q.eq('recipe_id', recipeId);
  const { data, error } = await q;
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? (data[0] as CookingSession) : null;
}

export async function getAllActiveCookingSessions(userId: string): Promise<CookingSession[]> {
  const { data, error } = await supabase
    .from('cooking_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return Array.isArray(data) ? (data as CookingSession[]) : [];
}

export async function createCookingSession(
  userId: string,
  session: Partial<CookingSession>
): Promise<CookingSession> {
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await supabase
    .from('cooking_sessions')
    .insert({ user_id: userId, room_code: roomCode, ...session })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as CookingSession;
}

export async function updateCookingSession(id: string, updates: Partial<CookingSession>): Promise<void> {
  const { error } = await supabase
    .from('cooking_sessions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function getCookingSessionByRoomCode(code: string): Promise<CookingSession | null> {
  const { data, error } = await supabase
    .from('cooking_sessions')
    .select('*')
    .eq('room_code', code)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Saved Recipes ──────────────────────────────────────────────

export async function getSavedRecipes(userId: string): Promise<{ id: string; recipe_json: Record<string, unknown>; created_at: string }[]> {
  const { data, error } = await supabase
    .from('saved_recipes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function saveRecipe(userId: string, recipeJson: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase
    .from('saved_recipes')
    .insert({ user_id: userId, recipe_json: recipeJson })
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteSavedRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('saved_recipes').delete().eq('id', id);
  if (error) throw error;
}

// ── Nutrition ──────────────────────────────────────────────────

export async function getNutritionLogs(userId: string, date?: string): Promise<NutritionLog[]> {
  const start = date ? `${date}T00:00:00Z` : new Date(Date.now() - 30 * 86400000).toISOString();
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', start)
    .order('logged_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function logNutrition(userId: string, log: Partial<NutritionLog>): Promise<void> {
  const { error } = await supabase.from('nutrition_logs').insert({ user_id: userId, ...log });
  if (error) throw error;
}

// ── Grocery ────────────────────────────────────────────────────

export async function getGroceryList(userId: string): Promise<GroceryListItem[]> {
  const { data, error } = await supabase
    .from('grocery_list_items')
    .select('*')
    .eq('user_id', userId)
    .order('is_purchased', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function addGroceryItem(userId: string, item: Partial<GroceryListItem>): Promise<GroceryListItem> {
  const { data, error } = await supabase
    .from('grocery_list_items')
    .insert({ user_id: userId, ...item })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as GroceryListItem;
}

export async function toggleGroceryItem(id: string, purchased: boolean): Promise<void> {
  const { error } = await supabase
    .from('grocery_list_items')
    .update({
      is_purchased: purchased,
      purchased_at: purchased ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteGroceryItem(id: string): Promise<void> {
  const { error } = await supabase.from('grocery_list_items').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteGroceryItems(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from('grocery_list_items').delete().in('id', ids);
  if (error) throw error;
}

export async function deleteCookingSession(id: string): Promise<void> {
  const { error } = await supabase.from('cooking_sessions').delete().eq('id', id);
  if (error) throw error;
}

export async function getGrocerySetting(userId: string): Promise<GrocerySetting | null> {
  const { data, error } = await supabase
    .from('grocery_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function upsertGrocerySetting(userId: string, days: number, pax: number): Promise<void> {
  const { error } = await supabase
    .from('grocery_settings')
    .upsert({ user_id: userId, days, pax, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ── TheMealDB (removed) ── MealDB functions have been replaced with Groq+Gemini.
// All recipe suggestions now go through ai-recipe-suggestions edge function.
