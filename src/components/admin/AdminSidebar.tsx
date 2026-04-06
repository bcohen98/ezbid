import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Users, FileText, DollarSign, ChevronLeft, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Overview', icon: BarChart3 },
  { href: '/admin/analytics', label: 'Analytics', icon: Activity },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/proposals', label: 'Proposals', icon: FileText },
  { href: '/admin/revenue', label: 'Revenue', icon: DollarSign },
];

export default function AdminSidebar() {
  const location = useLocation();

  return (
    <aside className="w-56 shrink-0 border-r bg-muted/30 min-h-[calc(100vh-3.5rem)]">
      <div className="p-4 space-y-1">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground mb-4">
            <ChevronLeft className="h-4 w-4" />
            Back to app
          </Button>
        </Link>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Admin</p>
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link key={item.href} to={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 text-sm',
                  isActive && 'bg-foreground text-background font-medium'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
