import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CheckCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GuestSignupWall({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Your proposal is ready</DialogTitle>
          <DialogDescription className="text-base mt-2">
            Create a free account to download and send it to your client. Takes 30 seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="space-y-2">
            {['Download as PDF', 'Email directly to your client', 'Edit and revise anytime', 'Create unlimited proposals'].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-foreground shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 space-y-3">
            <Link to="/auth?signup=1&from=guest" className="block">
              <Button className="w-full h-12 text-base font-semibold">
                Create Free Account
              </Button>
            </Link>
            <Link to="/auth?from=guest" className="block text-center">
              <span className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
                Already have an account? Log in
              </span>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
