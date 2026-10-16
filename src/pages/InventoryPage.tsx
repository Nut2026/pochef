import {Apple, Calendar, Camera, Check,ChevronDown, 
  ChevronUp, Keyboard, LayoutGrid, LayoutList, Package, Pencil, 
  Plus, 
  RefreshCw, Scan, Trash2,Upload,X, 
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { UpgradePrompt } from '@/components/common/UpgradePrompt';
import { AppLayout } from '@/components/layouts/AppLayout';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { usePlan } from '@/hooks/usePlan';
import {addInventoryItem, 
  deleteInventoryItem, 
  getInventory, getRipeningItems, logNutrition,logWaste, updateInventoryItem,upsertRipeningItem, 
} from '@/lib/api';
import { appCache } from '@/lib/cache';
import { formatDuration } from '@/lib/duration';
import { getDaysUntilExpiry, getExpiryStatus } from '@/lib/shelfLife';
import { cn } from '@/lib/utils';
import type { AiShelfLife, InventoryItem, RipeningItem, StorageLocation } from '@/types/types';
import { CURRENCY_SYMBOLS } from '@/types/types';

// ── Constants ────────────────────────────────────────────────────

const STORAGE_LOCATIONS: { value: StorageLocation; label: string }[] = [
  { value: 'room_temperature', label: 'Room Temp' },
  { value: 'refrigerator',     label: 'Refrigerator' },
  { value: 'freezer',          label: 'Freezer' },
];

const AMOUNT_UNITS = ['g', 'kg', 'ml', 'l', 'oz', 'lb', 'N/A'] as const;
type AmountUnit = typeof AMOUNT_UNITS[number];

const RIPENESS_STAGES = ['unripe', 'nearly_ripe', 'ripe', 'overripe'] as const;
type RipenessStage = typeof RIPENESS_STAGES[number];

const RIPENESS_LABELS: Record<RipenessStage, string> = {
  unripe:      'Unripe',
  nearly_ripe: 'Nearly Ripe',
  ripe:        'Ripe',
  overripe:    'Overripe',
};

const RIPENESS_COLORS: Record<RipenessStage, string> = {
  unripe:      'bg-success text-white',
  nearly_ripe: 'bg-warning text-white',
  ripe:        'bg-primary text-primary-foreground',
  overripe:    'bg-destructive text-white',
};

// ── Helpers ──────────────────────────────────────────────────────

function statusStyle(status: 'fresh' | 'soon' | 'warning' | 'expired') {
  return {
    fresh:   { badge: 'border-success text-success bg-success/10',     dot: 'bg-success',     row: '' },
    soon:    { badge: 'border-warning text-warning bg-warning/10',     dot: 'bg-warning',     row: 'bg-warning/5' },
    warning: { badge: 'border-destructive text-destructive bg-destructive/10', dot: 'bg-destructive', row: 'bg-destructive/5' },
    expired: { badge: 'border-destructive/50 text-destructive/70 bg-destructive/5', dot: 'bg-destructive/50', row: 'bg-destructive/5 opacity-70' },
  }[status];
}

/** Compute expiry_date from purchase_date + ai_shelf_life days for a given storage location */
function computeExpiryFromAI(purchaseDate: string, aiShelfLife: AiShelfLife, storage: StorageLocation): string | null {
  const days = aiShelfLife[storage];
  if (typeof days !== 'number' || days <= 0) return null;
  const d = new Date(purchaseDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Get current ripeness stage based on ripening_days timeline and stage_set_at */
function computeCurrentStage(
  ripeningItem: RipeningItem,
  ripening_days: { unripe_to_nearly_ripe: number; nearly_ripe_to_ripe: number; ripe_to_overripe: number } | null
): { stage: RipenessStage; stageIdx: number } {
  const base = ripeningItem.stage_set_at ? new Date(ripeningItem.stage_set_at) : new Date(ripeningItem.updated_at || new Date().toISOString());
  const now = new Date();
  const daysSinceSet = Math.floor((now.getTime() - base.getTime()) / 86400000);
  const setIdx = RIPENESS_STAGES.indexOf(ripeningItem.ripeness_stage as RipenessStage);
  if (setIdx < 0 || !ripening_days) return { stage: ripeningItem.ripeness_stage as RipenessStage, stageIdx: setIdx < 0 ? 0 : setIdx };

  // Walk forward through stages based on days elapsed
  let idx = setIdx;
  let daysLeft = daysSinceSet;
  while (daysLeft > 0 && idx < RIPENESS_STAGES.length - 1) {
    let daysForStage: number;
    if (idx === 0) daysForStage = ripening_days.unripe_to_nearly_ripe;
    else if (idx === 1) daysForStage = ripening_days.nearly_ripe_to_ripe;
    else daysForStage = ripening_days.ripe_to_overripe;
    if (daysLeft >= daysForStage) {
      idx = Math.min(idx + 1, RIPENESS_STAGES.length - 1);
      daysLeft -= daysForStage;
    } else {
      break;
    }
  }
  return { stage: RIPENESS_STAGES[idx], stageIdx: idx };
}

// ── Ripening Slider (inline) ─────────────────────────────────────

function RipeningSlider({
  item,
  ripeningMap,
  onStageChange,
}: {
  item: InventoryItemEx;
  ripeningMap: Map<string, RipeningItem>;
  onStageChange: (itemId: string, stage: RipenessStage) => void;
}) {
  const ri = ripeningMap.get(item.id);
  const ripening_days = item.ripening_days as { unripe_to_nearly_ripe: number; nearly_ripe_to_ripe: number; ripe_to_overripe: number } | null;
  const { stageIdx } = ri
    ? computeCurrentStage(ri, ripening_days)
    : { stageIdx: 0 };
  const [localIdx, setLocalIdx] = useState(stageIdx);

  // Sync when computed stage changes externally
  useEffect(() => { setLocalIdx(stageIdx); }, [stageIdx]);

  // Smooth automated progress: compute fractional position within current stage
  const smoothValue = (() => {
    if (!ri || !ripening_days) return stageIdx;
    const base = ri.stage_set_at ? new Date(ri.stage_set_at) : new Date(ri.updated_at || new Date().toISOString());
    const now = new Date();
    const daysSinceSet = (now.getTime() - base.getTime()) / 86400000;
    const setIdx = RIPENESS_STAGES.indexOf(ri.ripeness_stage as RipenessStage);
    if (setIdx < 0) return stageIdx;

    const stageDurations = [
      ripening_days.unripe_to_nearly_ripe,
      ripening_days.nearly_ripe_to_ripe,
      ripening_days.ripe_to_overripe,
    ];

    let idx = setIdx;
    let daysLeft = daysSinceSet;
    while (daysLeft > 0 && idx < RIPENESS_STAGES.length - 1) {
      const dur = stageDurations[idx] || 1;
      if (daysLeft >= dur) { idx++; daysLeft -= dur; }
      else {
        // fractional: how far through this stage
        return idx + daysLeft / dur;
      }
    }
    return Math.min(idx, RIPENESS_STAGES.length - 1);
  })();

  // Ripe/Overripe timeline hint
  const ripeInDays = (() => {
    if (!ri || !ripening_days) return null;
    const base = ri.stage_set_at ? new Date(ri.stage_set_at) : new Date(ri.updated_at || new Date().toISOString());
    const now = new Date();
    const daysSinceSet = (now.getTime() - base.getTime()) / 86400000;
    const setIdx = RIPENESS_STAGES.indexOf(ri.ripeness_stage as RipenessStage);
    const stageDurations = [
      ripening_days.unripe_to_nearly_ripe,
      ripening_days.nearly_ripe_to_ripe,
      ripening_days.ripe_to_overripe,
    ];
    // days remaining to ripe (idx=2) from now
    let totalToRipe = 0;
    for (let i = setIdx; i < 2; i++) totalToRipe += stageDurations[i] || 0;
    const ripeIn = Math.max(0, Math.round(totalToRipe - daysSinceSet));

    let totalToOverripe = 0;
    for (let i = setIdx; i < 3; i++) totalToOverripe += stageDurations[i] || 0;
    const overripeIn = Math.max(0, Math.round(totalToOverripe - daysSinceSet));

    return { ripeIn, overripeIn };
  })();

  const handleChange = (val: number[]) => {
    const idx = Math.round(val[0]);
    setLocalIdx(idx);
    onStageChange(item.id, RIPENESS_STAGES[idx]);
  };

  return (
    <div className="flex flex-col gap-1 min-w-0 w-full">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Unripe</span>
        <span className={cn('px-1.5 py-0.5 rounded-full text-xs font-medium', RIPENESS_COLORS[RIPENESS_STAGES[Math.round(localIdx)]])}>
          {RIPENESS_LABELS[RIPENESS_STAGES[Math.round(localIdx)]]}
        </span>
        <span>Overripe</span>
      </div>
      <Slider
        value={[smoothValue]}
        onValueChange={handleChange}
        min={0} max={3}
        step={0.01}
        className="py-1"
      />
      {ripeInDays && (stageIdx < 2) && (
        <p className="text-xs text-muted-foreground mt-0.5">
          Ripe in ~{ripeInDays.ripeIn}d · Overripe in ~{ripeInDays.overripeIn}d
        </p>
      )}
    </div>
  );
}

// ── Ripening Card (kept for internal use but not shown as tab) ──────────────────────────────────────────────────────

function RipeningCard({
  item,
  ripeningMap,
  onStageChange,
}: {
  item: InventoryItemEx;
  ripeningMap: Map<string, RipeningItem>;
  onStageChange: (itemId: string, stage: RipenessStage) => void;
}) {
  const ri = ripeningMap.get(item.id);
  const ripening_days = item.ripening_days as { unripe_to_nearly_ripe: number; nearly_ripe_to_ripe: number; ripe_to_overripe: number } | null;
  const { stage, stageIdx } = ri
    ? computeCurrentStage(ri, ripening_days)
    : { stage: 'unripe' as RipenessStage, stageIdx: 0 };
  const [localIdx, setLocalIdx] = useState(stageIdx);

  useEffect(() => { setLocalIdx(stageIdx); }, [stageIdx]);

  const handleChange = (val: number[]) => {
    setLocalIdx(val[0]);
    onStageChange(item.id, RIPENESS_STAGES[val[0]]);
  };

  void stage;

  return (
    <Card className="glass border-0 shadow-card h-full flex flex-col">
      <CardContent className="pt-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-center gap-2">
          <Apple className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm font-semibold truncate">{item.name}</p>
          <span className={cn('ml-auto shrink-0 px-2 py-0.5 rounded-full text-xs font-medium', RIPENESS_COLORS[stage])}>
            {RIPENESS_LABELS[stage]}
          </span>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Unripe</span><span>Nearly Ripe</span><span>Ripe</span><span>Overripe</span>
          </div>
          <Slider value={[localIdx]} onValueChange={handleChange} min={0} max={3} step={1} className="py-1" />
        </div>
        {ripening_days && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Ripe in ~{ripening_days.unripe_to_nearly_ripe + ripening_days.nearly_ripe_to_ripe}d · Overripe in ~{ripening_days.unripe_to_nearly_ripe + ripening_days.nearly_ripe_to_ripe + ripening_days.ripe_to_overripe}d
          </p>
        )}
        <p className="text-xs text-muted-foreground">{item.quantity} × {item.unit || 'piece'} · {item.storage_location.replace('_', ' ')}</p>
      </CardContent>
    </Card>
  );
}

// ── Simple virtual list (renders a window of items for long lists) ─
function VirtualList<T>({ items, renderItem }: {
  items: T[];
  renderItem: (item: T, idx: number) => React.ReactNode;
}) {
  // Under 60 items: render all (no overhead)
  if (items.length <= 60) {
    return (
      <div className="glass rounded-xl border-0 shadow-card overflow-hidden divide-y divide-border/50">
        {items.map((item, idx) => renderItem(item, idx))}
      </div>
    );
  }
  // Over 60: paginate in chunks of 40, load more on scroll
  return <PaginatedList items={items} renderItem={renderItem} />;
}

function PaginatedList<T>({ items, renderItem }: {
  items: T[];
  renderItem: (item: T, idx: number) => React.ReactNode;
}) {
  const PAGE = 40;
  const [visible, setVisible] = useState(PAGE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisible(v => Math.min(v + PAGE, items.length));
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [items.length]);

  // Reset when items list changes (e.g. search)
  useEffect(() => { setVisible(PAGE); }, [items]);

  return (
    <div className="glass rounded-xl border-0 shadow-card overflow-hidden divide-y divide-border/50">
      {items.slice(0, visible).map((item, idx) => renderItem(item, idx))}
      {visible < items.length && (
        <div ref={sentinelRef} className="py-3 text-center text-xs text-muted-foreground">
          Loading more…
        </div>
      )}
    </div>
  );
}

function NumericStepper({
  value, onChange, min = 1, max = 24, step = 1, allowDecimal = false,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; allowDecimal?: boolean;
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const valueRef    = useRef(value);
  valueRef.current  = value;

  const clamp = (v: number) => Math.min(max, Math.max(min, allowDecimal ? Math.round(v * 100) / 100 : Math.round(v)));

  const clear = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
  };

  const startHold = (dir: 1 | -1) => {
    onChange(clamp(valueRef.current + dir * step));
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        valueRef.current = clamp(valueRef.current + dir * step);
        onChange(valueRef.current);
      }, 80);
    }, 400);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = allowDecimal ? parseFloat(e.target.value) : parseInt(e.target.value);
    if (!isNaN(raw)) onChange(clamp(raw));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  return (
    <div className="flex items-center border border-border rounded-md overflow-hidden h-9 w-fit">
      <button
        type="button"
        onMouseDown={() => startHold(-1)} onMouseUp={clear} onMouseLeave={clear}
        onTouchStart={() => startHold(-1)} onTouchEnd={clear}
        className="px-2.5 h-full flex items-center justify-center hover:bg-muted transition-colors shrink-0 select-none"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <input
        type="number"
        value={allowDecimal ? value : value}
        min={min} max={max} step={allowDecimal ? 'any' : step}
        onChange={handleInputChange}
        onFocus={handleFocus}
        className="w-14 text-center text-sm bg-transparent outline-none border-x border-border h-full py-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onMouseDown={() => startHold(1)} onMouseUp={clear} onMouseLeave={clear}
        onTouchStart={() => startHold(1)} onTouchEnd={clear}
        className="px-2.5 h-full flex items-center justify-center hover:bg-muted transition-colors shrink-0 select-none"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
    </div>
  );
}

