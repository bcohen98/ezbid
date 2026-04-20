import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import EZBidLogo from '@/components/EZBidLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import HowItWorks from '@/components/HowItWorks';
import { ArrowRight } from 'lucide-react';

const faqs = [
  { q: 'Do I need to be good with computers?', a: "Not at all. If you can send a text message, you can use EZ-Bid. It's designed to be as simple as possible." },
  { q: 'What if I make a mistake?', a: 'You can edit any proposal before you send it. Even after sending, you can create a new version if something needs to change.' },
  { q: 'Can my client sign on their phone?', a: "Yes. The signing page works on any phone, tablet, or computer. They don't need to download anything." },
  { q: 'How many proposals can I send for free?', a: 'You get 3 free proposals to try it out. After that, Pro is $29/month or $290/year (2 months free).' },
  { q: 'Can I add my logo?', a: "Yes. Upload your logo in your Company Profile and it'll appear on every proposal automatically." },
  { q: 'What if I need help?', a: "Use the chat bubble in the bottom corner of the app — we're here to help." },
];

export default function Tutorial() {
  const { user } = useAuth();

  const content = (
    <div className="container max-w-3xl px-4 py-10 space-y-10 animate-fade-in">
      <HowItWorks variant="full" />

      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center">Common Questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((faq, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <p className="text-sm font-semibold mb-1">{faq.q}</p>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center space-y-3 pb-6">
        <h2 className="text-xl font-semibold">Ready to send your first proposal?</h2>
        <Link to={user ? '/proposals/new' : '/auth'}>
          <Button size="lg" className="gap-2 text-base px-8">
            {user ? 'Create a Proposal' : 'Get Started Free'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );

  if (user) {
    return <AppLayout>{content}</AppLayout>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link to="/"><EZBidLogo size="md" /></Link>
          <div className="flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm">Get started free</Button></Link>
          </div>
        </div>
      </header>
      {content}
    </div>
  );
}
