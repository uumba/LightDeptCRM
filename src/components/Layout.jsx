import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Package, Calendar, CalendarDays, Users, Menu, X, Bug, ScrollText } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/equipment', label: 'Equipment', icon: Package },
  { to: '/rentals', label: 'Rentals', icon: Calendar },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/data-check', label: 'Data Check', icon: Bug },
  { to: '/audit-log', label: 'Audit Log', icon: ScrollText },
];

function SidebarContent({ onNavigate }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">LD</span>
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight leading-none">LIGHT DEPT</div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">CRM</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'nav-link-active' : ''}`
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <ThemeToggle />
      </div>
    </div>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-[hsl(var(--sidebar-bg))]">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[hsl(var(--sidebar-bg))] flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-[hsl(var(--sidebar-bg))]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">LD</span>
            </div>
            <span className="text-sm font-bold">LIGHT DEPT CRM</span>
          </div>
          <button onClick={() => setMobileOpen(true)} className="btn-ghost !p-2">
            <Menu size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}