import {Check, 
  Package, Plus, RefreshCw,
  ShoppingCart, Sparkles, X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ProUpgradeModal } from '@/components/common/ProUpgradeModal';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericStepper } from '@/components/ui/NumericStepper';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { usePlan } from '@/hooks/usePlan';
import {addGroceryItem, 
  deleteGroceryItem, deleteGroceryItems, 
  getGroceryList, 
  getGrocerySetting, getInventory,toggleGroceryItem,upsertGrocerySetting,
} from '@/lib/api';
import type { GroceryListItem } from '@/types/types';

const PAGE = 40;
function PaginatedList<T>({ items, renderItem }: { items: T[]; renderItem: (item: T) => React.ReactNode }) {
  const [visible, setVisible] = useState(PAGE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setVisible(PAGE); }, [items]);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisible(v => Math.min(v + PAGE, items.length));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [items.length]);
  return (
    <>
      {items.slice(0, visible).map(item => renderItem(item))}
      {visible < items.length && <div ref={sentinelRef} className="h-4" />}
    </>
  );
}

export default function GroceryPage() {
  const { user, profile } = useAuth();
  const { isPro } = usePlan();
  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState('');
  const [addQty, setAddQty] = useState('1');
  const [addOpen, setAddOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [days, setDays] = useState(7);
  const [pax, setPax] = useState(2);
  const [requirements, setRequirements] = useState('');
  const settingsLoadedRef = useRef(false);

  // Always fetch fresh on mount / user change
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      getGroceryList(user.id),
      !settingsLoadedRef.current ? getGrocerySetting(user.id) : Promise.resolve(null),
    ]).then(([list, setting]) => {
      setItems(list);
      if (setting) { setDays(setting.days); setPax(setting.pax); }
      settingsLoadedRef.current = true;
    }).finally(() => setLoading(false));
  }, [user]);

  // Realtime — update individual items, no full reload
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('grocery-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'grocery_list_items', filter: `user_id=eq.${user.id}` },
        payload => {
          setItems(prev => {
            if (prev.find(i => i.id === payload.new.id)) return prev;
            return [payload.new as GroceryListItem, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'grocery_list_items', filter: `user_id=eq.${user.id}` },
        payload => {
          setItems(prev => prev.map(i => i.id === payload.new.id ? payload.new as GroceryListItem : i));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'grocery_list_items', filter: `user_id=eq.${user.id}` },
        payload => {
          setItems(prev => prev.filter(i => i.id !== payload.old.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleAdd = async () => {
    if (!user || !addName.trim()) { toast.error('Enter an item name'); return; }
    try {
      const newItem = await addGroceryItem(user.id, {
        name: addName.trim(),
        quantity: addQty.trim() || '1',
        unit: '',
      });
      // Optimistic insert (realtime will also fire, deduped above)
      setItems(prev => [newItem, ...prev]);
      setAddName(''); setAddQty('1');
      setAddOpen(false);
      toast.success('Added to list!');
    } catch (err: unknown) { toast.error((err as Error).message); }
  };

  // Optimistic toggle — no reload
  const handleToggle = async (item: GroceryListItem) => {
    const newPurchased = !item.is_purchased;
    // Optimistic update
    setItems(prev => prev.map(i =>
      i.id === item.id
        ? { ...i, is_purchased: newPurchased, purchased_at: newPurchased ? new Date().toISOString() : null }
        : i
    ));
    try {
      await toggleGroceryItem(item.id, newPurchased);
    } catch {
      // Revert on failure
      setItems(prev => prev.map(i => i.id === item.id ? item : i));
      toast.error('Update failed');
    }
  };

  // Optimistic delete with undo
  const handleDelete = (id: string) => {
    const snapshot = items.find(i => i.id === id);
    if (!snapshot) return;
    const snapshotIdx = items.findIndex(i => i.id === id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast('Item removed', {
      action: {
        label: 'Undo',
        onClick: () => {
          setItems(prev => {
            const next = [...prev];
            next.splice(snapshotIdx, 0, snapshot);
            return next;
          });
        },
      },
      onDismiss: () => deleteGroceryItem(id).catch(() => {}),
      onAutoClose: () => deleteGroceryItem(id).catch(() => {}),
      duration: 4000,
    });
  };

  const handleClearAllToBuy = () => {
    const toBuy = items.filter(i => !i.is_purchased);
    if (!toBuy.length) return;
    const snapshot = [...items];
    setItems(prev => prev.filter(i => i.is_purchased));
    toast(`${toBuy.length} items cleared`, {
      action: {
        label: 'Undo',
        onClick: () => setItems(snapshot),
      },
      onDismiss: () => deleteGroceryItems(toBuy.map(i => i.id)).catch(() => {}),
      onAutoClose: () => deleteGroceryItems(toBuy.map(i => i.id)).catch(() => {}),
      duration: 4000,
    });
  };

  const handleClearAllPurchased = () => {
    const bought = items.filter(i => i.is_purchased);
    if (!bought.length) return;
    const snapshot = [...items];
    setItems(prev => prev.filter(i => !i.is_purchased));
    toast(`${bought.length} purchased items cleared`, {
      action: {
        label: 'Undo',
        onClick: () => setItems(snapshot),
      },
      onDismiss: () => deleteGroceryItems(bought.map(i => i.id)).catch(() => {}),
      onAutoClose: () => deleteGroceryItems(bought.map(i => i.id)).catch(() => {}),
      duration: 4000,
    });
  };

  const handleSmartSuggest = async () => {
    if (!user) return;
    // Save settings
    upsertGrocerySetting(user.id, days, pax).catch(() => {});
    setSmartOpen(false);
    setAiLoading(true);
    try {
      const inventory = await getInventory(user.id);
      const { data, error } = await supabase.functions.invoke('generate-grocery-list', {
        body: {
          inventory: inventory.map(i => `${i.name}: ${i.quantity}${i.unit}`),
          preferences: profile?.dietary_goal,
          cookingDevices: profile?.cooking_devices ?? [],
          existingList: items.filter(i => !i.is_purchased).map(i => i.name),
          days,
          pax,
          requirements: requirements.trim() || null,
        },
      });
      if (error) throw new Error((await error.context?.text()) || error.message);
      const newItems: Array<{ name: string; quantity: string; unit: string; reason: string }> = data?.items || [];
      const added: GroceryListItem[] = [];
      for (const item of newItems) {
        try {
          const created = await addGroceryItem(user.id, {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            reason: item.reason,
          });
          added.push(created);
        } catch { /* skip duplicates */ }
      }
      setItems(prev => [...added, ...prev]);
      toast.success(`${added.length} items suggested by Smart Suggest!`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Smart Suggest failed');
    } finally {
      setAiLoading(false);
    }
  };

  const pending = items.filter(i => !i.is_purchased);
  const purchased = items.filter(i => i.is_purchased);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold gradient-text text-balance">Grocery List</h1>
            <p className="text-sm text-muted-foreground">{pending.length} item{pending.length !== 1 ? 's' : ''} to buy</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => { if (!isPro) { setUpgradeOpen(true); return; } setSmartOpen(true); }} disabled={aiLoading}>
              {aiLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {isPro ? 'Smart Suggest' : '🔒 Smart Suggest'}
            </Button>
            <Button onClick={() => setAddOpen(true)} className="bg-copper-gradient text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />Add Item
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="font-semibold text-muted-foreground">Your grocery list is empty</p>
            <p className="text-sm text-muted-foreground mt-1">Add items manually or let Smart Suggest fill it based on your inventory</p>
            <div className="flex flex-col md:flex-row gap-3 justify-center mt-4">
              <Button onClick={() => setAddOpen(true)} className="bg-copper-gradient text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" />Add Item
              </Button>
              <Button variant="outline" onClick={() => setSmartOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />Smart Suggest
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* To Buy */}
            <Card className="glass border-0 shadow-card h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />To Buy
                  </span>
                  <Badge variant="secondary">{pending.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {pending.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">All done! 🛒</p>
                ) : (
                  <PaginatedList
                    items={pending}
                    renderItem={item => (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40 transition-colors group">
                        <button
                          onClick={() => handleToggle(item)}
                          className="h-5 w-5 rounded border border-border flex items-center justify-center shrink-0 hover:border-primary transition-colors"
                        >
                          <span className="sr-only">Mark purchased</span>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          {item.reason && <p className="text-xs text-muted-foreground truncate">{item.reason}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{item.quantity}</span>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  />
                )}
                {pending.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground mt-2"
                    onClick={handleClearAllToBuy}
                  >
                    Clear All To Buy
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Purchased */}
            <Card className="glass border-0 shadow-card h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-success" />Purchased
                  </span>
                  <Badge variant="secondary">{purchased.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {purchased.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No items purchased yet</p>
                ) : (
                  <PaginatedList
                    items={purchased}
                    renderItem={item => (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-2 opacity-60 group">
                        <button
                          onClick={() => handleToggle(item)}
                          className="h-5 w-5 rounded border border-success bg-success/20 flex items-center justify-center shrink-0"
                        >
                          <Check className="h-3 w-3 text-success" />
                        </button>
                        <p className="flex-1 text-sm line-through text-muted-foreground truncate min-w-0">{item.name}</p>
                        <span className="text-xs text-muted-foreground shrink-0">{item.quantity}</span>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  />
                )}
                {purchased.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground mt-2"
                    onClick={handleClearAllPurchased}
                  >
                    Clear All Purchased
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      {/* Smart Suggest Dialog */}
      <Dialog open={smartOpen} onOpenChange={setSmartOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Smart Suggest</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Smart generate a grocery list based on your inventory, nutrition goals, and cooking devices.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-normal text-muted-foreground">Days to plan</Label>
                <div className="mt-1">
                  <NumericStepper value={days} onChange={setDays} min={1} max={30} step={1} />
                </div>
              </div>
              <div>
                <Label className="text-xs font-normal text-muted-foreground">People (pax)</Label>
                <div className="mt-1">
                  <NumericStepper value={pax} onChange={setPax} min={1} max={10} step={1} />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs font-normal text-muted-foreground">Requirements / Occasions (optional)</Label>
              <Input
                value={requirements}
                onChange={e => setRequirements(e.target.value)}
                placeholder='e.g. "Barbecue for 5 friends" or "Birthday party"'
                className="mt-1 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setSmartOpen(false)}>Cancel</Button>
              <Button onClick={handleSmartSuggest} className="flex-1 bg-copper-gradient text-primary-foreground">
                <Sparkles className="h-4 w-4 mr-2" />Suggest
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Add Item Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>Add Grocery Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-normal">Item Name</Label>
              <Input value={addName} onChange={e => setAddName(e.target.value)} placeholder="e.g. Red Bell Peppers" className="mt-1"
                     onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            </div>
            <div>
              <Label className="text-sm font-normal">Quantity</Label>
              <Input value={addQty} onChange={e => setAddQty(e.target.value)} type="text" className="mt-1" placeholder="e.g. 2" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} className="flex-1 bg-copper-gradient text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" />Add to List
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ProUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} featureName="Smart Suggest" />
    </AppLayout>
  );
}
