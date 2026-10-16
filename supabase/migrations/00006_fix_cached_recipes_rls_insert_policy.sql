
-- Allow any authenticated user to insert into cached_recipes (shared recipe cache, no user_id)
CREATE POLICY "Authenticated users can insert recipes"
  ON public.cached_recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also allow authenticated users to update (for upsert to work)
CREATE POLICY "Authenticated users can update recipes"
  ON public.cached_recipes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
