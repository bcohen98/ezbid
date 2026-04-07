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
  { id: 15, name: "DeShawn R.", trade: "General Contracting", market: "Atlanta, GA", quote: "EZ-Bid took my business to the next level. I went from averaging twelve thousand dollar jobs to consistently landing twenty-five to thirty thousand dollar projects. The professional proposals give clients confidence to go bigger with me." },
  { id: 16, name: "Victor L.", trade: "Roofing", market: "Phoenix, AZ", quote: "My average project size jumped almost forty percent in three months. Clients see a detailed, professional proposal and they stop nickel-and-diming. They trust the scope and sign off on the full package instead of cutting corners." },
  { id: 17, name: "Terrence M.", trade: "HVAC", market: "Charlotte, NC", quote: "Before EZ-Bid I was doing small repair jobs, maybe two or three grand each. Now I'm landing full system installs at fifteen to twenty thousand because my proposals actually communicate the value. This tool changed my entire business trajectory." },
  { id: 18, name: "Robert W.", trade: "Landscaping", market: "Denver, CO", quote: "I used to quote small patio jobs. Now I'm winning full backyard transformations — fifteen, twenty thousand dollar projects. The proposals make clients see the vision and they're willing to invest more. My revenue doubled in six months." },
  { id: 19, name: "James K.", trade: "Painting", market: "Nashville, TN", quote: "I went from painting single rooms to getting whole-house contracts. My average project went from eight hundred dollars to over five thousand. Clients see the professional proposal and they just add more rooms. It sells itself." },
  { id: 20, name: "Omar S.", trade: "Electrical", market: "Las Vegas, NV", quote: "EZ-Bid helped me move from residential patch jobs to commercial contracts. My average project size tripled. When you show up with a proposal that looks like it came from a major firm, people treat you like one. Game changer." },
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
          <div className="mt-6 md:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/guest/new-proposal" className="w-full sm:w-auto">
              <Button size="lg" className="gap-2 text-base px-8 w-full sm:w-auto h-14 text-lg font-semibold">
                Create a Free Proposal — No Account Needed
                <ArrowRight className="h-4 w-4" />
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

      {/* Testimonials */}
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

          <div className="mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
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
              <p className="mt-1 text-3xl font-bold">$39<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
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
                Save 15%
              </span>
              <h3 className="text-lg font-semibold">Pro Annual</h3>
              <p className="mt-1 text-3xl font-bold">$399<span className="text-sm font-normal text-muted-foreground">/yr</span></p>
              <p className="text-xs text-muted-foreground">~$33/mo · Unlimited proposals</p>
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
          <Link to="/auth" className="inline-block mt-6 w-full sm:w-auto">
            <Button size="lg" className="gap-2 text-base px-8 w-full sm:w-auto">
              Get started free
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
