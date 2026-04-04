import { ReactNode, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useAdminCheck } from '@/hooks/useAdminData';
import { Button } from '@/components/ui/button';
import { FileText, Settings, LogOut, Plus, Users, Shield } from 'lucide-react';
import EZBidLogo from '@/components/EZBidLogo';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { profile } = useCompanyProfile();
  const { data: adminData } = useAdminCheck();
  const isAdmin = !!adminData?.is_admin;
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
    { href: '/clients', label: 'Clients', icon: Users },
    { href: '/company-profile', label: companyLabel, icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard">
              <EZBidLogo size="md" />
            </Link>
            <nav className="flex items-center gap-1">
              <Link to="/proposals/new">
                <Button
                  variant={location.pathname === '/proposals/new' ? 'default' : 'default'}
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
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin">
                <Button variant="outline" size="sm" className="gap-2 text-sm">
                  <Shield className="h-4 w-4" />
                  Admin
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
