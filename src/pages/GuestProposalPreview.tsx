import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ProposalDocument from '@/components/proposal/ProposalDocument';
import TemplateSwitcher, { type TemplateId } from '@/components/proposal/TemplateSwitcher';
import { getTradeStyle } from '@/components/proposal/tradeStyles';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Mail, Send } from 'lucide-react';
import EZBidLogo from '@/components/EZBidLogo';
import GuestSignupWall from '@/components/GuestSignupWall';
import { useAuth } from '@/hooks/useAuth';

export default function GuestProposalPreview() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [showWall, setShowWall] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>('modern');

  // Redirect logged-in users
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Load guest data from localStorage
  const proposalRaw = localStorage.getItem('ezbid_guest_proposal');
  const lineItemsRaw = localStorage.getItem('ezbid_guest_line_items');

  if (!proposalRaw || !lineItemsRaw) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No guest proposal found.</p>
          <Link to="/guest/new-proposal">
            <Button>Create a Free Proposal</Button>
          </Link>
        </div>
      </div>
    );
  }

  const proposal = JSON.parse(proposalRaw);
  const lineItems = JSON.parse(lineItemsRaw).map((li: any, i: number) => ({
    ...li,
    id: `guest_${i}`,
    proposal_id: 'guest',
  }));

  // Build a mock profile from guest company info
  const guestCompany = proposal.guest_company || {};
  const profile: any = {
    company_name: guestCompany.company_name || null,
    phone: guestCompany.phone || null,
    email: guestCompany.email || null,
    owner_name: null,
    street_address: null,
    city: null,
    state: null,
    zip: null,
    logo_url: null,
    license_numbers: null,
    insurance_info: null,
    brand_color: '#000000',
    website: null,
    trade_type: proposal.trade_type,
  };

  const tradeStyle = getTradeStyle(proposal.trade_type);

  const handleAction = () => {
    setShowWall(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link to="/">
            <EZBidLogo size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth?signup=1&from=guest">
              <Button size="sm">Create account</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container px-4 py-5 md:py-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <h1 className="text-lg md:text-xl font-semibold">Proposal Preview</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Preview with watermark */}
          <div className="border rounded-lg overflow-x-auto bg-background shadow-sm relative">
            {/* Watermark overlay */}
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="text-6xl md:text-8xl font-bold tracking-widest whitespace-nowrap select-none"
                  style={{
                    color: 'rgba(0, 0, 0, 0.06)',
                    transform: 'rotate(-35deg)',
                    letterSpacing: '0.15em',
                  }}
                >
                  EZ-Bid Preview
                </div>
              </div>
              {/* Repeat for coverage */}
              <div className="absolute top-[15%] left-[-10%] flex items-center justify-center w-[120%]">
                <div
                  className="text-4xl md:text-6xl font-bold tracking-widest whitespace-nowrap select-none"
                  style={{
                    color: 'rgba(0, 0, 0, 0.04)',
                    transform: 'rotate(-35deg)',
                  }}
                >
                  EZ-Bid Preview
                </div>
              </div>
              <div className="absolute bottom-[15%] left-[-10%] flex items-center justify-center w-[120%]">
                <div
                  className="text-4xl md:text-6xl font-bold tracking-widest whitespace-nowrap select-none"
                  style={{
                    color: 'rgba(0, 0, 0, 0.04)',
                    transform: 'rotate(-35deg)',
                  }}
                >
                  EZ-Bid Preview
                </div>
              </div>
            </div>

            <ProposalDocument
              proposal={proposal}
              lineItems={lineItems}
              profile={profile}
              exhibits={[]}
              template={activeTemplate}
            />
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <TemplateSwitcher
              current={activeTemplate}
              accentColor={tradeStyle?.accentColor || '#374151'}
              onSelect={setActiveTemplate}
            />

            {/* Actions — all trigger the wall */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium">Download & Send</h3>

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleAction}
              >
                <Download className="h-4 w-4" />
                Download as PDF
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleAction}
              >
                <Mail className="h-4 w-4" />
                Send to my email
              </Button>

              <Button
                type="button"
                className="w-full gap-2"
                onClick={handleAction}
              >
                <Send className="h-4 w-4" />
                Send to client
              </Button>

              <p className="text-xs text-muted-foreground text-center pt-1">
                Create a free account to download and send your proposal.
              </p>
            </div>

            {/* CTA card */}
            <div className="border rounded-lg p-4 bg-secondary/50 space-y-3 text-center">
              <p className="text-sm font-medium">Like what you see?</p>
              <p className="text-xs text-muted-foreground">Sign up to save this proposal and create unlimited more.</p>
              <Link to="/auth?signup=1&from=guest">
                <Button className="w-full">Create Free Account</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <GuestSignupWall open={showWall} onOpenChange={setShowWall} />
    </div>
  );
}
