import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import EZBidLogo from '@/components/EZBidLogo';
import { Button } from '@/components/ui/button';
import { FileText, Sparkles, Send, CheckCircle, ArrowRight } from 'lucide-react';

const testimonials = [
  { id: 1, name: "Marcus D.", trade: "Roofing", market: "Houston, TX", quote: "I used to spend two hours putting together a proposal in Word. Now I do it in ten minutes and it looks better than anything my competitors are sending. Won three jobs in my first week using it." },
  { id: 2, name: "Jake T.", trade: "HVAC", market: "Tampa, FL", quote: "My proposals used to look like they were written on a napkin. Now clients actually comment on how professional the paperwork looks before I even start the job. It's changed how people perceive my business." },
  { id: 3, name: "Carlos M.", trade: "Plumbing", market: "Miami, FL", quote: "I was losing jobs to guys who charged more but looked more professional. EZ-Bid leveled the playing field. I closed four out of my last five proposals. That's never happened before." },
  { id: 4, name: "Darnell W.", trade: "Electrical", market: "Dallas, TX", quote: "The AI rewrites my job descriptions and makes me sound like I've been running a big operation for years. Clients trust me more before I even show up on site. Worth every penny." },
  { id: 5, name: "Tommy B.", trade: "General Contracting", market: "Orlando, FL", quote: "I do kitchen and bathroom remodels. My proposals used to be three lines in an email. Now they're detailed, polished, and my clients feel confident signing. My average job size went up because the scope looks more thorough." },
  { id: 6, name: "Ray G.", trade: "Landscaping", market: "San Antonio, TX", quote: "Most landscapers around here don't even send a real proposal. I show up with something that looks like it came from a real company and I almost always get the job. It's an unfair advantage honestly." },
  { id: 7, name: "Steve K.", trade: "Painting", market: "Jacksonville, FL", quote: "I'm not a writer and English isn't my first language. The AI cleans up how I describe the job and makes it sound sharp without changing anything I quoted. My clients don't even know I'm using it." },
  { id: 8, name: "Andre F.", trade: "Flooring", market: "Austin, TX", quote: "Sent my first proposal on a Monday morning, got a signature by noon. Client told me it was the most professional quote he'd received. I've been doing flooring for eleven years and that's never happened that fast." },
  { id: 9, name: "Mike P.", trade: "Pool & Spa", market: "Fort Lauderdale, FL", quote: "Pool jobs are big tickets. Clients are nervous about who they're handing fifty grand to. A polished proposal with my logo, license numbers, and a clear scope of work makes them feel like they're dealing with a real operation. Closing rate is way up." },
  { id: 10, name: "Brian C.", trade: "Roofing", market: "Fort Worth, TX", quote: "Storm season gets hectic. I used to rush through proposals and make mistakes. Now I fill in the form, the AI handles the write-up, and I'm sending something clean in minutes. Less errors, more jobs closed." },
  { id: 11, name: "Luis P.", trade: "Fencing", market: "Naples, FL", quote: "I was skeptical about paying for a proposal tool but my buddy talked me into trying it free. After the third proposal I subscribed without thinking twice. It's made my whole operation feel more legit." },
  { id: 12, name: "Jerome B.", trade: "Concrete & Masonry", market: "Houston, TX", quote: "My proposals used to be a handshake and a number on a sticky note. Now I send a full document with scope, materials, payment terms, everything. Clients stop shopping around once they see something that professional." },
  { id: 13, name: "Phil N.", trade: "Solar Installation", market: "Sarasota, FL", quote: "Solar clients do their research and they're comparing three or four bids. I needed to look sharp on paper. EZ-Bid got me there fast and I didn't need to hire anyone to design anything. The templates are clean and the output is impressive." },
  { id: 14, name: "Chris H.", trade: "Irrigation & Sprinklers", market: "Scottsdale, AZ", quote: "I was using a spreadsheet and a prayer. Now every proposal looks consistent, professional, and gets out the door fast. My office time is cut in half and I'm spending more time on jobs. That's what matters." },
];

const steps = [
  { icon: FileText, title: "Fill in the details", description: "Enter your client info, job scope, and pricing. Choose from professional templates built for the trades." },
  { icon: Sparkles, title: "AI polishes it up", description: "Our AI rewrites your job descriptions and scope of work so they sound sharp, professional, and thorough." },
  { icon: Send, title: "Send & get signed", description: "Email the proposal directly to your client. They review, sign, and you're ready to start the job." },
];

export default function LandingPage() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <EZBidLogo size="md" />
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Get started free</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 md:py-28">
        <div className="container text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Win more jobs with proposals that look like you mean business
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
            EZ-Bid helps contractors create polished, professional proposals in minutes — not hours. Fill in the details, let AI sharpen the language, and send it out. No design skills needed.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="gap-2 text-base px-8">
                Start for free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">3 free proposals · No credit card required</p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-secondary/50">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center">How it works</h2>
          <p className="mt-2 text-center text-muted-foreground">Three steps to your first professional proposal</p>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
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

      {/* Testimonials */}
      <section className="py-16">
        <div className="container max-w-5xl mx-auto">
          {/* Hero pull quote */}
          <div className="rounded-lg bg-secondary px-6 py-10 md:px-12 md:py-12 text-center mb-14">
            <p className="text-xl md:text-2xl font-semibold leading-relaxed max-w-2xl mx-auto">
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

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div
                key={t.id}
                className="flex flex-col rounded-lg border bg-card p-5 shadow-sm"
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
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 bg-secondary/50">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center">Simple pricing</h2>
          <p className="mt-2 text-center text-muted-foreground">Start free, upgrade when you're ready</p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold">Free</h3>
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

            {/* Pro */}
            <div className="rounded-lg border-2 border-foreground bg-card p-6 relative">
              <span className="absolute -top-3 left-4 bg-foreground text-background text-xs font-medium px-2.5 py-0.5 rounded-full">
                Most popular
              </span>
              <h3 className="text-lg font-semibold">Pro</h3>
              <p className="mt-1 text-3xl font-bold">$79<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
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
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold">Ready to look like the pro you are?</h2>
          <p className="mt-2 text-muted-foreground">Create your first proposal in minutes. No credit card, no commitment.</p>
          <Link to="/auth" className="inline-block mt-6">
            <Button size="lg" className="gap-2 text-base px-8">
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container flex items-center justify-between">
          <EZBidLogo size="sm" />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EZ-Bid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