// Alias for quantity (integer, 1–24)
function QuantityStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <NumericStepper value={value} onChange={onChange} min={1} max={24} step={1} />;
}

// ── Receipt Preview Item ─────────────────────────────────────────

interface ReceiptPreviewItem {
  name: string;
  quantity: number;
  amount_value: number;
  amount_unit: string;
  price: number;
  shelf_life: AiShelfLife;
  is_fruit?: boolean;
  ripening_days?: { unripe_to_nearly_ripe: number; nearly_ripe_to_ripe: number; ripe_to_overripe: number } | null;
}

function ReceiptPreview({
  items,
  onItemChange,
  onRemoveItem,
  onConfirm,
  onCancel,
  currencySymbol,
  loading,
}: {
  items: ReceiptPreviewItem[];
  onItemChange: (idx: number, field: keyof ReceiptPreviewItem, value: string | number) => void;
  onRemoveItem: (idx: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  currencySymbol: string;
  loading: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{items.length} food item{items.length !== 1 ? 's' : ''} extracted. Review and edit before adding.</p>
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {items.map((item, idx) => (
          <div key={idx} className="glass rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-primary shrink-0 w-5">{idx + 1}.</span>
              <Input
                value={item.name}
                onChange={e => onItemChange(idx, 'name', e.target.value)}
                className="h-7 text-sm flex-1"
                placeholder="Name"
              />
              <button
                type="button"
                onClick={() => onRemoveItem(idx)}
                className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Remove item"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-1.5 ml-6">
              <Input
                type="number"
                value={item.quantity}
                onChange={e => onItemChange(idx, 'quantity', parseFloat(e.target.value) || 1)}
                className="h-7 text-xs w-16"
                placeholder="Qty"
              />
              <Input
                type="number"
                value={item.amount_value || ''}
                onChange={e => onItemChange(idx, 'amount_value', parseFloat(e.target.value) || 0)}
                className="h-7 text-xs w-16"
                placeholder="Amt"
              />
              <Input
                value={item.amount_unit}
                onChange={e => onItemChange(idx, 'amount_unit', e.target.value)}
                className="h-7 text-xs w-14"
                placeholder="Unit"
              />
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-muted-foreground shrink-0">{currencySymbol}</span>
                <Input
                  type="number"
                  value={item.price || ''}
                  onChange={e => onItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs w-20"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Back</Button>
        <Button onClick={onConfirm} disabled={loading || items.length === 0} className="flex-1 bg-copper-gradient text-primary-foreground">
          {loading ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Adding…</> : `Add ${items.length} Item${items.length !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}

// ── Add Ingredient Form ──────────────────────────────────────────

// A single queued ingredient entry (before Groq submission)
interface QueuedIngredient {
  id: string;
  name: string;
  amountValue: string;
  amountUnit: AmountUnit;
  quantity: number;
  price: string;
}

function makeEmptyQueuedItem(): QueuedIngredient {
  return { id: Math.random().toString(36).slice(2), name: '', amountValue: '', amountUnit: 'g', quantity: 1, price: '' };
}

function AddIngredientForm({
  onAdd, onClose, currencySymbol,
}: {
  onAdd: () => void;
  onClose: () => void;
  currencySymbol: string;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'manual' | 'receipt'>('manual');

  // Batch queue — user can add up to 24 items before submitting to Groq
  const [queue, setQueue] = useState<QueuedIngredient[]>([makeEmptyQueuedItem()]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Single-item shelf-life picker state (used after Groq confirms batch)
  const [aiShelfLife, setAiShelfLife] = useState<AiShelfLife | null>(null);
  const [predictedIsFruit, setPredictedIsFruit] = useState(false);
  const [predictedRipeningDays, setPredictedRipeningDays] = useState<{ unripe_to_nearly_ripe: number; nearly_ripe_to_ripe: number; ripe_to_overripe: number } | null>(null);
  const [selectedStorage, setSelectedStorage] = useState<StorageLocation>('refrigerator');
  const [showShelfLifePicker, setShowShelfLifePicker] = useState(false);
  // When batch > 1 item, we skip individual shelf-life pickers and use Groq's defaults
  const isBatch = queue.length > 1;

  // Receipt fields
  const [scanLoading, setScanLoading]       = useState(false);
  const [receiptItems, setReceiptItems]     = useState<ReceiptPreviewItem[] | null>(null);
  const [addingReceipt, setAddingReceipt]   = useState(false);
  const photoRef  = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const updateQueueItem = (id: string, patch: Partial<QueuedIngredient>) =>
    setQueue(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));

  const addAnotherItem = () => {
    if (queue.length >= 24) { toast.error('Maximum 24 ingredients per batch'); return; }
    setQueue(prev => [...prev, makeEmptyQueuedItem()]);
  };

  const removeQueueItem = (id: string) =>
    setQueue(prev => prev.length > 1 ? prev.filter(q => q.id !== id) : prev);

  // Compute best-before display for storage picker (single-item mode only)
  const getStorageLabel = (loc: StorageLocation) => {
    if (loc === 'room_temperature') return 'Room Temperature';
    if (loc === 'refrigerator') return 'Refrigerator';
    return 'Freezer';
  };

  const getBestBeforeInfo = (loc: StorageLocation) => {
    if (!aiShelfLife) return null;
    const days = aiShelfLife[loc];
    if (days === 'not_advised') return { advised: false, label: 'Not advised' };
    if (typeof days !== 'number' || days <= 0) return { advised: false, label: 'Not advised' };
    const d = new Date();
    d.setDate(d.getDate() + days);
    return { advised: true, date: d.toISOString().split('T')[0], daysLeft: days, label: `${days} day${days !== 1 ? 's' : ''} left` };
  };

  // Phase 1: call Groq for all queued items in ONE request
  const checkShelfLife = async () => {
    const validItems = queue.filter(q => q.name.trim());
    if (validItems.length === 0) { toast.error('Please enter at least one ingredient name'); return; }
    const missingPrice = validItems.find(q => !q.price.trim());
    if (missingPrice) { toast.error(`Price is required for "${missingPrice.name}"`); return; }

    if (isBatch) {
      // Batch mode — call Groq once for all, use defaults, add directly
      setAiLoading(true);
      try {
        const results: { shelf_life: AiShelfLife; is_fruit: boolean; ripening_days: null | { unripe_to_nearly_ripe: number; nearly_ripe_to_ripe: number; ripe_to_overripe: number } }[] = await Promise.all(
          validItems.map(item =>
            supabase.functions.invoke('predict-shelf-life', { body: { ingredientName: item.name.trim() } })
              .then(({ data }) => ({
                shelf_life: data?.shelf_life ?? null,
                is_fruit: data?.is_fruit ?? false,
                ripening_days: data?.ripening_days ?? null,
              }))
          )
        );
        setLoading(true);
        for (let i = 0; i < validItems.length; i++) {
          const item = validItems[i];
          const { shelf_life, is_fruit, ripening_days } = results[i];
          const defaultStorage: StorageLocation = shelf_life?.default_storage ?? 'refrigerator';
          const rd = ripening_days;
          await addInventoryItem(user!.id, {
            name: item.name.trim(),
            quantity: item.quantity,
            unit: item.amountUnit === 'N/A' ? 'piece' : `${item.amountValue || '1'}${item.amountUnit}`,
            amount_value: parseFloat(item.amountValue) || 0,
            amount_unit: item.amountUnit,
            storage_location: defaultStorage,
            price: parseFloat(item.price),
            ai_shelf_life: shelf_life,
            is_fruit,
            ripening_days: rd ? {
              unripe_to_nearly_ripe: rd.unripe_to_nearly_ripe ?? 0,
              nearly_ripe_to_ripe:   rd.nearly_ripe_to_ripe   ?? 0,
              ripe_to_overripe:      rd.ripe_to_overripe       ?? 0,
            } : null,
          });
        }
        toast.success(`${validItems.length} ingredient${validItems.length !== 1 ? 's' : ''} added to inventory!`);
        onAdd();
        onClose();
      } catch (err: unknown) {
        toast.error((err as Error).message || 'Failed to add ingredients');
      } finally {
        setAiLoading(false);
        setLoading(false);
      }
    } else {
      // Single-item mode — show shelf-life picker
      const item = validItems[0];
      setAiLoading(true);
      try {
        const { data } = await supabase.functions.invoke('predict-shelf-life', {
          body: { ingredientName: item.name.trim() },
        });
        const sl = data?.shelf_life ? (data.shelf_life as AiShelfLife) : null;
        setAiShelfLife(sl);
        setPredictedIsFruit(data?.is_fruit ?? false);
        setPredictedRipeningDays(data?.ripening_days ?? null);
        setSelectedStorage(sl?.default_storage ?? 'refrigerator');
        setShowShelfLifePicker(true);
      } catch {
        toast.error('Failed to predict shelf life. Please try again.');
      } finally {
        setAiLoading(false);
      }
    }
  };

  // Phase 2 (single-item only): confirm add with selected storage
  const confirmManualAdd = async () => {
    if (!user) return;
    const item = queue[0];
    setLoading(true);
    try {
      await addInventoryItem(user.id, {
        name: item.name.trim(),
        quantity: item.quantity,
        unit: item.amountUnit === 'N/A' ? 'piece' : `${item.amountValue || '1'}${item.amountUnit}`,
        amount_value: parseFloat(item.amountValue) || 0,
        amount_unit: item.amountUnit,
        storage_location: selectedStorage,
        price: parseFloat(item.price),
        ai_shelf_life: aiShelfLife,
        is_fruit: predictedIsFruit,
        ripening_days: predictedRipeningDays ? {
          unripe_to_nearly_ripe: predictedRipeningDays.unripe_to_nearly_ripe ?? 0,
          nearly_ripe_to_ripe:   predictedRipeningDays.nearly_ripe_to_ripe   ?? 0,
          ripe_to_overripe:      predictedRipeningDays.ripe_to_overripe       ?? 0,
        } : null,
      });
      toast.success(`${item.name} added to inventory!`);
      onAdd();
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';
    setScanLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const mimeType = file.type || 'image/jpeg';
          const { data, error } = await supabase.functions.invoke('ocr-receipt', {
            body: { image: base64, mimeType },
          });
          if (error) {
            // Extract real error message from edge function response
            let msg = error.message || 'Receipt processing failed';
            try {
              const ctx = await (error as { context?: Response }).context?.json?.();
              if (ctx?.error) msg = ctx.error;
            } catch { /* ignore */ }
            throw new Error(msg);
          }
          const items = (data?.items ?? []) as ReceiptPreviewItem[];
          if (items.length === 0) {
            toast.error('No food items found in receipt');
            setScanLoading(false);
            return;
          }
          // Normalize ripening_days from OCR 3-field format to 2-field format
          const normalized = items.map(item => ({
            ...item,
            ripening_days: item.ripening_days
              ? {
                  unripe_to_nearly_ripe: (item.ripening_days as { unripe_to_nearly_ripe?: number; nearly_ripe_to_ripe?: number; ripe_to_overripe?: number }).unripe_to_nearly_ripe ?? 0,
                  nearly_ripe_to_ripe:   (item.ripening_days as { unripe_to_nearly_ripe?: number; nearly_ripe_to_ripe?: number; ripe_to_overripe?: number }).nearly_ripe_to_ripe   ?? 0,
                  ripe_to_overripe:      (item.ripening_days as { unripe_to_nearly_ripe?: number; nearly_ripe_to_ripe?: number; ripe_to_overripe?: number }).ripe_to_overripe      ?? 0,
                }
              : null,
          }));
          setReceiptItems(normalized);
        } catch (err: unknown) {
          toast.error((err as Error).message || 'Receipt processing failed');
        } finally {
          setScanLoading(false);
        }
      };
      reader.onerror = () => { toast.error('Failed to read file'); setScanLoading(false); };
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Receipt processing failed');
      setScanLoading(false);
    }
  };

  const handleReceiptItemChange = (idx: number, field: keyof ReceiptPreviewItem, value: string | number) => {
    setReceiptItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, [field]: value } : item) : prev);
  };

  const handleReceiptRemoveItem = (idx: number) => {
    setReceiptItems(prev => prev ? prev.filter((_, i) => i !== idx) : prev);
  };

  const handleReceiptConfirm = async () => {
    if (!user || !receiptItems) return;
    setAddingReceipt(true);
    try {
      for (const item of receiptItems) {
        const defaultStorage: StorageLocation = item.shelf_life?.default_storage ?? 'refrigerator';
        const rd = item.ripening_days;
        await addInventoryItem(user.id, {
          name: item.name,
          quantity: item.quantity,
          unit: item.amount_unit === 'N/A' ? 'piece' : `${item.amount_value}${item.amount_unit}`,
          amount_value: typeof item.amount_value === 'number' ? item.amount_value : (parseFloat(String(item.amount_value)) || 0),
          amount_unit: item.amount_unit,
          storage_location: defaultStorage,
          price: item.price,
          ai_shelf_life: item.shelf_life,
          is_fruit: item.is_fruit ?? false,
          ripening_days: rd
            ? {
                unripe_to_nearly_ripe: rd.unripe_to_nearly_ripe ?? 0,
                nearly_ripe_to_ripe:   rd.nearly_ripe_to_ripe   ?? 0,
                ripe_to_overripe:      rd.ripe_to_overripe       ?? 0,
              }
            : null,
        });
      }
      toast.success(`Added ${receiptItems.length} item${receiptItems.length !== 1 ? 's' : ''} to inventory!`);
      onAdd();
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to add items');
    } finally {
      setAddingReceipt(false);
    }
  };

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="manual"><Keyboard className="h-3.5 w-3.5 mr-1.5" />Manual</TabsTrigger>
          <TabsTrigger value="receipt"><Scan className="h-3.5 w-3.5 mr-1.5" />Receipt</TabsTrigger>
        </TabsList>

        {/* ── Manual Tab ── */}
        <TabsContent value="manual" className="space-y-4 pt-3">
          {/* Queue items */}
          {queue.map((item, idx) => (
            <div key={item.id} className="space-y-3 rounded-xl border border-border/60 p-3 relative">
              {queue.length > 1 && (
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-muted-foreground">Ingredient {idx + 1}</p>
                  <button type="button" onClick={() => removeQueueItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div>
                <Label className="text-sm font-normal">Ingredient Name</Label>
                <Input
                  value={item.name}
                  onChange={e => updateQueueItem(item.id, { name: e.target.value })}
                  placeholder="e.g. Chicken Breast"
                  className="mt-1"
                  autoFocus={idx === 0}
                />
              </div>

              <div>
                <Label className="text-sm font-normal">Amount</Label>
                <div className="flex gap-2 mt-1 items-center">
                  {item.amountUnit === 'N/A' ? (
                    <div className="w-14 h-9 flex items-center justify-center border border-border rounded-md text-sm text-muted-foreground bg-muted/30 shrink-0">—</div>
                  ) : (
                    <NumericStepper
                      value={parseFloat(item.amountValue) || 0.1}
                      onChange={v => updateQueueItem(item.id, { amountValue: String(v) })}
                      min={0.1} max={999} step={1} allowDecimal
                    />
                  )}
                  <div className="flex flex-wrap gap-1">
                    {AMOUNT_UNITS.map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => updateQueueItem(item.id, { amountUnit: u })}
                        className={cn(
                          'px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors',
                          item.amountUnit === u
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                        )}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-normal">
                  Quantity <span className="text-muted-foreground text-xs">(how many packs/pieces - max 24)</span>
                </Label>
                <div className="mt-1">
                  <QuantityStepper value={item.quantity} onChange={v => updateQueueItem(item.id, { quantity: v })} />
                </div>
              </div>

              <div>
                <Label className="text-sm font-normal">
                  Price <span className="text-muted-foreground text-xs">({currencySymbol})</span>
                </Label>
                <div className="mt-1">
                  <NumericStepper
                    value={parseFloat(item.price) || 0}
                    onChange={v => updateQueueItem(item.id, { price: String(v) })}
                    min={0} max={9999} step={1} allowDecimal
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add Another button — only shown when not in shelf-life picker */}
          {!showShelfLifePicker && queue.length < 24 && (
            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addAnotherItem} type="button">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add Another
            </Button>
          )}

          {aiLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              {isBatch ? `Processing ${queue.filter(q => q.name.trim()).length} ingredients…` : 'Predicting shelf life smartly…'}
            </div>
          )}

          {/* Shelf life picker — single item mode only */}
          {showShelfLifePicker && aiShelfLife && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Select storage location</p>
              {(['room_temperature', 'refrigerator', 'freezer'] as StorageLocation[]).map(loc => {
                const info = getBestBeforeInfo(loc);
                const isSelected = selectedStorage === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setSelectedStorage(loc)}
                    className={cn(
                      'w-full text-left rounded-lg border p-2.5 transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{getStorageLabel(loc)}</span>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    {info?.advised ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Best before {info.date} · {info.label}
                      </p>
                    ) : (
                      <p className="text-xs text-destructive mt-0.5">Not advised</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            {!showShelfLifePicker ? (
              <Button
                onClick={checkShelfLife}
                disabled={aiLoading || loading}
                className="flex-1 bg-copper-gradient text-primary-foreground"
              >
                {aiLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add {queue.filter(q => q.name.trim()).length || 1} Ingredient{queue.filter(q => q.name.trim()).length !== 1 ? 's' : ''}
              </Button>
            ) : (
              <Button onClick={confirmManualAdd} disabled={loading} className="flex-1 bg-copper-gradient text-primary-foreground">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add to Inventory
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ── Receipt Tab ── */}
        <TabsContent value="receipt" className="pt-3 space-y-3">
          {receiptItems ? (
            <ReceiptPreview
              items={receiptItems}
              onItemChange={handleReceiptItemChange}
              onRemoveItem={handleReceiptRemoveItem}
              onConfirm={handleReceiptConfirm}
              onCancel={() => setReceiptItems(null)}
              currencySymbol={currencySymbol}
              loading={addingReceipt}
            />
          ) : (
            <>
              <div className="glass rounded-xl p-6 border-dashed border-2 border-border text-center">
                <Scan className="h-10 w-10 mx-auto text-primary mb-3" />
                <p className="text-sm font-medium">Scan a Grocery Receipt</p>
                <p className="text-xs text-muted-foreground mt-1">Smart extracts food items, quantities, prices and predicts expiry dates</p>
              </div>

              {/* Camera input — opens device camera directly (mobile only) */}
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleReceiptFile}
              />
              <Button
                onClick={() => photoRef.current?.click()}
                disabled={scanLoading}
                className="w-full bg-copper-gradient text-primary-foreground md:opacity-40 md:pointer-events-none md:cursor-not-allowed"
                title="Take Photo is only available on mobile devices"
              >
                {scanLoading
                  ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Smart extracting…</>
                  : <><Camera className="h-4 w-4 mr-2" />Take Photo of Receipt</>}
              </Button>

              {/* Upload from files */}
              <input
                ref={uploadRef}
                type="file"
                accept=".jpg,.jpeg,.png,.heic,.webp,image/*"
                className="hidden"
                onChange={handleReceiptFile}
              />
              <Button
                variant="outline"
                onClick={() => uploadRef.current?.click()}
                disabled={scanLoading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />Upload Receipt / e-Invoice
              </Button>

              <Button variant="outline" className="w-full" onClick={onClose}>Cancel</Button>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Inventory Item extended ──────────────────────────────────────

interface InventoryItemEx extends InventoryItem {
  daysUntilExpiry: number;
  expiryStatus: 'fresh' | 'soon' | 'warning' | 'expired';
}

// ── Inline Item Row ──────────────────────────────────────────────

function ItemRow({
  item, onBin, onRemove, onQtyAdd, onQtyMinus, currencySymbol, onStorageChange, onExpiryChange, ripeningMap, onStageChange,
}: {
  item: InventoryItemEx;
  onBin: () => void;
  onRemove: () => void;
  onQtyAdd: () => void;
  onQtyMinus: () => void;
  currencySymbol: string;
  onStorageChange: (storage: StorageLocation) => void;
  onExpiryChange: (newDate: string) => void;
  ripeningMap: Map<string, RipeningItem>;
  onStageChange: (itemId: string, stage: RipenessStage) => void;
}) {
  const styles = statusStyle(item.expiryStatus);
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [expiryVal, setExpiryVal] = useState(item.expiry_date);

  const bestBeforeFormatted = item.expiry_date
    ? new Date(item.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '—';

  const durationLabel = item.daysUntilExpiry < 0
    ? 'Expired'
    : formatDuration(item.daysUntilExpiry);

  const handleExpirySubmit = () => {
    if (expiryVal) onExpiryChange(expiryVal);
    setEditingExpiry(false);
  };

  return (
    <div className={cn('px-4 py-3 space-y-2', styles.row)}>
      {/* Row 1: name + duration badge */}
      <div className="flex items-center gap-2">
        <div className={cn('h-2 w-2 rounded-full shrink-0', styles.dot)} />
        <span className="text-sm font-medium flex-1 min-w-0 truncate">{item.name}</span>
        <Badge variant="outline" className={cn('text-xs shrink-0', styles.badge)}>
          {durationLabel}
        </Badge>
      </div>

      {/* Row 2: details with +/- qty controls */}
      <div className="pl-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground items-center">
        {/* Quantity +/- */}
        <div className="flex items-center gap-1">
          <button
            onClick={onQtyMinus}
            className="h-5 w-5 rounded border border-border flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Remove one"
          >
            <span className="text-xs leading-none">−</span>
          </button>
          <span className="min-w-[2rem] text-center font-medium text-foreground">{item.quantity} × {item.unit || 'piece'}</span>
          <button
            onClick={onQtyAdd}
            className="h-5 w-5 rounded border border-border flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Add one"
          >
            <span className="text-xs leading-none">+</span>
          </button>
        </div>
        {item.price > 0 && <span>{currencySymbol}{item.price.toFixed(2)}</span>}

        {/* Best-before: click to edit */}
        <button
          onClick={() => { setEditingExpiry(true); setExpiryVal(item.expiry_date); }}
          className="flex items-center gap-1 hover:text-primary transition-colors"
          title="Click to change best-before date"
        >
          <Pencil className="h-3 w-3" />
          {bestBeforeFormatted}
        </button>
        {editingExpiry && (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={expiryVal}
              onChange={e => setExpiryVal(e.target.value)}
              className="h-6 text-xs border border-border rounded px-1 bg-background text-foreground"
            />
            <button onClick={handleExpirySubmit} className="text-success hover:text-success text-xs font-medium">Save</button>
            <button onClick={() => setEditingExpiry(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
          </div>
        )}
      </div>

      {/* Row 3: ripening slider (fruits only) */}
      {item.is_fruit && (
        <div className="pl-4 pr-2">
          <RipeningSlider
            item={item}
            ripeningMap={ripeningMap}
            onStageChange={onStageChange}
          />
        </div>
      )}

      {/* Row 4: storage pill switcher */}
      <div className="pl-4 flex flex-wrap items-center gap-1.5">
        {STORAGE_LOCATIONS.map(loc => {
          const aiDays = item.ai_shelf_life ? item.ai_shelf_life[loc.value] : undefined;
          const isNotAdvised = aiDays === 'not_advised';
          const isCurrent   = item.storage_location === loc.value;
          return (
            <button
              key={loc.value}
              onClick={() => onStorageChange(loc.value)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                isCurrent
                  ? 'bg-primary text-primary-foreground border-primary'
                  : isNotAdvised
                    ? 'border-destructive/40 text-destructive/60 hover:border-destructive hover:text-destructive'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
              )}
              title={isNotAdvised ? 'Not advised for this storage' : typeof aiDays === 'number' ? `${aiDays}d in ${loc.label}` : undefined}
            >
              {loc.label}
              {isNotAdvised && isCurrent && ' ⚠'}
            </button>
          );
        })}
      </div>

      {/* Row 4: action buttons */}
      <div className="pl-4 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={onBin}
        >
          <Trash2 className="h-3 w-3 mr-1" />Bin
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={onRemove}
        >
          <X className="h-3 w-3 mr-1" />Remove
        </Button>
      </div>
    </div>
  );
}

// ── Grid Item Card ───────────────────────────────────────────────

function ItemCard({
  item, onBin, onRemove, onQtyAdd, onQtyMinus, currencySymbol, onStorageChange, onExpiryChange, ripeningMap, onStageChange,
}: {
  item: InventoryItemEx;
  onBin: () => void;
  onRemove: () => void;
  onQtyAdd: () => void;
  onQtyMinus: () => void;
  currencySymbol: string;
  onStorageChange: (storage: StorageLocation) => void;
  onExpiryChange: (newDate: string) => void;
  ripeningMap: Map<string, RipeningItem>;
  onStageChange: (itemId: string, stage: RipenessStage) => void;
}) {
  const styles = statusStyle(item.expiryStatus);
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [expiryVal, setExpiryVal] = useState(item.expiry_date);

  const bestBeforeFormatted = item.expiry_date
    ? new Date(item.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '—';

  const durationLabel = item.daysUntilExpiry < 0 ? 'Expired' : formatDuration(item.daysUntilExpiry);

  const handleExpirySubmit = () => {
    if (expiryVal) onExpiryChange(expiryVal);
    setEditingExpiry(false);
  };

  return (
    <Card className={cn('glass border-0 shadow-card h-full flex flex-col', styles.row)}>
      <CardContent className="pt-3 pb-3 flex flex-col flex-1 gap-2">
        <div className="flex items-start justify-between gap-1">
          <div className={cn('h-2 w-2 rounded-full shrink-0 mt-1.5', styles.dot)} />
          <Badge variant="outline" className={cn('text-xs ml-auto shrink-0', styles.badge)}>
            {durationLabel}
          </Badge>
        </div>
        <p className="text-sm font-semibold leading-snug text-balance">{item.name}</p>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {/* Quantity +/- inline */}
          <div className="flex items-center gap-1">
            <button onClick={onQtyMinus} className="h-4 w-4 rounded border border-border flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Remove one">
              <span className="text-xs leading-none">−</span>
            </button>
            <span className="text-xs font-medium text-foreground">{item.quantity} × {item.unit || 'piece'}</span>
            <button onClick={onQtyAdd} className="h-4 w-4 rounded border border-border flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Add one">
              <span className="text-xs leading-none">+</span>
            </button>
          </div>
          {item.price > 0 && <p>{currencySymbol}{item.price.toFixed(2)}</p>}
          {/* Best-before editable */}
          {editingExpiry ? (
            <div className="flex items-center gap-1 flex-wrap">
              <input
                type="date"
                value={expiryVal}
                onChange={e => setExpiryVal(e.target.value)}
                className="h-6 text-xs border border-border rounded px-1 bg-background text-foreground w-full"
              />
              <button onClick={handleExpirySubmit} className="text-success text-xs font-medium">Save</button>
              <button onClick={() => setEditingExpiry(false)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button onClick={() => { setEditingExpiry(true); setExpiryVal(item.expiry_date); }}
              className="flex items-center gap-1 hover:text-primary transition-colors">
              <Pencil className="h-3 w-3" />{bestBeforeFormatted}
            </button>
          )}
        </div>

        {/* Storage pills */}
        <div className="flex flex-wrap gap-1 mt-auto">
          {STORAGE_LOCATIONS.map(loc => {
            const aiDays      = item.ai_shelf_life ? item.ai_shelf_life[loc.value] : undefined;
            const isNotAdvised = aiDays === 'not_advised';
            const isCurrent    = item.storage_location === loc.value;
            return (
              <button
                key={loc.value}
                onClick={() => onStorageChange(loc.value)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                  isCurrent
                    ? 'bg-primary text-primary-foreground border-primary'
                    : isNotAdvised
                      ? 'border-destructive/40 text-destructive/60 hover:border-destructive hover:text-destructive'
                      : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                )}
              >
                {loc.label}{isNotAdvised && isCurrent ? ' ⚠' : ''}
              </button>
            );
          })}
        </div>

        {/* Ripening slider (fruits only — in grid view, between storage and buttons) */}
        {item.is_fruit && (
          <div className="w-full">
            <RipeningSlider
              item={item}
              ripeningMap={ripeningMap}
              onStageChange={onStageChange}
            />
          </div>
        )}

        <div className="flex gap-1.5">
          <Button size="sm" variant="outline"
            className="flex-1 h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={onBin}>
            <Trash2 className="h-3 w-3 mr-1" />Bin
          </Button>
          <Button size="sm" variant="ghost"
            className="flex-1 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={onRemove}>
            <X className="h-3 w-3 mr-1" />Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function InventoryPage() {
  const { user, profile } = useAuth();
  const plan = usePlan();
  const [searchParams] = useSearchParams();
  const currencySymbol = CURRENCY_SYMBOLS[profile?.currency ?? 'USD'];

  const [items, setItems]           = useState<InventoryItemEx[]>(() =>
    (appCache.get('items') as InventoryItemEx[]) ?? []
  );
  const [loading, setLoading]       = useState(() => !appCache.has('items'));
  const [viewMode, setViewMode]     = useState<'list' | 'grid'>('list');
  const [addOpen, setAddOpen]       = useState(false);
  const [binItem, setBinItem]       = useState<InventoryItemEx | null>(null);
  const [qtyItem, setQtyItem]       = useState<InventoryItemEx | null>(null);
  const [qtyAction, setQtyAction]   = useState<'add' | 'remove' | null>(null);
  const [search, setSearch]         = useState('');
  const [ripeningMap, setRipeningMap] = useState<Map<string, RipeningItem>>(new Map());
  const [activeTab, setActiveTab]   = useState('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toEx = useCallback((item: InventoryItem): InventoryItemEx => {
    const days = getDaysUntilExpiry(item.expiry_date);
    return { ...item, daysUntilExpiry: days, expiryStatus: getExpiryStatus(days) };
  }, []);

  // Initial load — skip if cache warm
  useEffect(() => {
    if (!user) return;
    if (appCache.has('items')) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getInventory(user.id),
      getRipeningItems(user.id),
    ]).then(([inv, ripItems]) => {
      if (cancelled) return;
      const exItems = inv.map(toEx);
      setItems(exItems);
      appCache.set('items', exItems);
      const map = new Map<string, RipeningItem>();
      ripItems.forEach(r => map.set(r.inventory_item_id, r));
      setRipeningMap(map);
    }).catch(err => toast.error((err as Error).message))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, toEx]);

  useEffect(() => { if (searchParams.get('add') === 'true') setAddOpen(true); }, [searchParams]);

  // Realtime — fine-grained updates, no full reload
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('inventory-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inventory_items', filter: `user_id=eq.${user.id}` },
        payload => setItems(prev => prev.find(i => i.id === payload.new.id) ? prev : [...prev, toEx(payload.new as InventoryItem)])
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inventory_items', filter: `user_id=eq.${user.id}` },
        payload => setItems(prev => prev.map(i => i.id === payload.new.id ? toEx(payload.new as InventoryItem) : i))
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'inventory_items', filter: `user_id=eq.${user.id}` },
        payload => setItems(prev => prev.filter(i => i.id !== payload.old.id))
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, toEx]);

  // Optimistic storage change + undo
  const handleStorageChange = useCallback((item: InventoryItemEx, newStorage: StorageLocation) => {
    const prev = item;
    const aiDays = item.ai_shelf_life ? item.ai_shelf_life[newStorage] : undefined;
    const isNotAdvised = aiDays === 'not_advised';
    let newExpiry = item.expiry_date;
    if (isNotAdvised) {
      // Set expiry to today when storage is not advised
      newExpiry = new Date().toISOString().split('T')[0];
    } else if (item.ai_shelf_life) {
      const computed = computeExpiryFromAI(item.purchase_date, item.ai_shelf_life, newStorage);
      if (computed) newExpiry = computed;
    }
    const updated: InventoryItemEx = toEx({ ...item, storage_location: newStorage, expiry_date: newExpiry });
    setItems(list => list.map(i => i.id === item.id ? updated : i));
    updateInventoryItem(item.id, { storage_location: newStorage, expiry_date: newExpiry }).catch(() => {
      setItems(list => list.map(i => i.id === item.id ? prev : i));
      toast.error('Failed to update storage');
    });
  }, [toEx]);

  // Optimistic expiry change + undo
  const handleExpiryChange = useCallback((item: InventoryItemEx, newDate: string) => {
    const prev = item;
    const updated: InventoryItemEx = toEx({ ...item, expiry_date: newDate, is_expiry_override: true });
    setItems(list => list.map(i => i.id === item.id ? updated : i));
    const idxSnapshot = items.findIndex(i => i.id === item.id);
    toast('Best-before updated', {
      action: {
        label: 'Undo',
        onClick: () => {
          setItems(list => list.map(i => i.id === item.id ? prev : i));
          updateInventoryItem(item.id, { expiry_date: prev.expiry_date, is_expiry_override: prev.is_expiry_override }).catch(() => {});
        },
      },
      onDismiss: () => updateInventoryItem(item.id, { expiry_date: newDate, is_expiry_override: true }).catch(() => {}),
      onAutoClose: () => updateInventoryItem(item.id, { expiry_date: newDate, is_expiry_override: true }).catch(() => {}),
      duration: 4000,
    });
    void idxSnapshot;
  }, [items, toEx]);

  // Optimistic bin with undo (remove from list, defer DB call)
  const handleBinConfirm = useCallback(async (item: InventoryItemEx) => {
    if (!user) return;
    const idx = items.findIndex(i => i.id === item.id);
    setItems(list => list.filter(i => i.id !== item.id));
    setBinItem(null);
    toast(`${item.name} moved to waste log`, {
      action: {
        label: 'Undo',
        onClick: () => {
          setItems(prev => {
            const next = [...prev];
            next.splice(idx, 0, item);
            return next;
          });
        },
      },
      onDismiss: async () => {
        try { await logWaste(user.id, item.name, item.price, item.id); await deleteInventoryItem(item.id); } catch { /* ignore */ }
      },
      onAutoClose: async () => {
        try { await logWaste(user.id, item.name, item.price, item.id); await deleteInventoryItem(item.id); } catch { /* ignore */ }
      },
      duration: 4000,
    });
  }, [user, items]);

  // Optimistic remove with undo
  const handleRemove = useCallback((item: InventoryItemEx) => {
    const idx = items.findIndex(i => i.id === item.id);
    setItems(list => list.filter(i => i.id !== item.id));
    toast(`${item.name} removed`, {
      action: {
        label: 'Undo',
        onClick: () => {
          setItems(prev => {
            const next = [...prev];
            next.splice(idx, 0, item);
            return next;
          });
        },
      },
      onDismiss: () => deleteInventoryItem(item.id).catch(() => {}),
      onAutoClose: () => deleteInventoryItem(item.id).catch(() => {}),
      duration: 4000,
    });
  }, [items]);

  // +/- quantity: add one unit
  const handleQuantityAdd = useCallback(async (item: InventoryItemEx) => {
    const newQty = item.quantity + 1;
    setItems(list => list.map(i => i.id === item.id ? { ...i, quantity: newQty } : i));
    try {
      await updateInventoryItem(item.id, { quantity: newQty });
    } catch {
      setItems(list => list.map(i => i.id === item.id ? { ...i, quantity: item.quantity } : i));
      toast.error('Failed to update quantity');
    }
  }, []);

  // +/- quantity: remove one unit — shows modal for consume/remove choice
  const handleQuantityMinus = useCallback((item: InventoryItemEx) => {
    if (item.quantity <= 1) {
      // If last unit, open bin/remove flow directly
      setBinItem(item);
      return;
    }
    setQtyItem(item);
    setQtyAction('remove');
  }, []);

  const handleQtyModalClose = () => { setQtyItem(null); setQtyAction(null); };

  // Remove one: decrement quantity
  const handleQtyRemoveOne = useCallback(async () => {
    if (!qtyItem) return;
    const newQty = qtyItem.quantity - 1;
    setItems(list => list.map(i => i.id === qtyItem.id ? { ...i, quantity: newQty } : i));
    handleQtyModalClose();
    try {
      await updateInventoryItem(qtyItem.id, { quantity: newQty });
      toast.success(`Removed 1 × ${qtyItem.name}`);
    } catch {
      setItems(list => list.map(i => i.id === qtyItem.id ? { ...i, quantity: qtyItem.quantity } : i));
      toast.error('Failed to update quantity');
    }
  }, [qtyItem]);

  // Consume one: decrement quantity + log nutrition macros
  const handleQtyConsumeOne = useCallback(async () => {
    if (!user || !qtyItem) return;
    const newQty = qtyItem.quantity - 1;
    setItems(list => list.map(i => i.id === qtyItem.id ? { ...i, quantity: newQty } : i));
    handleQtyModalClose();
    try {
      await updateInventoryItem(qtyItem.id, { quantity: newQty });
      // Log macros if pre-stored
      if (qtyItem.calories_per_unit > 0 || qtyItem.protein_per_unit > 0) {
        await logNutrition(user.id, {
          recipe_name: qtyItem.name,
          calories: qtyItem.calories_per_unit,
          protein: qtyItem.protein_per_unit,
          carbs: qtyItem.carbs_per_unit,
          fat: qtyItem.fat_per_unit,
        });
        toast.success(`Logged 1 × ${qtyItem.name} — ${qtyItem.calories_per_unit} kcal`);
      } else {
        toast.success(`Consumed 1 × ${qtyItem.name}`);
      }
    } catch {
      setItems(list => list.map(i => i.id === qtyItem.id ? { ...i, quantity: qtyItem.quantity } : i));
      toast.error('Failed to update quantity');
    }
  }, [user, qtyItem]);

  // Ripening stage change — no toast (alerts moved to Dashboard Kitchen Alerts)
  const handleStageChange = useCallback((itemId: string, stage: RipenessStage) => {
    if (!user) return;
    const now = new Date().toISOString();
    const itemName = items.find(i => i.id === itemId)?.name ?? 'Unknown';
    setRipeningMap(prev => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      next.set(itemId, {
        id: existing?.id ?? '',
        user_id: user.id,
        inventory_item_id: itemId,
        produce_name: itemName,
        ripeness_stage: stage,
        estimated_ripe_date: null,
        user_adjusted: true,
        stage_set_at: now,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      });
      return next;
    });
    upsertRipeningItem({
      id: ripeningMap.get(itemId)?.id || undefined,
      user_id: user.id,
      inventory_item_id: itemId,
      produce_name: itemName,
      ripeness_stage: stage,
      stage_set_at: now,
      user_adjusted: true,
    }).catch(() => {});
  }, [user, items, ripeningMap]);

  const filtered = items
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    .filter(i => activeTab === 'all' || i.expiryStatus === activeTab);
  const fruitItems = filtered.filter(i => i.is_fruit);

  const freshCount   = items.filter(i => i.expiryStatus === 'fresh').length;
  const soonCount    = items.filter(i => i.expiryStatus === 'soon').length;
  const warnCount    = items.filter(i => i.expiryStatus === 'warning').length;
  const expiredCount = items.filter(i => i.expiryStatus === 'expired').length;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold gradient-text text-balance">Inventory</h1>
            <p className="text-sm text-muted-foreground">{items.length} ingredient{items.length !== 1 ? 's' : ''} in your kitchen</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="flex border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn('px-2.5 py-1.5 transition-colors', viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}
                aria-label="List view"
              ><LayoutList className="h-4 w-4" /></button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn('px-2.5 py-1.5 transition-colors', viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}
                aria-label="Grid view"
              ><LayoutGrid className="h-4 w-4" /></button>
            </div>
            <Button
              className="bg-copper-gradient text-primary-foreground"
              onClick={() => {
                if (!plan.isPro && items.length >= plan.maxInventory) {
                  toast.error(`Free plan allows up to ${plan.maxInventory} items. Upgrade to Pro for unlimited inventory.`);
                  return;
                }
                setAddOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />Add Ingredients
            </Button>
          </div>
        </div>

        {/* Segmented pill filter + search */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex flex-wrap gap-1 flex-1">
            {[
              { value: 'all',     label: 'All',     count: items.length },
              { value: 'fresh',   label: 'Fresh',   count: freshCount,   cls: 'data-[active=true]:bg-success data-[active=true]:text-white border-success text-success' },
              { value: 'soon',    label: 'Soon',    count: soonCount,    cls: 'data-[active=true]:bg-warning data-[active=true]:text-white border-warning text-warning' },
              { value: 'warning', label: '<2d',     count: warnCount,    cls: 'data-[active=true]:bg-destructive data-[active=true]:text-white border-destructive text-destructive' },
              { value: 'expired', label: 'Expired', count: expiredCount, cls: 'data-[active=true]:bg-destructive/60 data-[active=true]:text-white border-destructive/40 text-destructive/70' },
            ].map(({ value, label, count, cls = '' }) => (
              <button
                key={value}
                data-active={activeTab === value}
                onClick={() => setActiveTab(value)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  activeTab === value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:bg-muted',
                  cls
                )}
              >
                {label} ({count})
              </button>
            ))}
          </div>
          <div className="relative md:w-56">
            <Input
              ref={searchInputRef}
              placeholder="Search ingredients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-8"
            />
            {search && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => { setSearch(''); searchInputRef.current?.focus(); }}
                tabIndex={-1}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {!plan.isPro && items.length >= plan.maxInventory && (
          <UpgradePrompt message={`You've reached the ${plan.maxInventory}-item limit on the Free plan.`} className="mb-2" />
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div>
            {filtered.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center">
                <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="font-semibold text-muted-foreground">
                  {items.length === 0 ? 'Your inventory is empty' : 'No ingredients match your search'}
                </p>
                {items.length === 0 && (
                  <Button onClick={() => setAddOpen(true)} className="mt-4 bg-copper-gradient text-primary-foreground">
                    <Plus className="h-4 w-4 mr-2" />Add First Ingredient
                  </Button>
                )}
              </div>
            ) : viewMode === 'list' ? (
              <VirtualList
                items={filtered}
                renderItem={item => (
                  <ItemRow
                    key={item.id}
                    item={item as InventoryItemEx}
                    onBin={() => setBinItem(item as InventoryItemEx)}
                    onRemove={() => handleRemove(item as InventoryItemEx)}
                    onQtyAdd={() => handleQuantityAdd(item as InventoryItemEx)}
                    onQtyMinus={() => handleQuantityMinus(item as InventoryItemEx)}
                    currencySymbol={currencySymbol}
                    onStorageChange={s => handleStorageChange(item as InventoryItemEx, s)}
                    onExpiryChange={d => handleExpiryChange(item as InventoryItemEx, d)}
                    ripeningMap={ripeningMap}
                    onStageChange={handleStageChange}
                  />
                )}
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onBin={() => setBinItem(item)}
                    onRemove={() => handleRemove(item)}
                    onQtyAdd={() => handleQuantityAdd(item)}
                    onQtyMinus={() => handleQuantityMinus(item)}
                    currencySymbol={currencySymbol}
                    onStorageChange={s => handleStorageChange(item, s)}
                    onExpiryChange={d => handleExpiryChange(item, d)}
                    ripeningMap={ripeningMap}
                    onStageChange={handleStageChange}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Ingredient Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scan className="h-4 w-4 text-primary" />Add Ingredients
            </DialogTitle>
          </DialogHeader>
          <AddIngredientForm
            onAdd={() => {
              getInventory(user?.id ?? '').then(inv => setItems(inv.map(toEx))).catch(() => {});
              setAddOpen(false);
            }}
            onClose={() => setAddOpen(false)}
            currencySymbol={currencySymbol}
          />
        </DialogContent>
      </Dialog>

      {/* Bin confirmation */}
      <AlertDialog open={!!binItem} onOpenChange={open => !open && setBinItem(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Bin this item?</AlertDialogTitle>
            <AlertDialogDescription>
              "{binItem?.name}" will be logged as waste. This helps track food costs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => binItem && handleBinConfirm(binItem)}
            >
              Bin it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Consume / Remove one modal */}
      <AlertDialog open={!!qtyItem && qtyAction === 'remove'} onOpenChange={open => !open && handleQtyModalClose()}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove 1 × {qtyItem?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose whether to log it as consumed (records macros in Nutrition) or simply remove it from your count.
              {qtyItem && qtyItem.calories_per_unit > 0 && (
                <span className="block mt-2 text-xs text-muted-foreground">
                  Macros per unit: {qtyItem.calories_per_unit} kcal · {qtyItem.protein_per_unit}g protein · {qtyItem.carbs_per_unit}g carbs · {qtyItem.fat_per_unit}g fat
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleQtyModalClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-muted text-foreground hover:bg-muted/80 border border-border"
              onClick={handleQtyRemoveOne}
            >
              Remove only
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-primary text-primary-foreground"
              onClick={handleQtyConsumeOne}
            >
              Log as consumed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
