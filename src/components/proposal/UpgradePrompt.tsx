import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, ArrowRight } from 'lucide-react';

interface Props {
  proposalsUsed: number;
  onContinue: () => void;
}

export default function UpgradePrompt({ proposalsUsed, onContinue }: Props) {
  return (
    <div className="container max-w-md py-16 animate-fade-in">
      <Card>
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">You've used all 3 free proposals</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Upgrade to unlimited proposals for $29/month. Cancel anytime.
          </p>
          <div className="space-y-3">
            <Button className="w-full gap-2">
              Upgrade to Pro <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onContinue}>
              Maybe later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
