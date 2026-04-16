import { useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function PaymentComplete() {
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get('proposal');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
          <h1 className="text-2xl font-semibold">Payment Received!</h1>
          <p className="text-muted-foreground">
            Thank you for your payment. Your contractor will be in touch shortly.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            A confirmation email has been sent to your inbox.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
