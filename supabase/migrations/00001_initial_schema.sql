
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.user_role AS ENUM ('user', 'admin');
CREATE TYPE public.storage_location AS ENUM ('refrigerator', 'freezer', 'room_temperature', 'root_cellar');
CREATE TYPE public.ripeness_stage AS ENUM ('unripe', 'nearly_ripe', 'ripe', 'overripe');
CREATE TYPE public.fermentation_type AS ENUM ('pickles', 'yoghurt', 'kefir_milk', 'kefir_water', 'kombucha_primary', 'kombucha_secondary', 'natto', 'sauerkraut', 'kimchi', 'sourdough');
CREATE TYPE public.meal_type AS ENUM ('breakfast', 'brunch', 'lunch', 'snacks', 'dinner', 'supper');
CREATE TYPE public.dietary_goal AS ENUM ('balanced', 'keto', 'vegan', 'high_protein', 'low_carb');

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  username text UNIQUE,
  role public.user_role NOT NULL DEFAULT 'user',
  dietary_goal public.dietary_goal DEFAULT 'balanced',
  daily_calorie_target integer DEFAULT 2000,
  cookware text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;

CREATE POLICY "Admins full access profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM public.get_user_role(auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'user'::public.user_role
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- INVENTORY ITEMS
-- ============================================================
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'piece',
  storage_location public.storage_location NOT NULL DEFAULT 'refrigerator',
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date NOT NULL,
  price numeric DEFAULT 0,
  category text DEFAULT 'other',
  is_expiry_override boolean DEFAULT false,
  is_consumed boolean DEFAULT false,
  consumed_at timestamptz,
  position_x integer DEFAULT 0,
  position_y integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own inventory" ON public.inventory_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- RIPENING ITEMS
-- ============================================================
CREATE TABLE public.ripening_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  produce_name text NOT NULL,
  ripeness_stage public.ripeness_stage NOT NULL DEFAULT 'unripe',
  estimated_ripe_date date,
  user_adjusted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ripening_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ripening" ON public.ripening_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FERMENTATION BATCHES
-- ============================================================
CREATE TABLE public.fermentation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  fermentation_type public.fermentation_type NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  current_day integer NOT NULL DEFAULT 1,
  total_days integer NOT NULL DEFAULT 7,
  ambient_temp_celsius numeric DEFAULT 22,
  notes text DEFAULT '',
  is_complete boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fermentation_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own batches" ON public.fermentation_batches
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FERMENTATION STAGES
-- ============================================================
CREATE TABLE public.fermentation_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.fermentation_batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  action_prompt text NOT NULL,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fermentation_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own stages" ON public.fermentation_stages
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- WASTE LOG
-- ============================================================
CREATE TABLE public.waste_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  cost numeric NOT NULL DEFAULT 0,
  wasted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waste_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own waste" ON public.waste_log
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CACHED RECIPES
-- ============================================================
CREATE TABLE public.cached_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_db_id text UNIQUE,
  name text NOT NULL,
  category text,
  cuisine text,
  instructions text,
  ingredients jsonb DEFAULT '[]',
  thumbnail_url text,
  ai_image_url text,
  calories integer DEFAULT 0,
  protein numeric DEFAULT 0,
  carbs numeric DEFAULT 0,
  fat numeric DEFAULT 0,
  prep_time_mins integer DEFAULT 30,
  difficulty text DEFAULT 'intermediate',
  meal_type text DEFAULT 'dinner',
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cached_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read recipes" ON public.cached_recipes
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Admins manage recipes" ON public.cached_recipes
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============================================================
-- MEAL PLANS
-- ============================================================
CREATE TABLE public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES public.cached_recipes(id) ON DELETE SET NULL,
  recipe_name text NOT NULL,
  meal_type public.meal_type NOT NULL DEFAULT 'dinner',
  planned_date date NOT NULL DEFAULT CURRENT_DATE,
  servings integer DEFAULT 1,
  is_cooked boolean DEFAULT false,
  cooked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meal plans" ON public.meal_plans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- COOKING SESSIONS
-- ============================================================
CREATE TABLE public.cooking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES public.cached_recipes(id) ON DELETE SET NULL,
  recipe_name text NOT NULL,
  room_code text UNIQUE,
  current_step integer DEFAULT 0,
  total_steps integer DEFAULT 1,
  is_active boolean DEFAULT true,
  messages jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cooking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions" ON public.cooking_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view shared sessions by room code" ON public.cooking_sessions
  FOR SELECT TO authenticated USING (room_code IS NOT NULL);

-- ============================================================
-- SESSION PARTICIPANTS
-- ============================================================
CREATE TABLE public.session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cooking_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own participation" ON public.session_participants
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Session participants can view others" ON public.session_participants
  FOR SELECT TO authenticated USING (
    session_id IN (SELECT session_id FROM public.session_participants WHERE user_id = auth.uid())
  );

-- ============================================================
-- NUTRITION LOGS
-- ============================================================
CREATE TABLE public.nutrition_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_plan_id uuid REFERENCES public.meal_plans(id) ON DELETE SET NULL,
  recipe_name text NOT NULL,
  calories integer NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  servings numeric DEFAULT 1,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own nutrition" ON public.nutrition_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- GROCERY LIST
-- ============================================================
CREATE TABLE public.grocery_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity text NOT NULL DEFAULT '1',
  unit text DEFAULT 'piece',
  is_purchased boolean DEFAULT false,
  purchased_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grocery_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own grocery" ON public.grocery_list_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pochef-images',
  'pochef-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

CREATE POLICY "Anyone can view pochef images" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'pochef-images');

CREATE POLICY "Auth users upload pochef images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pochef-images');

CREATE POLICY "Auth users update own pochef images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'pochef-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Auth users delete own pochef images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'pochef-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cooking_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fermentation_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.grocery_list_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nutrition_logs;
