
-- Add new profile fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_type text DEFAULT 'initials',
  ADD COLUMN IF NOT EXISTS cooking_devices text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;

-- Early access emails table
CREATE TABLE early_access_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE early_access_emails ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (even logged-out users via anon key)
CREATE POLICY "anyone_can_submit_early_access"
  ON early_access_emails FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Users can see their own submission
CREATE POLICY "users_see_own_early_access"
  ON early_access_emails FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can see all (via service role)
CREATE POLICY "service_role_all_early_access"
  ON early_access_emails FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Grocery items: add storage_location for auto-add to inventory
ALTER TABLE grocery_list_items
  ADD COLUMN IF NOT EXISTS storage_location text DEFAULT 'refrigerator';
