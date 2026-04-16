import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import EZBidLogo from '@/components/EZBidLogo';
import { Button } from '@/components/ui/button';
import heroBg from '@/assets/hero-bg.jpg';
import { FileText, Sparkles, Send, CheckCircle, ArrowRight, Menu, X, Mic, PenTool, Shield } from 'lucide-react';
import { useState } from 'react';

const testimonials = [
  { id: 1, name: "Marcus D.", trade: "Roofing", market: "Houston, TX", quote: "I used to spend two hours putting together a proposal in Word. Now I do it in ten minutes and it looks better than anything my competitors are sending. Won three jobs in my first week using it." },
  { id: 3, name: "Carlos M.", trade: "Plumbing", market: "Miami, FL", quote: "I was losing jobs to guys who charged more but looked more professional. EZ-Bid leveled the playing field. I closed four out of my last five proposals. That's never happened before." },
  { id: 15, name: "DeShawn R.", trade: "General Contracting", market: "Atlanta, GA", quote: "EZ-Bid took my business to the next level. I went from averaging twelve thousand dollar jobs to consistently landing twenty-five to thirty thousand dollar projects. The professional proposals give clients confidence to go bigger with me." },
];

const steps = [
  { title: "Enter customer info", description: "Name, address, job site. Done in 30 seconds." },
  { title: "Describe the job in plain English", description: "Tell it what you're doing, like you'd explain it to a helper." },
  { title: "Review your instant proposal", description: "AI generates line items, pricing, and a professional write-up. Edit anything." },
  { title: "Send it and get it signed", description: "Your customer signs from their phone in one tap." },
  { title: "It gets smarter every time", description: "EZ-Bid learns how you price and work, so every proposal gets faster and more accurate." },
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
            Professional proposals for contractors — built in 60 seconds
          </h1>
          <p className="mt-4 md:mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Describe the job by voice or text. AI writes the proposal. Client signs on their phone. Stop losing bids to sloppy paperwork.
          </p>
          <div className="mt-6 md:mt-8 flex justify-center px-2">
            <Link to="/guest/new-proposal" className="w-full sm:w-auto">
              <Button size="lg" className="gap-2 w-full sm:w-auto h-14 text-base sm:text-lg font-semibold px-4 sm:px-8 whitespace-normal">
                <span className="hidden sm:inline">Create My First Proposal — Free</span>
                <span className="sm:hidden">Create My First Proposal — Free</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">3 free proposals · No credit card required · Takes under 5 minutes</p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 md:py-16 bg-secondary/50">
        <div className="container max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center">How It Works</h2>
          <p className="mt-2 text-center text-muted-foreground">Most contractors send their first proposal in under 5 minutes.</p>
          <div className="mt-10 md:mt-12 grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-6">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-full bg-foreground text-background text-sm font-semibold">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features / Outcomes */}
      <section className="py-12 md:py-16">
        <div className="container max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center">Built for the way contractors actually work</h2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: Sparkles, title: "Proposals that sound professional, every time", desc: "AI rewrites your rough notes into polished scope-of-work language. No more copy-pasting from old bids." },
              { icon: Shield, title: "Win more jobs with less effort", desc: "Clients trust contractors who look organized. Send proposals that make you stand out — even against bigger companies." },
              { icon: PenTool, title: "Get signed faster with e-signatures", desc: "Clients review and sign right from their phone. No printing, scanning, or chasing down paperwork." },
              { icon: FileText, title: "Every detail covered, nothing missed", desc: "Materials, warranty, payment terms, disclosures — AI fills it all in based on your trade and job details." },
            ].map((f, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-lg border bg-card">
                <div className="shrink-0 mt-0.5">
                  <f.icon className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-12 md:py-16 bg-secondary/50">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="rounded-lg bg-card border px-5 py-8 md:px-12 md:py-12 text-center mb-10 md:mb-14">
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
      <section className="py-12 md:py-16">
        <div className="container max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center">Simple, honest pricing</h2>
          <p className="mt-2 text-center text-muted-foreground">Start free. Upgrade when you're winning enough jobs to justify it.</p>

          <div className="mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 max-w-4xl mx-auto">
            {/* Free */}
            <div className="rounded-lg border bg-card p-5 md:p-6">
              <h3 className="text-lg font-semibold">Free</h3>
              <p className="mt-1 text-3xl font-bold">$0</p>
              <p className="text-xs text-muted-foreground">3 proposals, no credit card</p>
              <ul className="mt-5 space-y-2">
                {["3 professional proposals", "All 10 templates", "AI-written scope & terms", "PDF export", "E-signatures"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/guest/new-proposal" className="block mt-6">
                <Button variant="outline" className="w-full">Create My First Proposal — Free</Button>
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
                {["Unlimited proposals", "All 10 templates", "AI-written scope & terms", "PDF export", "E-signatures", "Email delivery to clients", "Priority support"].map((f) => (
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
      <section className="py-12 md:py-16 bg-secondary/50">
        <div className="container text-center max-w-2xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold">Your next bid shouldn't take two hours</h2>
          <p className="mt-2 text-muted-foreground">Create a professional proposal in under a minute. 3 free proposals. No credit card required.</p>
          <Link to="/guest/new-proposal" className="inline-block mt-6 w-full sm:w-auto">
            <Button size="lg" className="gap-2 text-base px-8 w-full sm:w-auto">
              Create My First Proposal — Free
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
