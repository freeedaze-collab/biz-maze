
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

// --- Data Structures ---
const WALLET_PROVIDERS = [
  {
    name: 'MetaMask',
    slug: 'metamask',
    isAddressRequired: true,
    chains: [
      { name: 'Ethereum (EVM)', slug: 'eth-evm', description: 'Connect using the standard MetaMask browser provider.', isDummy: false },
    ]
  },
  {
    name: 'WalletConnect',
    slug: 'walletconnect',
    isAddressRequired: true,
    chains: [
        { name: 'Ethereum (EVM)', slug: 'eth-evm', description: 'Connect using WalletConnect modal.', isDummy: true },
    ]
  },
  {
    name: 'Phantom',
    slug: 'phantom',
    isAddressRequired: false, // Phantom manages its own address discovery
    chains: [
      { name: 'Solana', slug: 'sol', description: 'Connect your native Solana wallet.', isDummy: true },
      { name: 'Ethereum (EVM)', slug: 'eth-evm', description: 'Connect using Phantom\'s EVM compatibility.', isDummy: true },
    ]
  }
];

// --- Components ---

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
      setWallets(data || []);
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
      <CardHeader><CardTitle>Your Linked Wallets</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wallets linked yet.</p>
        ) : (
          wallets.map(wallet => (
            <div key={wallet.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <span className="capitalize bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs mr-2">{wallet.wallet_type || 'ethereum'}</span>
                <span className="font-mono text-sm break-all">{wallet.wallet_address}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleDelete(wallet.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AddNewWalletManager({ onLinkSuccess }) {
  const { verifyWalletOwnership, isVerifying } = useSIWE();
  const [addressInput, setAddressInput] = useState("");
  const { toast } = useToast();

  const handleConnect = async (provider, chain) => {
    if (chain.isDummy) {
      toast({ title: 'Coming Soon!', description: `${provider.name} (${chain.name}) integration is under development.` });
      return;
    }

    // --- The one working feature: MetaMask --- 
    if (provider.slug === 'metamask' && !chain.isDummy) {
        const address = addressInput.trim();
        if (!address) {
            toast({ variant: 'destructive', title: 'Address Required', description: 'Please enter a wallet address to verify with MetaMask.' });
            return;
        }
        const success = await verifyWalletOwnership(address, 'metamask');
        if (success) {
            toast({ title: 'Wallet Linked!', description: `Successfully verified and linked ${address}.`});
            setAddressInput("");
            onLinkSuccess();
        }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a Wallet</CardTitle>
        <CardDescription>Enter an address, then choose a wallet to sign and verify ownership.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div>
            <label className='text-sm font-medium'>Wallet Address</label>
            <Input
                placeholder="0x..."
                value={addressInput}
                onChange={e => setAddressInput(e.target.value)}
                disabled={isVerifying}
                className="mt-1"
            />
        </div>

        <Accordion type="single" collapsible className="w-full">
          {WALLET_PROVIDERS.map(provider => (
            <AccordionItem key={provider.slug} value={provider.slug}>
              <AccordionTrigger className="text-lg">{provider.name}</AccordionTrigger>
              <AccordionContent className="p-2">
                <Accordion type="single" collapsible className="w-full">
                  {provider.chains.map(chain => (
                    <AccordionItem key={chain.slug} value={`${provider.slug}-${chain.slug}`}>
                      <AccordionTrigger>{chain.name}</AccordionTrigger>
                      <AccordionContent className="p-2">
                         <div className="border-t pt-4 mt-4 space-y-3">
                            <p className="text-sm text-muted-foreground">{chain.description}</p>
                            {provider.isAddressRequired && !addressInput && <p className='text-xs text-destructive'>Please enter a wallet address above.</p>}
                            <Button 
                                onClick={() => handleConnect(provider, chain)} 
                                disabled={isVerifying || (provider.isAddressRequired && !addressInput)}
                                className="w-full"
                            >
                                {isVerifying && !chain.isDummy ? 'Verifying...' : `Link (${provider.name})`}
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

export function WalletsPage() {
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const handleConnectionUpdate = () => setUpdateTrigger(c => c + 1);

  return (
    <AppPageLayout
      title="Wallet Connections"
      description="Link wallets to your account by verifying ownership."
    >
      <div className="space-y-6">
        <ExistingWallets updateTrigger={updateTrigger} onConnectionDelete={handleConnectionUpdate} />
        <AddNewWalletManager onLinkSuccess={handleConnectionUpdate} />
      </div>
    </AppPageLayout>
  );
}

export default WalletsPage;
