import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import EZBidLogo from '@/components/EZBidLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  UserCircle, FileText, Sparkles, Eye, Send, PenLine, ArrowRight,
  CheckCircle, Building2, ClipboardList, Mail, Download
} from 'lucide-react';

const steps = [
  {
    number: 1,
    icon: UserCircle,
    title: "Create your account",
    description: "Sign up with your email — it's free and takes about 30 seconds. No credit card needed.",
    tip: "Use the same email you use for your business so clients recognize you.",
  },
  {
    number: 2,
    icon: Building2,
    title: "Fill in your company profile",
    description: "Add your company name, phone number, logo, license numbers, and insurance info. This is what shows up at the top of every proposal you send out.",
    tip: "The more complete your profile is, the more professional your proposals will look.",
  },
  {
    number: 3,
    icon: ClipboardList,
    title: "Start a new proposal",
    description: "Click \"New Proposal\" from the dashboard. Pick a template that fits your style — there are several clean, professional designs to choose from.",
    tip: "You can always change the template later before you send it.",
  },
  {
    number: 4,
    icon: FileText,
    title: "Enter the job details",
    description: "Fill in your client's name and contact info, the job site address, what work you're doing, and your pricing. Add line items for labor, materials, or anything else you need to quote.",
    tip: "Don't worry about perfect wording — the next step takes care of that.",
  },
  {
    number: 5,
    icon: Sparkles,
    title: "Let AI polish your proposal",
    description: "Hit the \"Enhance\" button and the AI will clean up your job description and scope of work. It makes everything sound professional without changing your numbers or what you quoted.",
    tip: "You can always edit the AI text or undo it if you prefer your original wording.",
  },
  {
    number: 6,
    icon: Eye,
    title: "Preview your proposal",
    description: "See exactly what your client will see — a clean, branded document with your logo, all the job details, pricing breakdown, and terms. Review it and make any final changes.",
    tip: "Check the total, the deposit amount, and the payment terms before sending.",
  },
  {
    number: 7,
    icon: Send,
    title: "Send it to your client",
    description: "Enter your client's email and hit send. They'll get a professional email with a link to view and sign the proposal — no app download needed on their end.",
    tip: "You can also download a PDF to print or send through text message.",
  },
  {
    number: 8,
    icon: PenLine,
    title: "Client signs electronically",
    description: "Your client opens the link, reviews the proposal, and draws their signature right on their phone or computer. You'll see the status change to \"Signed\" on your dashboard.",
    tip: "If they haven't signed yet, you can follow up — the link stays active.",
  },
];

const faqs = [
  { q: "Do I need to be good with computers?", a: "Not at all. If you can send a text message, you can use EZ-Bid. It's designed to be as simple as possible." },
  { q: "What if I make a mistake?", a: "You can edit any proposal before you send it. Even after sending, you can create a new version if something needs to change." },
  { q: "Can my client sign on their phone?", a: "Yes. The signing page works on any phone, tablet, or computer. They don't need to download anything." },
  { q: "How many proposals can I send for free?", a: "You get 3 free proposals to try it out. After that, Pro plans start at $39/month or $399/year." },
  { q: "Can I add my logo?", a: "Yes. Upload your logo in your Company Profile and it'll appear on every proposal automatically." },
  { q: "What if I need help?", a: "Use the chat bubble in the bottom corner of the app — we're here to help." },
];

export default function Tutorial() {
  const { user } = useAuth();

  const content = (
    <div className="container max-w-3xl py-10 space-y-10 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">How to Use EZ-Bid</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          A simple, step-by-step guide to creating and sending your first professional proposal. No tech skills needed.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-6">
        {steps.map((step) => (
          <Card key={step.number}>
            <CardContent className="p-6">
              <div className="flex gap-5">
                <div className="shrink-0 flex flex-col items-center">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-foreground text-background text-sm font-bold">
                    {step.number}
                  </div>
                  {step.number < steps.length && (
                    <div className="w-px flex-1 bg-border mt-2" />
                  )}
                </div>
                <div className="space-y-2 pb-2">
                  <div className="flex items-center gap-2">
                    <step.icon className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">{step.title}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  <div className="flex items-start gap-2 bg-muted/50 rounded-md p-3">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground"><strong>Tip:</strong> {step.tip}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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

  // If logged in, wrap in AppLayout; otherwise show with simple header
  if (user) {
    return <AppLayout>{content}</AppLayout>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
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
