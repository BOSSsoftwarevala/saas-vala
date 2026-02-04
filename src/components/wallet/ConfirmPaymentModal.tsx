import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ShieldAlert } from 'lucide-react';

interface ConfirmPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  amount: number;
}

export function ConfirmPaymentModal({ 
  open, 
  onOpenChange, 
  onConfirm, 
  amount 
}: ConfirmPaymentModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white dark:bg-slate-50 border-sky-200 max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-sky-600" />
            </div>
            <AlertDialogTitle className="font-display text-slate-800 uppercase tracking-wide">
              Please Confirm
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-slate-700 text-sm leading-relaxed">
            You are purchasing a digital product worth{' '}
            <span className="font-semibold text-slate-800">₹{amount.toLocaleString()}</span>.
            <br /><br />
            <span className="font-medium text-slate-800">
              Refunds are not applicable after delivery.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="border-slate-300 text-slate-700 hover:bg-slate-100">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
          >
            Confirm & Pay
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
