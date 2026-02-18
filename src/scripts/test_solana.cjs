// src/scripts/test_solana.js
const { createClient } = require('@supabase/supabase-js');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default || require('bs58');
const dotenv = require('dotenv');

dotenv.config();

const SUPABASE_URL = "https://yelkjimxejmrkfzeumos.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";
const VERIFY_WALLET_URL = `${SUPABASE_URL}/functions/v1/verify_wallet`;

async function run() {
    const supabase = createClient(SUPABASE_URL, ANON_KEY);
    const email = `test_solana_${Date.now()}@example.com`;
    const password = "Password123!";

    console.log(`--- 1. Auth: ${email} ---`);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    const token = data.session.access_token;

    console.log(`--- 2. Solana Signature Test ---`);
    const keypair = nacl.sign.keyPair();
    const address = bs58.encode(keypair.publicKey);
    console.log(`Address: ${address}`);

    const nonceResp = await fetch(VERIFY_WALLET_URL, {
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
    });
    const { nonce } = await nonceResp.json();
    console.log(`Nonce: ${nonce}`);

    const messageBytes = new TextEncoder().encode(nonce);
    const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signature = bs58.encode(signatureBytes);

    const verifyResp = await fetch(VERIFY_WALLET_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': ANON_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            address,
            signature,
            message: nonce,
            chain: 'solana',
            walletType: 'phantom'
        })
    });

    const result = await verifyResp.json();
    if (verifyResp.ok) {
        console.log("✅ [SUCCESS] Solana verification passed!");
    } else {
        console.log("❌ [FAILED] Solana verification failed:", result);
    }
}

run().catch(console.error);
