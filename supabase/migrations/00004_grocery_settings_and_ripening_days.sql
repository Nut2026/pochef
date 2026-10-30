
-- Grocery settings table (days/pax per user)
CREATE TABLE IF NOT EXISTS grocery_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  days integer NOT NULL DEFAULT 7 CHECK (days >= 1 AND days <= 30),
  pax  integer NOT NULL DEFAULT 2 CHECK (pax  >= 1 AND pax  <= 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE grocery_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grocery_settings_owner" ON grocery_settings USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add fruit ripening data to inventory_items
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS is_fruit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ripening_days jsonb;

-- Add stage_set_at to ripening_items (tracks when last stage change happened)
ALTER TABLE ripening_items
  ADD COLUMN IF NOT EXISTS stage_set_at timestamptz;

-- Cooking sessions: add steps_json for persisting individual step states
ALTER TABLE cooking_sessions
  ADD COLUMN IF NOT EXISTS steps_json jsonb;
