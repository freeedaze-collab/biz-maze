import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard,
  History,
  FileText,
  Wallet,
  RefreshCw,
  User,
  DollarSign,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transaction History', icon: History },
  { to: '/accounting', label: 'Accounting', icon: FileText },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-card border-r border-border">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-border">
          <Link to="/dashboard" className="text-xl font-bold text-foreground">
            Biz Maze
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'nav-link-active' : 'nav-link'
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}

          {/* Account Section with Accordion */}
          <div className="pt-4 mt-4 border-t border-border">
            <Accordion type="multiple" className="space-y-1">
              <AccordionItem value="profile" className="border-none">
                <AccordionTrigger className="nav-link hover:no-underline py-2.5">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5" />
                    <span>Profile</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-8 pb-0">
                  <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                      `block py-2 text-sm ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
                    }
                  >
                    Edit Profile
                  </NavLink>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="wallets" className="border-none">
                <AccordionTrigger className="nav-link hover:no-underline py-2.5">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5" />
                    <span>Wallets</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-8 pb-0">
                  <NavLink
                    to="/wallets"
                    className={({ isActive }) =>
                      `block py-2 text-sm ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
                    }
                  >
                    Manage Wallets
                  </NavLink>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="vce" className="border-none">
                <AccordionTrigger className="nav-link hover:no-underline py-2.5">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5" />
                    <span>Virtual Custody Exchange</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-8 pb-0">
                  <NavLink
                    to="/vce"
                    className={({ isActive }) =>
                      `block py-2 text-sm ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
                    }
                  >
                    Manage Exchanges
                  </NavLink>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="pricing" className="border-none">
                <AccordionTrigger className="nav-link hover:no-underline py-2.5">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5" />
                    <span>Pricing</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-8 pb-0">
                  <NavLink
                    to="/pricing"
                    className={({ isActive }) =>
                      `block py-2 text-sm ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
                    }
                  >
                    View Plans
                  </NavLink>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              {displayName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full mt-2 nav-link text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between h-16 px-4">
          <Link to="/dashboard" className="text-xl font-bold text-foreground">
            Biz Maze
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-muted"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="absolute top-16 left-0 right-0 bg-card border-b border-border shadow-lg">
            <nav className="px-4 py-4 space-y-1">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    isActive ? 'nav-link-active' : 'nav-link'
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
              <NavLink to="/profile" onClick={() => setMobileMenuOpen(false)} className="nav-link">
                <User className="w-5 h-5" />
                Profile
              </NavLink>
              <NavLink to="/wallets" onClick={() => setMobileMenuOpen(false)} className="nav-link">
                <Wallet className="w-5 h-5" />
                Wallets
              </NavLink>
              <NavLink to="/vce" onClick={() => setMobileMenuOpen(false)} className="nav-link">
                <RefreshCw className="w-5 h-5" />
                Virtual Custody Exchange
              </NavLink>
              <button
                onClick={handleSignOut}
                className="w-full nav-link text-destructive"
              >
                <LogOut className="w-5 h-5" />
                Sign out
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 lg:pl-64">
        <div className="pt-16 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}
