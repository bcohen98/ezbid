import { UserCircle, FileText, DollarSign, Sparkles, Send } from 'lucide-react';

export const HOW_IT_WORKS_TITLE = 'How EZ-Bid Works';
export const HOW_IT_WORKS_SUBTITLE =
  'Describe the job. Get a professional proposal with live pricing in under 2 minutes.';

export const HOW_IT_WORKS_STEPS = [
  {
    number: 1,
    icon: UserCircle,
    title: 'Set Up Once, Use Forever',
    description:
      'Add your company name, logo, license number, and contact info to your profile. It appears on every proposal automatically. Takes 2 minutes.',
  },
  {
    number: 2,
    icon: FileText,
    title: 'Describe the Job',
    description:
      "Click New Proposal, pick your trade, and describe the job in plain English — just like you'd explain it on the phone. Add the client name, address, and zip code.",
  },
  {
    number: 3,
    icon: DollarSign,
    title: 'Live Pricing Builds Your Quote',
    description:
      "Material prices are pulled live from Home Depot for your job's zip code. Labor rates are estimated using real contractor market rates for your trade and region. A fully itemized quote is generated — materials and labor separated — with every quantity, unit, and price editable.",
  },
  {
    number: 4,
    icon: Sparkles,
    title: 'AI Writes the Proposal',
    description:
      'Hit Build Proposal. The AI generates a complete professional document — scope of work, materials list, timeline, payment terms, and warranty language — written specifically for your job and trade.',
  },
  {
    number: 5,
    icon: Send,
    title: 'Send, Sign, and Get Paid',
    description:
      'Email the proposal directly to your client. They view it on any device, sign electronically, and you get notified instantly. Request a deposit with one click — the client pays by card and the money goes straight to your bank account. EZ-Bid takes 1%.',
  },
];

export const HOW_IT_WORKS_TIPS = [
  'Live material prices update every time you generate — prices reflect your exact job zip code',
  'The more detail in your job description, the better the AI output',
  'All proposals are stored in your dashboard with status tracking — Draft, Sent, Signed, Paid',
  'Download a PDF any time to print or send via text',
];

interface Props {
  /** "full" includes title/subtitle/tips. "compact" shows only the steps grid (for embedding in landing pages). */
  variant?: 'full' | 'compact';
}

export default function HowItWorks({ variant = 'full' }: Props) {
  return (
    <div className="space-y-10">
      {variant === 'full' && (
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{HOW_IT_WORKS_TITLE}</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">{HOW_IT_WORKS_SUBTITLE}</p>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-4">
        {HOW_IT_WORKS_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.number} className="flex gap-5 rounded-lg border bg-card p-5">
              <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-foreground text-background text-sm font-bold">
                {step.number}
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">{step.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {variant === 'full' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {HOW_IT_WORKS_TIPS.map((tip) => (
              <div
                key={tip}
                className="rounded-md border border-accent/40 bg-accent/30 px-4 py-3 text-sm text-foreground/80"
              >
                💡 {tip}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
