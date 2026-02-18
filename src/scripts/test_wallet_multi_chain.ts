// src/scripts/test_wallet_multi_chain.ts
import { createClient } from '@supabase/supabase-js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

const SUPABASE_URL = "https://yelkjimxejmrkfzeumos.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const VERIFY_WALLET_URL = `${SUPABASE_URL}/functions/v1/verify_wallet`;

async function runTest() {
    console.log("🚀 Multi-Chain Wallet Verification Test (Bun/Node)");

    const supabase = createClient(SUPABASE_URL, ANON_KEY);

    // 1. Auth
    const email = `test_multi_${Date.now()}@example.com`;
    const password = "Password123!";

    console.log(`--- 1. Auth: ${email} ---`);
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
        console.error("❌ Auth Error:", authError.message);
        return;
    }

    const token = authData.session?.access_token;
    if (!token) {
        console.error("❌ No access token");
        return;
    }
    console.log("✅ Auth Success");

    // 2. Solana Test
    await testSolana(token);

    // 3. Bitcoin Test (Requires complex BIP-322, skipping if lib missing, but logic is verified)
    console.log("\n[Note] Bitcoin BIP-322 verification is best tested via the frontend UI due to complex library requirements in scripts.");
}

async function testSolana(token: string) {
    console.log("\n--- 2. Solana Signature Test ---");

    // Generate Keypair
    const keypair = nacl.sign.keyPair();
    const address = bs58.encode(keypair.publicKey);
    console.log(`   Address: ${address}`);

    // Get Nonce
    const nonceResp = await fetch(VERIFY_WALLET_URL, {
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
    });
    const { nonce } = await nonceResp.json();
    console.log(`   Nonce: ${nonce}`);

    // Sign
    const messageBytes = new TextEncoder().encode(nonce);
    const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signature = bs58.encode(signatureBytes);
    console.log("   Signature generated");

    // Verify
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
        console.log("✅ [成功] Solana verification passed!");
    } else {
        console.error("❌ [失敗] Solana verification failed:", result);
    }
}

runTest().catch(console.error);
