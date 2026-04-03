import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdminCheck } from '@/hooks/useAdminData';
import AdminSidebar from '@/components/admin/AdminSidebar';
import EZBidLogo from '@/components/EZBidLogo';
import { Link } from 'react-router-dom';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading: adminLoading, isError } = useAdminCheck();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (!adminLoading && (isError || !data?.is_admin)) {
      navigate('/dashboard');
    }
  }, [user, authLoading, adminLoading, isError, data, navigate]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!user || !data?.is_admin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center gap-4">
          <Link to="/admin">
            <EZBidLogo size="md" />
          </Link>
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">ADMIN</span>
        </div>
      </header>
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
