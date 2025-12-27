
// src/pages/Wallets.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useSIWE } from "@/hooks/useSIWE";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/components/ui/use-toast';
import AppPageLayout from '@/components/layout/AppPageLayout';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

// --- (New) Data Structure for Future Wallets ---
const FUTURE_WALLET_PROVIDERS = [
  {
    name: 'Phantom',
    slug: 'phantom',
    chains: [
      { name: 'Solana', slug: 'sol', description: 'Connect your native Solana wallet.' },
      { name: 'Ethereum (EVM)', slug: 'eth-evm', description: 'Connect using Phantom\'s EVM compatibility.' },
    ]
  }
];

// --- Components ---

// Component to list existing wallet connections (shared by all)
function ExistingWallets({ updateTrigger, onConnectionDelete }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<any[]>([]);

  async function fetchWallets() {
    if (!session) return;
    const { data, error } = await supabase
      .from('wallet_connections')
      .select('id, wallet_address, wallet_type, verified_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to load wallets', description: error.message });
    } else {
      setWallets(data);
    }
  }

  useEffect(() => {
    if (session) fetchWallets();
  }, [session, updateTrigger]);

  const handleDelete = async (walletId: string) => {
    if (!window.confirm("Are you sure you want to delete this wallet connection?")) return;
    const { error } = await supabase.from('wallet_connections').delete().eq('id', walletId);
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to delete wallet', description: error.message });
    } else {
      toast({ title: "Wallet connection deleted." });
      onConnectionDelete();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Linked Wallets</CardTitle>
        <CardDescription>Manage your existing wallet connections.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wallets linked yet.</p>
        ) : (
          wallets.map(wallet => (
            <div key={wallet.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
              <div>
                <span className="capitalize bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs mr-2">{wallet.wallet_type || 'ethereum'}</span>
                <span className="font-mono text-sm break-all">{wallet.wallet_address}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleDelete(wallet.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// (Original) Simple component for linking EVM wallets like MetaMask
function ExistingEvmLinker({ onLinkSuccess }) {
  const { verifyWalletOwnership, isVerifying } = useSIWE();
  const [addressInput, setAddressInput] = useState("");
  const { toast } = useToast();

  const handleLink = async () => {
    const address = addressInput.trim();
    if (!address) {
      toast({ variant: 'destructive', title: 'Address Required', description: 'Please enter a wallet address.' });
      return;
    }
    
    const success = await verifyWalletOwnership(address, 'metamask'); // Keep original logic
    if (success) {
      toast({ title: 'Wallet Linked!', description: `Successfully verified and linked ${address}.`});
      setAddressInput("");
      onLinkSuccess();
    }
    // Failure is handled by useSIWE hook
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link EVM Wallet (MetaMask, etc.)</CardTitle>
        <CardDescription>Connect your primary EVM wallet. A signature will be requested to verify ownership.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="0x..."
            value={addressInput}
            onChange={e => setAddressInput(e.target.value)}
            disabled={isVerifying}
          />
          <Button onClick={handleLink} disabled={isVerifying} className="w-full sm:w-auto">
            {isVerifying ? 'Verifying...' : 'Link Wallet'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// (New) Dummy component for future wallet integrations
function FutureWalletManager() {
  const { toast } = useToast();

  const handleDummyClick = (walletName: string, chainName: string) => {
    toast({ title: 'Coming Soon!', description: `${walletName} (${chainName}) integration is under development.` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Other Wallets</CardTitle>
        <CardDescription>Integrations for other wallets and blockchains are coming soon.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {FUTURE_WALLET_PROVIDERS.map(provider => (
            <AccordionItem key={provider.slug} value={provider.slug}>
              <AccordionTrigger className="text-lg">{provider.name}</AccordionTrigger>
              <AccordionContent className="p-2">
                <Accordion type="single" collapsible className="w-full">
                  {provider.chains.map(chain => (
                    <AccordionItem key={chain.slug} value={chain.slug}>
                      <AccordionTrigger>{chain.name}</AccordionTrigger>
                      <AccordionContent className="p-2">
                         <div className="border-t pt-4 mt-4">
                            <p className="text-sm text-muted-foreground mb-3">{chain.description}</p>
                            <Button onClick={() => handleDummyClick(provider.name, chain.name)} className="w-full">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Connect {chain.name}
                            </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

// Main Page Component
export function WalletsPage() {
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const handleConnectionUpdate = () => {
    setUpdateTrigger(c => c + 1); // Increment to trigger re-fetch in ExistingWallets
  };

  return (
    <AppPageLayout
      title="Wallet Connections"
      description="Link wallets to your account by verifying ownership. This allows for balance and transaction syncing."
    >
      <div className="space-y-6">
        <ExistingWallets updateTrigger={updateTrigger} onConnectionDelete={handleConnectionUpdate} />
        <ExistingEvmLinker onLinkSuccess={handleConnectionUpdate} />
        <FutureWalletManager />
      </div>
    </AppPageLayout>
  );
}

export default WalletsPage;
