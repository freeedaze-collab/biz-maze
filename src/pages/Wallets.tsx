import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet, Link2, Info, CheckCircle } from 'lucide-react';

type WalletRow = { id: number; address: string; verified_at: string | null };

export default function WalletsPage() {
  const { user } = useAuth();
  const [addressInput, setAddressInput] = useState('');
  const [nonce, setNonce] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [rows, setRows] = useState<WalletRow[]>([]);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('wallets')
      .select('id,address,verified_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[wallets] load error:', error);
      setRows([]);
    } else {
      setRows((data as WalletRow[]) ?? []);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const getNonce = async () => {
    const { data, error } = await supabase.functions.invoke('verify-wallet-signature', {
      body: { action: 'nonce' },
    });
    if (error) throw error;
    return (data as any)?.nonce as string;
  };

  const signWithMetaMask = async (msg: string) => {
    const eth = (window as any).ethereum;
    if (!eth?.request) throw new Error('MetaMask not found');
    const signature = await eth.request({
      method: 'personal_sign',
      params: [msg],
    });
    if (typeof signature !== 'string') throw new Error('Signature failed');
    return signature as string;
  };

  const handleLink = async () => {
    try {
      setBusy(true);
      setMessage('');

      if (!user) {
        setMessage('Please login first.');
        return;
      }
      const addr = addressInput.trim();
      if (!addr) {
        setMessage('Enter a wallet address.');
        return;
      }

      const n = nonce ?? (await getNonce());
      setNonce(n);

      const sig = await signWithMetaMask(n);

      const { data, error } = await supabase.functions.invoke('verify-wallet-signature', {
        body: { action: 'verify', address: addr, nonce: n, signature: sig },
      });

      if (error) {
        const msg = (error as any)?.message ?? JSON.stringify(error);
        setMessage(`Link failed: ${msg}`);
        return;
      }

      const resp = data as any;
      if (!resp?.ok) {
        setMessage(`Link failed: ${JSON.stringify(resp)}`);
        return;
      }

      setMessage('Linked successfully.');
      setAddressInput('');
      setNonce(null);
      await load();
    } catch (e: any) {
      console.error('[wallets] link exception:', e);
      setMessage(`Link failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="content-container">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Wallet Management</h1>
          <p className="text-muted-foreground mt-1">Connect and verify your crypto wallets for transaction tracking.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Link Wallet Form */}
          <div className="card-elevated p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Link New Wallet</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Enter your wallet address and sign a message to verify ownership.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Wallet Address</label>
                <Input
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="0x..."
                  className="input-field font-mono"
                />
              </div>

              <div className="flex gap-3">
                <Button onClick={handleLink} disabled={busy} className="flex-1">
                  <Link2 className="w-4 h-4 mr-2" />
                  {busy ? 'Linking...' : 'Link Wallet (PC)'}
                </Button>
                <Button onClick={handleLink} disabled={busy} variant="outline" className="flex-1">
                  {busy ? 'Linking...' : 'Link Wallet (Mobile)'}
                </Button>
              </div>

              {message && (
                <div className={`p-3 rounded-lg text-sm ${message.includes('failed') ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                  {message}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 rounded-lg bg-muted/50">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-2">How to link your wallet</p>
                  <ol className="list-decimal ml-4 space-y-1 text-muted-foreground">
                    <li>Keep your browser wallet (e.g., MetaMask) unlocked</li>
                    <li>Enter your wallet address above</li>
                    <li>Click "Link Wallet" and sign the verification message</li>
                    <li>Your wallet will be linked to your account</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Linked Wallets */}
          <div className="card-elevated p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Your Linked Wallets</h2>
            <p className="text-muted-foreground text-sm mb-4">
              {rows.length > 0 ? `You have ${rows.length} linked wallet${rows.length > 1 ? 's' : ''}.` : 'No wallets linked yet.'}
            </p>

            {rows.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">Link a wallet to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-background">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-sm text-foreground truncate">{r.address}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.verified_at ? `Verified: ${new Date(r.verified_at).toLocaleDateString()}` : 'Pending verification'}
                        </p>
                      </div>
                    </div>
                    {r.verified_at && (
                      <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
