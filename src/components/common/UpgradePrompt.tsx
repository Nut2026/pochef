import { Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UpgradePromptProps {
  message: string;
  className?: string;
  compact?: boolean;
}

export function UpgradePrompt({ message, className, compact }: UpgradePromptProps) {
  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-warning', className)}>
        <Crown className="h-3 w-3 shrink-0" />
        {message}{' '}
        <Link to="/pricing" className="underline hover:no-underline font-medium">Upgrade</Link>
      </span>
    );
  }
  return (
    <div className={cn('glass rounded-xl p-6 text-center border border-warning/30 bg-warning/5', className)}>
      <Crown className="h-10 w-10 mx-auto text-warning mb-3" />
      <p className="font-semibold text-balance">{message}</p>
      <p className="text-sm text-muted-foreground mt-1">Upgrade to Pro for unlimited access.</p>
      <Button asChild className="mt-4 bg-copper-gradient text-primary-foreground">
        <Link to="/pricing">View Plans</Link>
      </Button>
    </div>
  );
}
