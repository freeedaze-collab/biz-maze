import { useState } from 'react';
import { SiweMessage } from 'siwe';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useSIWE() {
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const generateSiweMessage = (address: string, domain: string, uri: string) => {
    const message = new SiweMessage({
      domain,
      address,
      statement: 'Sign this message to verify your wallet ownership and connect to your account.',
      uri,
      version: '1',
      chainId: 1, // Ethereum mainnet
      nonce: Math.random().toString(36).substring(2, 15),
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });

    return message.prepareMessage();
  };

  const verifySiweSignature = async (message: string, signature: string, address: string) => {
    setIsVerifying(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-wallet-signature', {
        body: { message, signature, address }
      });

      if (error) {
        throw error;
      }

      if (data?.verified) {
        toast({
          title: "✅ Wallet Verified",
          description: "Your wallet ownership has been successfully verified",
        });
        return true;
      } else {
        toast({
          title: "❌ Verification Failed",
          description: "Could not verify wallet ownership. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('SIWE verification error:', error);
      toast({
        title: "❌ Verification Error",
        description: "An error occurred during wallet verification",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const requestWalletSignature = async (address: string): Promise<string | null> => {
    try {
      const domain = window.location.host;
      const uri = window.location.origin;
      const message = generateSiweMessage(address, domain, uri);

      // Request signature from wallet (this would typically use web3 provider)
      if (typeof window.ethereum !== 'undefined') {
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, address],
        });
        return signature;
      } else {
        toast({
          title: "❌ Wallet Not Found",
          description: "Please ensure your wallet extension is installed and unlocked",
          variant: "destructive",
        });
        return null;
      }
    } catch (error) {
      console.error('Wallet signature error:', error);
      toast({
        title: "❌ Signature Failed",
        description: "Failed to get wallet signature. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const verifyWalletOwnership = async (address: string): Promise<boolean> => {
    try {
      // Generate message and request signature
      const domain = window.location.host;
      const uri = window.location.origin;
      const message = generateSiweMessage(address, domain, uri);
      
      const signature = await requestWalletSignature(address);
      if (!signature) return false;

      // Verify the signature
      return await verifySiweSignature(message, signature, address);
    } catch (error) {
      console.error('Wallet ownership verification error:', error);
      return false;
    }
  };

  return {
    isVerifying,
    verifyWalletOwnership,
    generateSiweMessage,
    verifySiweSignature,
    requestWalletSignature,
  };
}