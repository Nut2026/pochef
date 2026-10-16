import { Check, Crown, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PRO_HIGHLIGHTS = [
  'Unlimited inventory & fermentation batches',
  'Smart Generate Recipes (AI-powered)',
  'Advanced Nutrition & Macro Tracking',
  'Batch Meal Planning (up to 7 days)',
  'Smart Grocery Suggest',
  'PDF exports — watermark-free',
];

interface ProUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  featureName?: string;
}

export function ProUpgradeModal({ open, onClose, featureName }: ProUpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-balance">
            <Crown className="h-5 w-5 text-primary shrink-0" />
            {featureName ? `${featureName} is a Pro Feature` : 'Upgrade to Pochef Pro'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground text-pretty">
            {featureName
              ? `${featureName} is available on Pochef Pro. Upgrade to unlock this and all other Pro features.`
              : 'Unlock the full power of your digital kitchen twin with Pochef Pro.'}
          </p>

          <div className="glass rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What you get with Pro</p>
            {PRO_HIGHLIGHTS.map(h => (
              <div key={h} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{h}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center space-y-0.5">
            <p className="font-bold text-lg">$4.99<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
            <p className="text-xs text-success font-medium">or $39.99/yr — Save 33%</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Not now
            </Button>
            <Button asChild className="flex-1 bg-copper-gradient text-primary-foreground" onClick={onClose}>
              <Link to="/pricing">
                <Zap className="h-4 w-4 mr-2" />View Plans
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
