import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layouts/AppLayout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  History,
  FileText,
  Calculator,
  CreditCard,
  Shield,
  Landmark,
  TrendingUp,
  User,
  Wallet,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

interface DashboardItemProps {
  icon: React.ReactNode;
  label: string;
  to?: string;
  comingSoon?: boolean;
}

function DashboardItem({ icon, label, to, comingSoon }: DashboardItemProps) {
  if (comingSoon) {
    return (
      <div className="icon-button-disabled">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          {icon}
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="coming-soon-badge">Coming soon</span>
      </div>
    );
  }

  return (
    <Link to={to || '#'} className="icon-button group">
      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        {icon}
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="content-container">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Manage your crypto accounting.</p>
        </div>

        {/* Quick Access Icons */}
        <div className="mb-8">
          <h2 className="section-title">Quick Access</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <DashboardItem
              icon={<History className="w-6 h-6" />}
              label="Transaction History"
              to="/transactions"
            />
            <DashboardItem
              icon={<FileText className="w-6 h-6" />}
              label="Accounting"
              to="/accounting"
            />
            <DashboardItem
              icon={<Calculator className="w-6 h-6" />}
              label="Tax Calculator"
              comingSoon
            />
            <DashboardItem
              icon={<CreditCard className="w-6 h-6" />}
              label="Payment"
              comingSoon
            />
            <DashboardItem
              icon={<Shield className="w-6 h-6" />}
              label="Security"
              comingSoon
            />
            <DashboardItem
              icon={<Landmark className="w-6 h-6" />}
              label="Payment Gateway"
              comingSoon
            />
            <DashboardItem
              icon={<TrendingUp className="w-6 h-6" />}
              label="Get Investment"
              comingSoon
            />
          </div>
        </div>

        {/* Account Accordions */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Profile Accordion */}
          <div className="card-elevated">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="profile" className="border-none">
                <AccordionTrigger className="px-4 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <span className="font-medium">Profile</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Email</span>
                      <span className="text-foreground">{user?.email || '-'}</span>
                    </div>
                    <Link
                      to="/profile"
                      className="flex items-center justify-between py-2 text-primary hover:underline"
                    >
                      <span>Edit Profile</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Wallets Accordion */}
          <div className="card-elevated">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="wallets" className="border-none">
                <AccordionTrigger className="px-4 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <span className="font-medium">Wallets</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground py-2">
                      Connect and manage your crypto wallets for transaction tracking.
                    </p>
                    <Link
                      to="/wallets"
                      className="flex items-center justify-between py-2 text-primary hover:underline"
                    >
                      <span>Manage Wallets</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Virtual Custody Exchange Accordion */}
          <div className="card-elevated">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="vce" className="border-none">
                <AccordionTrigger className="px-4 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <span className="font-medium">Virtual Custody Exchange</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground py-2">
                      Link exchange APIs to sync trades and balances automatically.
                    </p>
                    <Link
                      to="/vce"
                      className="flex items-center justify-between py-2 text-primary hover:underline"
                    >
                      <span>Manage Exchanges</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
