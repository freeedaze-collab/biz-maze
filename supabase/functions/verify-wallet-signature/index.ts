import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SiweMessage } from "npm:siwe@2.1.4"

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

    console.log('Verifying SIWE signature for address:', address);

    // Parse and verify the SIWE message
    const siweMessage = new SiweMessage(message);
    
    // Verify the signature
    const result = await siweMessage.verify({ signature });

    if (result.success) {
      console.log('SIWE verification successful for address:', address);
      
      return new Response(
        JSON.stringify({ 
          verified: true, 
          address: result.data.address,
          message: 'Wallet ownership verified successfully'
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      console.log('SIWE verification failed for address:', address, 'Error:', result.error);
      
      return new Response(
        JSON.stringify({ 
          verified: false, 
          error: 'Signature verification failed',
          details: result.error
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
        details: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})