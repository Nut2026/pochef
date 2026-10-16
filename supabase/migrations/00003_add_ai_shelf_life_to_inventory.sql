
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS ai_shelf_life jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS amount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_unit text DEFAULT 'g';

COMMENT ON COLUMN inventory_items.ai_shelf_life IS
  'Per-storage expiry predictions from AI: {room_temperature: days|"not_advised", refrigerator: days|"not_advised", freezer: days|"not_advised", default_storage: StorageLocation}';
