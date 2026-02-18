// src/scripts/test_exchange_link.cjs
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = "https://yelkjimxejmrkfzeumos.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";
const SAVE_KEYS_URL = `${SUPABASE_URL}/functions/v1/exchange-save-keys`;

async function run() {
    const supabase = createClient(SUPABASE_URL, ANON_KEY);
    const email = `test_ex_${Date.now()}@example.com`;
    const password = "Password123!";

    console.log(`--- 1. Auth: ${email} ---`);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    const token = data.session.access_token;
    const userId = data.user.id;
    console.log("   [OK] Auth Success");

    console.log(`--- 2. Exchange Key Preservation (DUMMY) ---`);
    const payload = {
        exchange: "binance",
        connection_name: "Test Binance Smoke",
        api_key: "dummy_key_123",
        api_secret: "dummy_secret_abc",
        entity_id: null // entities can be optional or null for this smoke test
    };

    const saveResp = await fetch(SAVE_KEYS_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': ANON_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const saveResult = await saveResp.json();
    if (saveResp.ok && saveResult.ok) {
        console.log("✅ [SUCCESS] Exchange keys securely saved via Edge Function!");

        // 3. Verify in DB
        console.log(`--- 3. Database Integrity Check ---`);
        const { data: conn, error: connErr } = await supabase
            .from('exchange_connections')
            .select('encrypted_blob')
            .eq('user_id', userId)
            .eq('exchange', 'binance')
            .single();

        if (connErr) throw connErr;
        if (conn.encrypted_blob && conn.encrypted_blob.startsWith('v1:')) {
            console.log("✅ [SUCCESS] Database contains encrypted blob (v1: prefix confirmed).");
        } else {
            console.log("❌ [FAILED] Database blob is not in the expected secure format.", conn);
        }
    } else {
        console.log("❌ [FAILED] Edge Function rejected save request:", saveResult);
        process.exit(1);
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
