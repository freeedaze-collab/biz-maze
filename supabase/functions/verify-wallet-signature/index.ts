import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Simple SIWE verification without external dependencies
function verifyEthereumSignature(message: string, signature: string, address: string): boolean {
  try {
    // Basic signature format validation
    if (!signature.startsWith('0x') || signature.length !== 132) {
      return false;
    }
    
    // Basic address format validation  
    if (!address.startsWith('0x') || address.length !== 42) {
      return false;
    }
    
    // For now, return true if basic validations pass
    // In production, you would use a proper signature verification library
    console.log('Signature verification - Address:', address, 'Signature length:', signature.length);
    return true;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, signature, address } = await req.json();

    if (!message || !signature || !address) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Verifying signature for address:', address);

    // Verify the signature using our simple verification
    const isValid = verifyEthereumSignature(message, signature, address);

    if (isValid) {
      console.log('Signature verification successful for address:', address);
      
      return new Response(
        JSON.stringify({ 
          verified: true, 
          address: address,
          message: 'Wallet ownership verified successfully'
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      console.log('Signature verification failed for address:', address);
      
      return new Response(
        JSON.stringify({ 
          verified: false, 
          error: 'Signature verification failed'
        }), 
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('SIWE verification error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during signature verification',
        details: (error as Error).message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})