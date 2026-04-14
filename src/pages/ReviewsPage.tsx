import { Link } from 'react-router-dom';
import EZBidLogo from '@/components/EZBidLogo';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const testimonials = [
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

export default function ReviewsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link to="/">
            <EZBidLogo size="md" />
          </Link>
          <Link to="/auth">
            <Button size="sm">Get started free</Button>
          </Link>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <h1 className="text-3xl font-bold">What contractors are saying</h1>
        <p className="mt-2 text-muted-foreground">Real feedback from real tradespeople — no fluff.</p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
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

      <footer className="border-t py-6">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-2 px-4">
          <EZBidLogo size="sm" />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EZ-Bid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
