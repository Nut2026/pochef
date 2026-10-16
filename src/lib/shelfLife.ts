// Local shelf-life database (days) keyed by storage location
// Used to estimate expiry dates when items are added without explicit dates

import type { StorageLocation } from '@/types/types';

interface ShelfLifeEntry {
  refrigerator: number;
  freezer: number;
  room_temperature: number;
  root_cellar: number;
}

const SHELF_LIFE_DB: Record<string, ShelfLifeEntry> = {
  // Proteins
  chicken:      { refrigerator: 2,   freezer: 270, room_temperature: 0,  root_cellar: 0   },
  beef:         { refrigerator: 3,   freezer: 120, room_temperature: 0,  root_cellar: 0   },
  pork:         { refrigerator: 3,   freezer: 180, room_temperature: 0,  root_cellar: 0   },
  fish:         { refrigerator: 2,   freezer: 90,  room_temperature: 0,  root_cellar: 0   },
  shrimp:       { refrigerator: 2,   freezer: 90,  room_temperature: 0,  root_cellar: 0   },
  eggs:         { refrigerator: 35,  freezer: 365, room_temperature: 14, root_cellar: 14  },
  tofu:         { refrigerator: 5,   freezer: 30,  room_temperature: 1,  root_cellar: 1   },
  // Dairy
  milk:         { refrigerator: 7,   freezer: 90,  room_temperature: 0,  root_cellar: 0   },
  cheese:       { refrigerator: 21,  freezer: 180, room_temperature: 1,  root_cellar: 7   },
  butter:       { refrigerator: 60,  freezer: 270, room_temperature: 3,  root_cellar: 3   },
  yogurt:       { refrigerator: 14,  freezer: 60,  room_temperature: 1,  root_cellar: 1   },
  cream:        { refrigerator: 10,  freezer: 30,  room_temperature: 0,  root_cellar: 0   },
  // Vegetables
  broccoli:     { refrigerator: 7,   freezer: 365, room_temperature: 2,  root_cellar: 7   },
  spinach:      { refrigerator: 5,   freezer: 365, room_temperature: 1,  root_cellar: 3   },
  lettuce:      { refrigerator: 7,   freezer: 0,   room_temperature: 1,  root_cellar: 5   },
  carrot:       { refrigerator: 30,  freezer: 365, room_temperature: 7,  root_cellar: 180 },
  potato:       { refrigerator: 14,  freezer: 365, room_temperature: 14, root_cellar: 90  },
  onion:        { refrigerator: 60,  freezer: 240, room_temperature: 30, root_cellar: 120 },
  garlic:       { refrigerator: 180, freezer: 365, room_temperature: 30, root_cellar: 180 },
  tomato:       { refrigerator: 5,   freezer: 180, room_temperature: 5,  root_cellar: 5   },
  mushroom:     { refrigerator: 7,   freezer: 365, room_temperature: 1,  root_cellar: 3   },
  pepper:       { refrigerator: 14,  freezer: 365, room_temperature: 5,  root_cellar: 7   },
  cucumber:     { refrigerator: 7,   freezer: 0,   room_temperature: 3,  root_cellar: 5   },
  zucchini:     { refrigerator: 7,   freezer: 365, room_temperature: 3,  root_cellar: 7   },
  celery:       { refrigerator: 14,  freezer: 365, room_temperature: 2,  root_cellar: 14  },
  cabbage:      { refrigerator: 21,  freezer: 365, room_temperature: 5,  root_cellar: 90  },
  // Fruits
  apple:        { refrigerator: 30,  freezer: 365, room_temperature: 7,  root_cellar: 60  },
  banana:       { refrigerator: 7,   freezer: 60,  room_temperature: 5,  root_cellar: 5   },
  avocado:      { refrigerator: 5,   freezer: 90,  room_temperature: 3,  root_cellar: 3   },
  lemon:        { refrigerator: 21,  freezer: 120, room_temperature: 7,  root_cellar: 14  },
  orange:       { refrigerator: 21,  freezer: 120, room_temperature: 7,  root_cellar: 14  },
  strawberry:   { refrigerator: 5,   freezer: 180, room_temperature: 1,  root_cellar: 2   },
  blueberry:    { refrigerator: 10,  freezer: 180, room_temperature: 1,  root_cellar: 3   },
  grape:        { refrigerator: 14,  freezer: 180, room_temperature: 3,  root_cellar: 5   },
  mango:        { refrigerator: 5,   freezer: 180, room_temperature: 3,  root_cellar: 3   },
  // Grains & pantry
  bread:        { refrigerator: 7,   freezer: 90,  room_temperature: 5,  root_cellar: 5   },
  rice:         { refrigerator: 7,   freezer: 180, room_temperature: 1,  root_cellar: 1   },
  pasta:        { refrigerator: 5,   freezer: 60,  room_temperature: 2,  root_cellar: 2   },
  flour:        { refrigerator: 180, freezer: 365, room_temperature: 90, root_cellar: 180 },
  // Sauces & condiments
  sauce:        { refrigerator: 14,  freezer: 90,  room_temperature: 3,  root_cellar: 3   },
  oil:          { refrigerator: 180, freezer: 365, room_temperature: 90, root_cellar: 180 },
  vinegar:      { refrigerator: 730, freezer: 730, room_temperature: 365, root_cellar: 365 },
};

const DEFAULT_SHELF_LIFE: ShelfLifeEntry = {
  refrigerator: 7,
  freezer: 180,
  room_temperature: 3,
  root_cellar: 14,
};

export function estimateExpiryDate(
  itemName: string,
  purchaseDate: Date,
  location: StorageLocation
): Date {
  const key = itemName.toLowerCase().trim();

  // Try exact match first
  let entry = SHELF_LIFE_DB[key];

  // Try partial match
  if (!entry) {
    const matched = Object.keys(SHELF_LIFE_DB).find(k => key.includes(k) || k.includes(key));
    entry = matched ? SHELF_LIFE_DB[matched] : DEFAULT_SHELF_LIFE;
  }

  const days = entry[location] || DEFAULT_SHELF_LIFE[location];
  const expiry = new Date(purchaseDate);
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

export function getDaysUntilExpiry(expiryDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(days: number): 'fresh' | 'soon' | 'warning' | 'expired' {
  if (days < 0) return 'expired';
  if (days <= 1) return 'warning';
  if (days <= 3) return 'soon';
  return 'fresh';
}

export function getBubbleSize(days: number, baseSize = 80): number {
  if (days < 0) return baseSize * 0.4;
  if (days <= 1) return baseSize * 0.6;
  if (days <= 3) return baseSize * 0.75;
  if (days <= 7) return baseSize * 0.9;
  return baseSize;
}

// Fermentation total days by type
export const FERMENTATION_DAYS: Record<string, number> = {
  pickles: 7,
  yoghurt: 1,
  kefir_milk: 2,
  kefir_water: 3,
  kombucha_primary: 14,
  kombucha_secondary: 5,
  natto: 2,
  sauerkraut: 21,
  kimchi: 7,
  sourdough: 7,
};

// Ripening produces
export const RIPENING_PRODUCE = ['avocado', 'banana', 'tomato', 'mango', 'pear', 'kiwi', 'peach'];

export function isRipeningProduce(name: string): boolean {
  return RIPENING_PRODUCE.some(p => name.toLowerCase().includes(p));
}
