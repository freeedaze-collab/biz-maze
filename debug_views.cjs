const fs = require('fs');
const https = require('https');

async function runSql(sql) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ query: sql });
        const options = {
            hostname: 'yelkjimxejmrkfzeumos.supabase.co',
            port: 443,
            path: '/functions/v1/query-transactions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`Status ${res.statusCode}: ${responseBody}`));
                } else {
                    try {
                        resolve(JSON.parse(responseBody));
                    } catch (e) {
                        reject(new Error(`JSON Parse Error: ${responseBody}`));
                    }
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    try {
        // 1. Check v_holdings
        console.log('--- Checking v_holdings ---');
        const holdings = await runSql('SELECT * FROM public.v_holdings');
        console.log(JSON.stringify(holdings, null, 2));

        // 2. Check all_transactions (sample)
        console.log('\n--- Checking all_transactions (GTC samples) ---');
        const allTxs = await runSql("SELECT id, date, asset, amount, value_usd, description FROM public.all_transactions WHERE asset = 'GTC' LIMIT 5");
        console.log(JSON.stringify(allTxs, null, 2));

        // 3. Check wallet_transactions raw (GTC samples)
        console.log('\n--- Checking wallet_transactions raw (GTC samples) ---');
        const walletTxs = await runSql("SELECT asset, amount, value_in_usd, asset_symbol, value_wei FROM public.wallet_transactions WHERE asset = 'GTC' LIMIT 5");
        console.log(JSON.stringify(walletTxs, null, 2));

    } catch (e) {
        console.error('Fatal Error:', e.message);
    }
}

main();
