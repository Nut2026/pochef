
CREATE TABLE IF NOT EXISTS saved_recipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_json jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_recipes_user_id_idx ON saved_recipes(user_id);
ALTER TABLE saved_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved recipes"
  ON saved_recipes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
