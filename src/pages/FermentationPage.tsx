import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  getFermentationBatches, createFermentationBatch, updateFermentationBatch,
  deleteFermentationBatch,
} from '@/lib/api';
import { FERMENTATION_DAYS } from '@/lib/shelfLife';
import type { FermentationBatch, FermentationType } from '@/types/types';
import {
  Plus, Leaf, ChevronRight, Check, RefreshCw,
  Calendar, FlaskConical, X,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
// Labels
// ──────────────────────────────────────────────────────────────────────────────
const FERMENTATION_LABELS: Record<FermentationType, string> = {
  pickles:             'Pickles',
  yoghurt:             'Yoghurt',
  kefir_milk:          'Kefir (Milk)',
  kefir_water:         'Kefir (Water)',
  kombucha_primary:    'Kombucha (Primary Fermentation)',
  kombucha_secondary:  'Kombucha (Secondary Fermentation)',
  natto:               'Natto',
  sauerkraut:          'Sauerkraut',
  kimchi:              'Kimchi',
  sourdough_starter:   'Sourdough Starter',
};

// ──────────────────────────────────────────────────────────────────────────────
// Hardcoded fermentation stages (no AI calls)
// ──────────────────────────────────────────────────────────────────────────────
type Stage = { day_number: number; action_prompt: string };

const FERMENTATION_STAGES_DB: Record<FermentationType, Stage[]> = {
  pickles: [
    { day_number: 1, action_prompt: 'Create a brine solution with 5% salt concentration, pack sliced cucumbers into clean jars, and cover them with the brine solution, leaving 1-2 cm headspace. Ensure all equipment and hands are sanitized to prevent contamination.' },
    { day_number: 2, action_prompt: 'Check the jars for any signs of fermentation, such as bubbles or a slightly sour smell, and verify that the cucumbers are fully submerged in the brine solution. If necessary, add more brine to maintain the headspace.' },
    { day_number: 3, action_prompt: 'Monitor the fermentation process, looking for increased bubble formation and a more pronounced sour smell, and check the jars for any signs of contamination, such as mold or sliminess. Discard any jars showing signs of contamination.' },
    { day_number: 4, action_prompt: 'Perform a mid-point check by gently burping the jars to release any built-up carbon dioxide, and taste the pickles to assess their sourness and crunchiness. If the pickles are too salty, consider diluting the brine solution with a small amount of water.' },
    { day_number: 5, action_prompt: 'Continue to monitor the fermentation process, checking for the desired level of sourness and crunchiness, and verify that the pickles are still fully submerged in the brine solution. If necessary, add more brine to maintain the headspace.' },
    { day_number: 6, action_prompt: 'Check the pickles for any signs of over-fermentation, such as a strong, unpleasant odor or a soft, mushy texture, and consider transferring the jars to the refrigerator to slow down the fermentation process if necessary. Discard any jars showing signs of over-fermentation.' },
    { day_number: 7, action_prompt: 'Perform a final readiness check by tasting the pickles and assessing their texture, and once satisfied, store the jars in the refrigerator to halt the fermentation process. Always check the pickles for any signs of spoilage before consumption, such as mold, sliminess, or an off smell.' },
  ],
  yoghurt: [
    { day_number: 1, action_prompt: 'Heat 1 liter of milk to 180°F (82°C) to denature the proteins, then cool it down to 110°F (43°C). Whisk in 2 tablespoons of plain yoghurt with live active cultures. Pour the mixture into clean jars, seal them, and place them in a warm environment (e.g., an oven with the light on) for 6–12 hours. Ensure all utensils are sanitized to prevent unwanted bacterial growth. Do not disturb the jars during this period.' },
  ],
  kefir_milk: [
    { day_number: 1, action_prompt: 'Add 1 tablespoon of milk kefir grains to 2 cups of fresh milk in a clean glass jar. Cover the jar with a breathable cloth or coffee filter secured with a rubber band to allow airflow while keeping contaminants out. Place the jar in a dark, room-temperature area (68–78°F) and let it ferment for 24 hours.' },
    { day_number: 2, action_prompt: 'Check the kefir for signs of fermentation, such as a thickened texture, a tangy aroma, and visible separation into curds and whey. Gently shake the jar and strain out the kefir grains using a plastic or nylon sieve (avoid metal). Transfer the finished kefir to a sealed jar and refrigerate. Store the recovered grains in fresh milk to start a new batch.' },
  ],
  kefir_water: [
    { day_number: 1, action_prompt: 'Dissolve ½ cup of sugar in 4 cups of non-chlorinated water. Add ¼ cup of water kefir grains and a pinch of sea salt or a dried fig for mineral content. Pour the mixture into a clean glass jar, cover with a breathable cloth, and secure with a rubber band. Place it in a warm, dark spot (70–80°F) for the first fermentation.' },
    { day_number: 2, action_prompt: 'Check for signs of active fermentation, such as small bubbles rising and a faint yeasty, sweet smell. Gently swirl the jar to agitate the grains and ensure they are suspended in the sugar water. Do not remove the cloth covering. Verify that the liquid remains clear with no visible mold on the surface; discard if contamination is suspected.' },
    { day_number: 3, action_prompt: 'Assess the fizziness and taste the water kefir—it should be lightly effervescent and tangy, not overly sweet. Strain out the grains using a plastic or nylon strainer (avoid metal). Bottle the liquid in airtight flip-top bottles, leaving 1 inch of headspace, and refrigerate to halt fermentation. Use the harvested grains immediately for a new batch.' },
  ],
  kombucha_primary: [
    { day_number: 1, action_prompt: 'Brew 1 gallon of strong black or green tea, dissolve 1 cup of sugar into it while hot, then cool to room temperature. Pour the sweet tea into a large glass brewing vessel, add your SCOBY along with 1–2 cups of starter liquid from a previous batch. Cover with a breathable cloth and secure it. Place in a warm, dark location (75–80°F) and leave undisturbed.' },
    { day_number: 7, action_prompt: 'Observe the formation of a new translucent pellicle (SCOBY layer) on the surface. Check for signs of fermentation, such as a vinegar-like aroma and the appearance of bubbles. Ensure the cloth cover remains clean and dry. If any fuzzy mold (green, black, or blue) appears on the surface, discard the entire batch immediately.' },
    { day_number: 10, action_prompt: 'Taste the kombucha every 2–3 days by carefully dripping a small amount through a straw. Monitor for the desired balance between sweet and tart. Continue to watch for a steady stream of bubbles and a deepening sourness. Top up with sterile water if evaporation lowers the liquid level significantly.' },
    { day_number: 14, action_prompt: 'Perform a final taste test to confirm the brew has reached your preferred tanginess—it should not taste like straight sweet tea. Reserve 2 cups of the finished liquid as starter for your next batch. Carefully remove the SCOBY and pellicle. Proceed to bottle the remaining liquid for secondary fermentation or refrigerate for a still, tart kombucha.' },
  ],
  kombucha_secondary: [
    { day_number: 1, action_prompt: 'After primary fermentation, bottle the kombucha into airtight flip-top or screw-top bottles, adding 1–2 teaspoons of sugar, fruit juice, or chopped fruit per bottle for carbonation. Leave 1–2 inches of headspace. Seal the bottles tightly and store them at room temperature (70–75°F) away from direct sunlight.' },
    { day_number: 2, action_prompt: 'Check the bottles for the first signs of carbonation—the bottles should feel slightly firm when gently squeezed (if using plastic) or you may see small bubbles rising. Do not open the bottles yet; let the pressure build.' },
    { day_number: 3, action_prompt: 'Assess the fizziness by gently squeezing a plastic bottle if available. If using glass, carefully "burp" one bottle by slowly opening the cap to release a small amount of pressure, then reseal immediately. Taste a small sample to gauge the flavor development. If carbonation is weak, allow more time.' },
    { day_number: 4, action_prompt: 'Continue to monitor pressure buildup. The bottles should feel noticeably harder to the touch. If you used fruit, check for floating particles that could create nucleation points for excessive fizz. Keep bottles at room temperature; do not refrigerate yet unless carbonation is already at its peak.' },
    { day_number: 5, action_prompt: 'Perform a final carbonation check by carefully opening one test bottle—there should be a satisfying pop and visible effervescence. Taste for flavor and fizz. Once satisfied, immediately transfer all bottles to the refrigerator to stop fermentation and prevent over-carbonation or explosions. Always chill before opening to minimize foaming.' },
  ],
  natto: [
    { day_number: 1, action_prompt: 'Rinse 1 cup of soybeans and soak them in water for 12–18 hours until fully rehydrated. Steam or pressure-cook the beans until they are soft enough to easily crush between your fingers. In a sterile bowl, mix the warm beans with ⅛ teaspoon of natto starter powder (Bacillus subtilis) dissolved in a small amount of sterile water. Transfer the mixture to a shallow, clean container, cover with a lid with air holes, and place in a warm, humid environment (100–110°F) for 24 hours.' },
    { day_number: 2, action_prompt: 'Check for successful fermentation by looking for a whitish, stringy coating on the beans and a distinct earthy, nutty, or ammonia-like aroma. Gently stir the beans with a fork—they should develop long, sticky, gooey threads. If there is no stickiness or if an unpleasant rotten odor appears, discard the batch. Once confirmed, refrigerate the natto in a sealed container for at least 4–6 hours to mature the flavor before consuming.' },
  ],
  sauerkraut: [
    { day_number: 1, action_prompt: 'Finely shred 5 lbs of fresh cabbage and mix it with 3 tablespoons of non-iodized salt in a large bowl. Massage the cabbage vigorously for 8–10 minutes until it releases enough brine to cover itself. Pack the cabbage tightly into a clean fermentation crock or large jar, pressing down firmly to eliminate air pockets. Ensure the brine completely covers the cabbage by at least 1 inch. Place a weight on top to keep it submerged, cover loosely with a lid or cloth, and set it in a cool, dark place (65–70°F).' },
    { day_number: 3, action_prompt: 'Check daily to ensure the cabbage remains fully submerged under the brine. Push down the weight if needed. You should notice bubbles forming and a sour, tangy smell developing around day 3. Skim off any white foam or scum that may appear on the surface—this is normal, but mold is not. If any pink or fuzzy mold appears, remove it immediately along with the top layer of cabbage.' },
    { day_number: 10, action_prompt: 'Continue to monitor weekly. The brine may become cloudy, which is a sign of active fermentation. Taste a small sample every few days—it will progress from salty to mildly sour. Check the weight periodically and add a 2% salt brine (1 teaspoon salt per cup of water) if the liquid level drops below the cabbage.' },
    { day_number: 15, action_prompt: 'The kraut should now be distinctly sour and tangy. Bubbling will slow down significantly. Continue to check for proper submersion and skim any surface scum. Taste every 2–3 days to track the deepening flavor. If the room temperature rises above 70°F, consider moving it to a cooler spot to avoid softening the cabbage.' },
    { day_number: 21, action_prompt: 'Perform a final readiness check by tasting the sauerkraut—it should be pleasantly sour, crunchy, and full-flavored. Once satisfied, pack the kraut tightly into smaller jars, cover completely with brine, seal with airtight lids, and transfer to the refrigerator. Always check for off-smells, sliminess, or unusual colors before serving; discard if any are present.' },
  ],
  kimchi: [
    { day_number: 1, action_prompt: 'Cut 1 large Napa cabbage into bite-sized pieces and salt it thoroughly with ½ cup of coarse salt, massaging it into the leaves. Let it sit for 2–4 hours, turning occasionally, until the cabbage wilts and releases excess water. Rinse the cabbage 2–3 times under cold water to remove excess salt, then drain well. Prepare the paste by blending garlic, ginger, fish sauce, Korean chili flakes (gochugaru), and a little sugar. Mix the paste with the cabbage along with sliced radish, scallions, and carrot. Pack the mixture tightly into a clean glass jar, pressing down to remove air bubbles, and leave 1–2 inches of headspace.' },
    { day_number: 2, action_prompt: 'Check the kimchi for early fermentation signs—small bubbles should appear, and the liquid level may rise. Press down with a clean spoon to keep the vegetables submerged in their own brine. The jar will start to emit a pungent, garlicky, and slightly sour aroma. Keep the jar loosely covered or use a fermentation lid at room temperature.' },
    { day_number: 3, action_prompt: 'Monitor vigorously; the kimchi will become very active with frequent bubbling. Open the jar gently to "burp" it daily to release built-up carbon dioxide, or use an airlock. Taste a small piece—it should be spicy, salty, and just beginning to sour. If the top layer looks dry, press it down again.' },
    { day_number: 4, action_prompt: 'Continue to burp the jar once or twice daily. The sourness will become more pronounced, and the texture of the cabbage should still be crisp. Check for any surface mold—if present, discard the top layer and ensure the rest is fully submerged in brine. The refrigerator is not yet needed unless the room is very warm (above 75°F).' },
    { day_number: 5, action_prompt: 'Perform a mid-point taste test. The kimchi should now have a balanced sour-spicy profile. Bubbling may slow slightly. If it tastes too salty or raw, allow more time. If it tastes perfectly tangy, you may move it to the refrigerator now, but for a deeper flavor, continue at room temperature.' },
    { day_number: 6, action_prompt: 'Check for desired fermentation level. The kimchi should be effervescent, with a rich, complex tang and a slight fizz on the tongue. Press down any floating pieces. The aroma will be strong and characteristic. If the room is cool, fermentation may be milder; consider leaving it one more day.' },
    { day_number: 7, action_prompt: 'Perform a final readiness check by tasting a generous piece—the kimchi should be deeply sour, spicy, and umami-rich with a crunchy yet tender texture. Once satisfied, seal the jar tightly and transfer it to the refrigerator to slow fermentation. Always inspect for off-colors, sliminess, or an ammonia-like smell before eating, and discard if any are present.' },
  ],
  sourdough_starter: [
    { day_number: 1, action_prompt: 'In a clean glass jar, mix 100 grams of whole wheat or rye flour with 100 grams of lukewarm filtered water. Stir vigorously to incorporate air. Cover loosely with a lid or cloth and leave at room temperature (70–75°F) for 24 hours. No activity is expected yet—this is the initial hydration phase.' },
    { day_number: 2, action_prompt: 'Discard half of the mixture (about 100g) and add 100 grams of fresh flour and 100 grams of lukewarm water. Stir well and cover loosely. Check for the first signs of bacterial activity—a few tiny bubbles may appear, and the mixture may have a slightly sharp smell. Continue to leave at room temperature.' },
    { day_number: 3, action_prompt: 'Discard all but 100g of the starter and repeat the feeding with 100g flour and 100g water. You should now see more distinct bubbles across the surface and sides of the jar. The aroma may shift from pungent to slightly fruity or yeasty. If the surface dries out, cover more tightly.' },
    { day_number: 4, action_prompt: 'Perform the same discard-and-feed routine. The starter should double in volume within 4–8 hours of feeding if active. Look for a spongy, airy texture and a pleasant sour-milk smell. If there is no rise, continue feeding as scheduled; this is normal for slow-starting flours. Keep the jar in a warm spot, like near a turned-off oven with the light on.' },
    { day_number: 5, action_prompt: 'Feed as before. The starter should now rise predictably after each feeding, showing a domed top and a web of gluten strands when pulled with a spoon. Perform the "float test" by dropping a small amount into water—if it floats, it is ready. If not, continue feeding. Check for any pink, orange, or fuzzy mold and discard if present.' },
    { day_number: 6, action_prompt: 'Continue the feedings. The starter should become very active, with a strong, tangy, yeasty aroma and a resilient, stretchy consistency. It should double or even triple in volume within 6 hours of feeding. If it consistently rises and falls, your culture is strong and stable.' },
    { day_number: 7, action_prompt: 'Perform the final readiness test by feeding the starter and watching it double in 4–6 hours. It should have a complex sourdough smell, a bubbly, aerated crumb, and pass the float test easily. Once confirmed, the starter is ready to use for baking. Store it in the refrigerator in a sealed jar, and thereafter feed it weekly. Always check for any off-smells or discoloration before each use; discard and restart if contamination is suspected.' },
  ],
};

// ──────────────────────────────────────────────────────────────────────────────
// New Batch Dialog (no ambient temp, no AI)
// ──────────────────────────────────────────────────────────────────────────────
function NewBatchDialog({ onCreated, onClose }: { onCreated: (batch: FermentationBatch) => void; onClose: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<FermentationType>('pickles');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!user || !name.trim()) { toast.error('Please enter a batch name'); return; }
    setLoading(true);
    try {
      const totalDays = FERMENTATION_DAYS[type] ?? 7;
      const batch = await createFermentationBatch(user.id, {
        name: name.trim(),
        fermentation_type: type,
        total_days: totalDays,
        ambient_temp_celsius: 22,
        current_day: 1,
      });
      if (typeof pendo !== 'undefined') {
        pendo.track('fermentation_batch_created', {
          batch_name: name.trim(),
          fermentation_type: type,
          total_days: totalDays,
        });
      }
      toast.success(`${name} batch started! 🧫`);
      onCreated(batch);
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-normal">Batch Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Pickles" className="mt-1"
               onKeyDown={e => e.key === 'Enter' && handleCreate()} />
      </div>
      <div>
        <Label className="text-sm font-normal">Fermentation Type</Label>
        <Select value={type} onValueChange={v => setType(v as FermentationType)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(FERMENTATION_LABELS) as FermentationType[]).map(k => (
              <SelectItem key={k} value={k}>{FERMENTATION_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Estimated duration: <strong>{FERMENTATION_DAYS[type] ?? 7} days</strong>
      </p>
      <Button onClick={handleCreate} disabled={loading} className="w-full bg-copper-gradient text-primary-foreground">
        {loading ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Creating…</> : <><Leaf className="h-4 w-4 mr-2" />Start Batch</>}
      </Button>
      <Button variant="outline" onClick={onClose} className="w-full">Cancel</Button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Batch Card
// ──────────────────────────────────────────────────────────────────────────────
function BatchCard({
  batch,
  onUpdate,
  onRemove,
}: {
  batch: FermentationBatch;
  onUpdate: (updated: FermentationBatch) => void;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const progress = Math.min(100, Math.round((batch.current_day / batch.total_days) * 100));
  const stages = FERMENTATION_STAGES_DB[batch.fermentation_type] ?? [];

  const handleAdvanceDay = async () => {
    const next = Math.min(batch.current_day + 1, batch.total_days);
    const isComplete = next >= batch.total_days;
    try {
      await updateFermentationBatch(batch.id, { current_day: next, is_complete: isComplete });
      onUpdate({ ...batch, current_day: next, is_complete: isComplete });
      if (typeof pendo !== 'undefined') {
        pendo.track('fermentation_day_advanced', {
          batch_name: batch.name,
          fermentation_type: batch.fermentation_type,
          current_day: next,
          total_days: batch.total_days,
          is_complete: isComplete,
        });
        if (isComplete) {
          pendo.track('fermentation_batch_completed', {
            batch_name: batch.name,
            fermentation_type: batch.fermentation_type,
            total_days: batch.total_days,
            completion_method: 'day_advance',
          });
        }
      }
      toast.success(isComplete ? `${batch.name} batch complete! 🎉` : `Day ${next} logged`);
    } catch { toast.error('Update failed'); }
  };

  const handleRemove = async () => {
    const snapshot = { ...batch };
    onRemove(batch.id);
    toast('Batch removed', {
      action: {
        label: 'Undo',
        onClick: () => {
          // Re-insert optimistically — parent re-adds it
          onUpdate(snapshot);
        },
      },
      onDismiss: () => deleteFermentationBatch(batch.id).catch(() => {}),
      onAutoClose: () => deleteFermentationBatch(batch.id).catch(() => {}),
      duration: 4000,
    });
  };

  return (
    <Card className="glass border-0 shadow-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold truncate">{batch.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{FERMENTATION_LABELS[batch.fermentation_type]}</p>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">Day {batch.current_day}/{batch.total_days}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 flex flex-col">
        <Progress value={progress} className="h-1.5" />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />{batch.start_date}
        </span>

        <div className="flex gap-2 mt-auto flex-wrap">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setExpanded(e => !e)}>
            <FlaskConical className="h-3 w-3 mr-1" />{expanded ? 'Hide Stages' : 'Stages'}
          </Button>
          {batch.current_day < batch.total_days && (
            <Button size="sm" className="flex-1 bg-copper-gradient text-primary-foreground" onClick={handleAdvanceDay}>
              <ChevronRight className="h-3 w-3 mr-1" />Day {batch.current_day + 1}
            </Button>
          )}
          {batch.current_day >= batch.total_days && !batch.is_complete && (
            <Button size="sm" className="flex-1 bg-success/90 text-white"
              onClick={async () => {
                await updateFermentationBatch(batch.id, { is_complete: true });
                onUpdate({ ...batch, is_complete: true });
                if (typeof pendo !== 'undefined') {
                  pendo.track('fermentation_batch_completed', {
                    batch_name: batch.name,
                    fermentation_type: batch.fermentation_type,
                    total_days: batch.total_days,
                    completion_method: 'manual_complete',
                  });
                }
              }}>
              <Check className="h-3 w-3 mr-1" />Complete
            </Button>
          )}
          {!expanded && (
            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 shrink-0" onClick={handleRemove}>
              <X className="h-3.5 w-3.5 mr-1" />Remove
            </Button>
          )}
        </div>

        {expanded && stages.length > 0 && (
          <div className="space-y-2 pt-1">
            <Separator />
            {stages.map(stage => {
              const isPast    = stage.day_number < batch.current_day;
              const isCurrent = stage.day_number === batch.current_day;
              return (
                <div
                  key={stage.day_number}
                  className={`flex items-start gap-2 text-xs rounded-lg p-2 transition-colors ${
                    isPast ? 'bg-muted/40 opacity-60' : isCurrent ? 'bg-primary/10' : 'bg-muted/30'
                  }`}
                >
                  {/* Day checkbox visual */}
                  <div className={`mt-0.5 shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                    isPast    ? 'border-muted-foreground bg-muted-foreground/20' :
                    isCurrent ? 'border-primary bg-primary' :
                                'border-border'
                  }`}>
                    {isPast && (
                      // Crossed out — two diagonal lines
                      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="1" y1="1" x2="9" y2="9" />
                        <line x1="9" y1="1" x2="1" y2="9" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className={`font-medium ${isPast ? 'line-through text-muted-foreground' : ''}`}>Day {stage.day_number}: </span>
                    <span className={isPast ? 'line-through text-muted-foreground' : 'text-muted-foreground'}>{stage.action_prompt}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────
export default function FermentationPage() {
  const { user } = useAuth();
  const plan = usePlan();
  const [searchParams] = useSearchParams();
  const [batches, setBatches] = useState<FermentationBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBatchOpen, setNewBatchOpen] = useState(false);

  const loadBatches = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const bs = await getFermentationBatches(user.id);
      setBatches(bs);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { if (searchParams.get('new') === 'true') setNewBatchOpen(true); }, [searchParams]);

  // Optimistic handlers — no full reload
  const handleBatchCreated = (batch: FermentationBatch) => {
    setBatches(prev => [batch, ...prev]);
  };

  const handleBatchUpdated = (updated: FermentationBatch) => {
    setBatches(prev => {
      const idx = prev.findIndex(b => b.id === updated.id);
      if (idx === -1) return [updated, ...prev]; // undo-restore
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  };

  const handleBatchRemoved = (id: string) => {
    setBatches(prev => prev.filter(b => b.id !== id));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold gradient-text text-balance">Fermentation</h1>
            <p className="text-sm text-muted-foreground">Track your active fermentation batches</p>
          </div>
          <Button
            onClick={() => {
              const activeBatches = batches.filter(b => !b.is_complete).length;
              if (!plan.isPro && activeBatches >= plan.maxFermentation) {
                toast.error(`Free plan allows up to ${plan.maxFermentation} active batches. Upgrade to Pro for unlimited.`);
                return;
              }
              setNewBatchOpen(true);
            }}
            className="bg-copper-gradient text-primary-foreground shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />New Batch
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-xl bg-muted animate-shimmer" />)}
          </div>
        ) : batches.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <FlaskConical className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="font-semibold text-muted-foreground">No active batches</p>
            <p className="text-sm text-muted-foreground mt-1">Start a fermentation batch to track its progress</p>
            <Button onClick={() => setNewBatchOpen(true)} className="mt-4 bg-copper-gradient text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />Start First Batch
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {batches.map(batch => (
              <BatchCard
                key={batch.id}
                batch={batch}
                onUpdate={handleBatchUpdated}
                onRemove={handleBatchRemoved}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={newBatchOpen} onOpenChange={setNewBatchOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>Start New Fermentation Batch</DialogTitle></DialogHeader>
          <NewBatchDialog onCreated={handleBatchCreated} onClose={() => setNewBatchOpen(false)} />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
