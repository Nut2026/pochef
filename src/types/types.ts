// ================================================================
// POCHEF TYPE DEFINITIONS
// ================================================================

export type UserRole = 'user' | 'admin';
export type StorageLocation = 'refrigerator' | 'freezer' | 'room_temperature';
export type RipenessStage = 'unripe' | 'nearly_ripe' | 'ripe' | 'overripe';
export type FermentationType =
  | 'pickles' | 'yoghurt' | 'kefir_milk' | 'kefir_water'
  | 'kombucha_primary' | 'kombucha_secondary'
  | 'natto' | 'sauerkraut' | 'kimchi' | 'sourdough_starter';
export type MealType = 'breakfast' | 'brunch' | 'lunch' | 'snacks' | 'dinner' | 'supper';
export type DietaryGoal = 'balanced' | 'keto' | 'vegan' | 'high_protein' | 'low_carb';
export type UserPlan = 'free' | 'pro' | 'trial';
export type AvatarType = 'initials' | 'avocado' | 'chefs_hat' | 'fermentation_jar' | 'grocery_basket' | 'noodles';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'MYR' | 'SGD' | 'AUD' | 'JPY' | 'CNY';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', EUR: '€', GBP: '£', MYR: 'RM', SGD: 'S$', AUD: 'A$', JPY: '¥', CNY: '¥',
};

export const CURRENCY_NO_DECIMAL: Currency[] = ['JPY'];

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  role: UserRole;
  dietary_goal: DietaryGoal;
  daily_calorie_target: number;
  cookware: string[];
  avatar_type: AvatarType;
  cooking_devices: string[];
  currency: Currency;
  plan: UserPlan;
  color_scheme: 'light' | 'dark';
  trial_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiShelfLife {
  room_temperature: number | 'not_advised';
  refrigerator: number | 'not_advised';
  freezer: number | 'not_advised';
  default_storage: StorageLocation;
}

export interface RipeningDays {
  unripe_to_nearly_ripe: number;
  nearly_ripe_to_ripe: number;
  ripe_to_overripe: number;
}

export interface GrocerySetting {
  id: string;
  user_id: string;
  days: number;
  pax: number;
  created_at: string;
  updated_at: string;
}

export interface MealFolder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string;
  /** Legacy combined field e.g. "200g" — kept for backward compat */
  amount_value: number;
  amount_unit: string;
  storage_location: StorageLocation;
  purchase_date: string;
  expiry_date: string;
  price: number;
  category: string;
  ai_shelf_life: AiShelfLife | null;
  is_fruit: boolean;
  ripening_days: RipeningDays | null;
  is_expiry_override: boolean;
  is_consumed: boolean;
  consumed_at: string | null;
  position_x: number;
  position_y: number;
  // Pre-stored macros per quantity unit
  calories_per_unit: number;
  protein_per_unit: number;
  carbs_per_unit: number;
  fat_per_unit: number;
  created_at: string;
  updated_at: string;
}

export interface RipeningItem {
  id: string;
  inventory_item_id: string;
  user_id: string;
  produce_name: string;
  ripeness_stage: RipenessStage;
  estimated_ripe_date: string | null;
  user_adjusted: boolean;
  stage_set_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FermentationBatch {
  id: string;
  user_id: string;
  name: string;
  fermentation_type: FermentationType;
  start_date: string;
  current_day: number;
  total_days: number;
  ambient_temp_celsius: number;
  notes: string;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface FermentationStage {
  id: string;
  batch_id: string;
  user_id: string;
  day_number: number;
  action_prompt: string;
  is_completed: boolean;
  completed_at: string | null;
  image_url: string | null;
  created_at: string;
}

export interface WasteLog {
  id: string;
  user_id: string;
  inventory_item_id: string | null;
  item_name: string;
  cost: number;
  wasted_at: string;
  created_at: string;
}

export interface RecipeIngredient {
  name: string;
  measure: string;
}

export interface CachedRecipe {
  id: string;
  meal_db_id: string | null;
  name: string;
  category: string | null;
  cuisine: string | null;
  instructions: string | null;
  ingredients: RecipeIngredient[];
  thumbnail_url: string | null;
  ai_image_url: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prep_time_mins: number;
  difficulty: string;
  meal_type: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface MealPlan {
  id: string;
  user_id: string;
  recipe_id: string | null;
  recipe_name: string;
  meal_type: MealType;
  planned_date: string;
  servings: number;
  is_cooked: boolean;
  cooked_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface CookingSession {
  id: string;
  user_id: string;
  recipe_id: string | null;
  recipe_name: string;
  room_code: string | null;
  current_step: number;
  total_steps: number;
  is_active: boolean;
  messages: ChatMessage[];
  steps_json: { text: string; done: boolean; timerSeconds?: number }[] | null;
  /** Full recipe data (ingredients, macros, etc.) stored at session creation for "I Ate This" */
  recipe_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionLog {
  id: string;
  user_id: string;
  meal_plan_id: string | null;
  recipe_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servings: number;
  logged_at: string;
  created_at: string;
}

export interface GroceryListItem {
  id: string;
  user_id: string;
  name: string;
  quantity: string;
  unit: string;
  is_purchased: boolean;
  purchased_at: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

// UI helpers
export interface BubbleItem extends InventoryItem {
  daysUntilExpiry: number;
  expiryStatus: 'fresh' | 'soon' | 'warning' | 'expired';
  bubbleSize: number;
}

export interface MealFilterState {
  dietaryGoal: DietaryGoal | 'all';
  mealType: MealType | 'all';
  difficulty: string;
  cookingMinutes: number;
  cuisine: string;
  preferences: string[];
  constraints: string;
  useUpIngredient: string | null;
  splitMode: 'single' | 'split' | null;
}

export interface DailyNutrition {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
