import { ChevronDown, ChevronUp } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

interface NumericStepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  allowDecimal?: boolean;
  className?: string;
}

export function NumericStepper({
  value, onChange, min = 1, max = 24, step = 1, allowDecimal = false, className,
}: NumericStepperProps) {
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef    = React.useRef(value);
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
    const raw = allowDecimal ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
    if (!Number.isNaN(raw)) onChange(clamp(raw));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  return (
    <div className={cn('flex items-center border border-border rounded-md overflow-hidden h-9 w-fit', className)}>
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
