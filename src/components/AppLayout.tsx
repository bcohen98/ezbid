import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { FileText, Settings, LogOut, Plus, Users, Shield, HelpCircle, Menu, X, Gift, DollarSign, Award } from 'lucide-react';
import EZBidLogo from '@/components/EZBidLogo';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { profile } = useCompanyProfile();
  const { data: roles } = useUserRole();
  const isAdmin = roles?.isAdmin;
  const isAmbassador = roles?.isAmbassador;
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const dest = location.pathname + location.search;
      const redirectParam = dest && dest !== '/' ? `?redirect=${encodeURIComponent(dest)}` : '';
      navigate(`/auth${redirectParam}`, { replace: true });
    }
  }, [user, loading, navigate, location]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
    { href: '/clients', label: 'Clients', icon: Users },
    { href: '/earnings', label: 'Earnings', icon: DollarSign },
    { href: '/referrals', label: 'Refer & Earn', icon: Gift },
    { href: '/company-profile', label: companyLabel, icon: Settings },
    { href: '/tutorial', label: 'Tutorial', icon: HelpCircle },
  ];

  const adminAndAmbassadorButtons = (extraClass = '') => (
    <>
      {isAmbassador && !isAdmin && (
        <Link to="/ambassador">
          <Button variant="outline" size="sm" className={`gap-2 text-sm ${extraClass}`}>
            <Award className="h-4 w-4" />
            Ambassador
          </Button>
        </Link>
      )}
      {isAdmin && (
        <Link to="/admin">
          <Button variant="outline" size="sm" className={`gap-2 text-sm ${extraClass}`}>
            <Shield className="h-4 w-4" />
            Admin
          </Button>
        </Link>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4 md:gap-6">
            <Link to="/dashboard">
              <EZBidLogo size="md" />
            </Link>
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              <Link to="/proposals/new">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  New Proposal
                </Button>
              </Link>
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
          <div className="hidden md:flex items-center gap-2">
            {adminAndAmbassadorButtons()}
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background px-4 py-3 space-y-1">
            <Link to="/proposals/new" className="block">
              <Button variant="default" size="sm" className="w-full gap-2 text-sm justify-start">
                <Plus className="h-4 w-4" />
                New Proposal
              </Button>
            </Link>
            {navItems.map((item) => (
              <Link key={item.href} to={item.href} className="block">
                <Button
                  variant={location.pathname === item.href ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full gap-2 text-sm justify-start"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
            <div className="space-y-1">{adminAndAmbassadorButtons('w-full justify-start')}</div>
            <Button variant="ghost" size="sm" className="w-full gap-2 justify-start" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}
