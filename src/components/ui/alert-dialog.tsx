import React from 'react';
import { Dialog, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';

export interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay />
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
}

export function AlertDialogTrigger({ children }: { children: React.ReactNode }) {
  return <Dialog open>{children}</Dialog>;
}

export function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof DialogContent>) {
  return <DialogContent className={className} {...props} />;
}

export function AlertDialogHeader({ className, ...props }: React.ComponentProps<typeof DialogHeader>) {
  return <DialogHeader className={className} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle className={className} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof DialogDescription>) {
  return <DialogDescription className={className} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: React.ComponentProps<typeof DialogFooter>) {
  return <DialogFooter className={className} {...props} />;
}

export function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof DialogClose>) {
  return <DialogClose className={className} {...props} />;
}

export function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof DialogClose>) {
  return <DialogClose className={className} {...props} />;
}
