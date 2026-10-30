-- Create meal_folders table for batch meal planning groups
CREATE TABLE IF NOT EXISTS meal_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Meal Plan',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add folder_id to saved_recipes
ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES meal_folders(id) ON DELETE SET NULL;

-- Create index for faster folder lookups
CREATE INDEX IF NOT EXISTS idx_saved_recipes_folder_id ON saved_recipes(folder_id);
CREATE INDEX IF NOT EXISTS idx_meal_folders_user_id ON meal_folders(user_id);

-- RLS policies for meal_folders
ALTER TABLE meal_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own folders" ON meal_folders
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());