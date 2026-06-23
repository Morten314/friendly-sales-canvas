import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Destructive confirm for disconnecting Apollo. Only credentials are removed; leads are preserved
 * (spec 40 §5.3). No credit-spend sentence (declined, §9). */
export function DisconnectApolloDialog({ open, isPending = false, onConfirm, onCancel }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Apollo?</AlertDialogTitle>
          <AlertDialogDescription>
            Existing Apollo-sourced leads will remain in your pool, but discovery will be
            unavailable until you reconnect.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? "Disconnecting…" : "Disconnect"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
