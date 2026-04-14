import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import EZBidLogo from '@/components/EZBidLogo';
import { Button } from '@/components/ui/button';
import heroBg from '@/assets/hero-bg.jpg';
import { FileText, Sparkles, Send, CheckCircle, ArrowRight, Menu, X } from 'lucide-react';
import { useState } from 'react';

const testimonials = [
  { id: 1, name: "Marcus D.", trade: "Roofing", market: "Houston, TX", quote: "I used to spend two hours putting together a proposal in Word. Now I do it in ten minutes and it looks better than anything my competitors are sending. Won three jobs in my first week using it." },
  { id: 3, name: "Carlos M.", trade: "Plumbing", market: "Miami, FL", quote: "I was losing jobs to guys who charged more but looked more professional. EZ-Bid leveled the playing field. I closed four out of my last five proposals. That's never happened before." },
  { id: 15, name: "DeShawn R.", trade: "General Contracting", market: "Atlanta, GA", quote: "EZ-Bid took my business to the next level. I went from averaging twelve thousand dollar jobs to consistently landing twenty-five to thirty thousand dollar projects. The professional proposals give clients confidence to go bigger with me." },
];

const steps = [
  { icon: FileText, title: "Fill in the details", description: "Enter your client info, job scope, and pricing. Choose from professional templates built for the trades." },
  { icon: Sparkles, title: "AI polishes it up", description: "Our AI rewrites your job descriptions and scope of work so they sound sharp, professional, and thorough." },
  { icon: Send, title: "Send & get signed", description: "Email the proposal directly to your client. They review, sign, and you're ready to start the job." },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between px-4">
          <EZBidLogo size="md" />
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/tutorial">
              <Button variant="ghost" size="sm">How It Works</Button>
            </Link>
            <a href="#testimonials">
              <Button variant="ghost" size="sm">Testimonials</Button>
            </a>
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Get started free</Button>
            </Link>
          </div>
          {/* Mobile hamburger */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        {mobileNavOpen && (
          <div className="md:hidden border-t bg-background px-4 py-3 space-y-1">
            <Link to="/tutorial" className="block">
              <Button variant="ghost" size="sm" className="w-full justify-start">How It Works</Button>
            </Link>
            <a href="#testimonials" className="block" onClick={() => setMobileNavOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start">Testimonials</Button>
            </a>
            <Link to="/auth" className="block">
              <Button variant="ghost" size="sm" className="w-full justify-start">Sign in</Button>
            </Link>
            <Link to="/auth" className="block">
              <Button size="sm" className="w-full">Get started free</Button>
            </Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section
        className="py-14 md:py-28 relative bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-background/90" />
        <div className="container text-center max-w-3xl mx-auto relative z-10 px-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Professional proposals in minutes
          </h1>
          <p className="mt-4 md:mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            EZ-Bid helps contractors create polished, professional proposals in minutes — not hours. Fill in the details, let AI sharpen the language, and send it out. No design skills needed.
          </p>
          <div className="mt-6 md:mt-8 flex justify-center px-2">
            <Link to="/guest/new-proposal" className="w-full sm:w-auto">
              <Button size="lg" className="gap-2 w-full sm:w-auto h-14 text-base sm:text-lg font-semibold px-4 sm:px-8 whitespace-normal">
                <span className="hidden sm:inline">Create a Free Proposal — No Account Needed</span>
                <span className="sm:hidden">Free Proposal — No Account Needed</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Try it free · No signup required · Takes 5 minutes</p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 md:py-16 bg-secondary/50">
        <div className="container max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center">How it works</h2>
          <p className="mt-2 text-center text-muted-foreground">Three steps to your first professional proposal</p>
          <div className="mt-10 md:mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-foreground text-background">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials - show only 3 */}
      <section id="testimonials" className="py-12 md:py-16">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="rounded-lg bg-secondary px-5 py-8 md:px-12 md:py-12 text-center mb-10 md:mb-14">
            <p className="text-lg md:text-2xl font-semibold leading-relaxed max-w-2xl mx-auto">
              "I closed four out of my last five proposals. That's never happened before."
            </p>
            <p className="mt-4 text-sm text-muted-foreground">— Carlos M., Plumber · Miami, FL</p>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-center">
            Contractors across the country are winning more jobs
          </h2>
          <p className="mt-2 text-center text-muted-foreground">
            Real feedback from real tradespeople — no fluff.
          </p>

          <div className="mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {testimonials.map((t) => (
              <div
                key={t.id}
                className="flex flex-col rounded-lg border bg-card p-4 md:p-5 shadow-sm"
              >
                <span className="text-3xl font-serif leading-none" style={{ color: '#1e3a5f' }}>"</span>
                <p className="mt-1 flex-1 text-sm text-muted-foreground leading-relaxed">{t.quote}</p>
                <div className="mt-4 pt-3 border-t">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.trade} · {t.market}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <Link to="/reviews">
              <Button variant="outline" className="gap-2">
                See All Reviews <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-12 md:py-16 bg-secondary/50">
        <div className="container max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center">Simple pricing</h2>
          <p className="mt-2 text-center text-muted-foreground">Start free, upgrade when you're ready</p>

          <div className="mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 max-w-4xl mx-auto">
            {/* Free */}
            <div className="rounded-lg border bg-card p-5 md:p-6">
              <h3 className="text-lg font-semibold">Free Trial</h3>
              <p className="mt-1 text-3xl font-bold">$0</p>
              <p className="text-xs text-muted-foreground">3 proposals included</p>
              <ul className="mt-5 space-y-2">
                {["3 professional proposals", "All templates", "AI-enhanced descriptions", "PDF export"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block mt-6">
                <Button variant="outline" className="w-full">Get started</Button>
              </Link>
            </div>

            {/* Pro Monthly */}
            <div className="rounded-lg border-2 border-foreground bg-card p-5 md:p-6 relative">
              <span className="absolute -top-3 left-4 bg-foreground text-background text-xs font-medium px-2.5 py-0.5 rounded-full">
                Most popular
              </span>
              <h3 className="text-lg font-semibold">Pro Monthly</h3>
              <p className="mt-1 text-3xl font-bold">$29<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground">Unlimited proposals</p>
              <ul className="mt-5 space-y-2">
                {["Unlimited proposals", "All templates", "AI-enhanced descriptions", "PDF export", "Email delivery", "E-signatures", "Priority support"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block mt-6">
                <Button className="w-full">Start free trial</Button>
              </Link>
            </div>

            {/* Pro Annual */}
            <div className="rounded-lg border bg-card p-5 md:p-6 relative">
              <span className="absolute -top-3 left-4 bg-primary text-primary-foreground text-xs font-medium px-2.5 py-0.5 rounded-full">
                2 months free
              </span>
              <h3 className="text-lg font-semibold">Pro Annual</h3>
              <p className="mt-1 text-3xl font-bold">$290<span className="text-sm font-normal text-muted-foreground">/yr</span></p>
              <p className="text-xs text-muted-foreground">~$24/mo · Unlimited proposals</p>
              <ul className="mt-5 space-y-2">
                {["Everything in Pro Monthly", "2 months free", "Locked-in pricing", "Priority support"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block mt-6">
                <Button className="w-full">Start free trial</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 md:py-16">
        <div className="container text-center max-w-2xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold">Ready to look like the pro you are?</h2>
          <p className="mt-2 text-muted-foreground">Create your first proposal in minutes. No credit card, no commitment.</p>
          <Link to="/guest/new-proposal" className="inline-block mt-6 w-full sm:w-auto">
            <Button size="lg" className="gap-2 text-base px-8 w-full sm:w-auto">
              Create a Free Proposal
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-2 px-4">
          <EZBidLogo size="sm" />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EZ-Bid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
