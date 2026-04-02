import { ReactNode, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { Button } from '@/components/ui/button';
import { FileText, Settings, LogOut, Plus } from 'lucide-react';
import EZBidLogo from '@/components/EZBidLogo';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { profile } = useCompanyProfile();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  const companyLabel = profile?.company_name || 'My Company';

  const navItems = [
    { href: '/dashboard', label: 'Proposals', icon: FileText },
    { href: '/company-profile', label: companyLabel, icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#1e3a5f]">
                <Hammer className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight" style={{ color: '#1e3a5f' }}>
                EZ-Bid
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={location.pathname === item.href ? 'secondary' : 'ghost'}
                    size="sm"
                    className="gap-2 text-sm"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/proposals/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Proposal
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
