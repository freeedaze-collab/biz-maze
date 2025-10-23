// @ts-nocheck
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, CheckCircle } from 'lucide-react';
import { useSIWE } from '@/hooks/useSIWE';
import { useToast } from '@/hooks/use-toast';

interface WalletSignatureVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  walletAddress: string;
  action: string;
  description: string;
}

export function WalletSignatureVerification({
  isOpen,
  onClose,
  onVerified,
  walletAddress,
  action,
  description
}: WalletSignatureVerificationProps) {
  const [verificationStep, setVerificationStep] = useState<'prompt' | 'signing' | 'verifying' | 'success' | 'error'>('prompt');
  const [errorMessage, setErrorMessage] = useState('');
  const { verifyWalletOwnership, isVerifying } = useSIWE();
  const { toast } = useToast();

  const handleVerify = async () => {
    setVerificationStep('signing');
    
    try {
      const isVerified = await verifyWalletOwnership(walletAddress);
      
      if (isVerified) {
        setVerificationStep('success');
        setTimeout(() => {
          onVerified();
          onClose();
          setVerificationStep('prompt');
        }, 1500);
      } else {
        setVerificationStep('error');
        setErrorMessage('Signature verification failed. Please try again.');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationStep('error');
      setErrorMessage('An error occurred during verification. Please try again.');
    }
  };

  const handleClose = () => {
    if (verificationStep !== 'signing' && verificationStep !== 'verifying') {
      onClose();
      setVerificationStep('prompt');
      setErrorMessage('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle>Security Verification Required</DialogTitle>
          </div>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {verificationStep === 'prompt' && (
            <>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  For your security, we need to verify your wallet ownership before proceeding with: <strong>{action}</strong>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Connected wallet: <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
                  </code>
                </p>
                <p className="text-sm text-muted-foreground">
                  Click "Verify Wallet" and sign the message in your wallet to continue.
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleVerify} className="flex-1">
                  <Shield className="mr-2 h-4 w-4" />
                  Verify Wallet
                </Button>
              </div>
            </>
          )}

          {verificationStep === 'signing' && (
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <div>
                <p className="font-medium">Please sign the message in your wallet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Check your wallet extension for a signature request
                </p>
              </div>
            </div>
          )}

          {verificationStep === 'verifying' && (
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <div>
                <p className="font-medium">Verifying signature...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please wait while we verify your wallet ownership
                </p>
              </div>
            </div>
          )}

          {verificationStep === 'success' && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-8 w-8 mx-auto text-green-500" />
              <div>
                <p className="font-medium text-green-700">Wallet verified successfully!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Proceeding with {action.toLowerCase()}...
                </p>
              </div>
            </div>
          )}

          {verificationStep === 'error' && (
            <>
              <Alert variant="destructive">
                <AlertDescription>
                  {errorMessage}
                </AlertDescription>
              </Alert>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleVerify} className="flex-1">
                  Try Again
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}