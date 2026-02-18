const https = require('https');

function queryDB(body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'yelkjimxejmrkfzeumos.supabase.co',
            port: 443,
            path: '/functions/v1/query-transactions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        };
        const req = https.request(options, res => {
            let b = '';
            res.on('data', c => b += c);
            res.on('end', () => resolve(JSON.parse(b)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    // Get ALL wallet transactions from DB  
    const result = await queryDB({
        table: 'wallet_transactions',
        select: 'id,tx_hash,asset,amount,timestamp,historical_price_unit,value_in_usd',
        limit: 1000
    });

    if (!result.data) {
        console.log('Error:', JSON.stringify(result));
        return;
    }

    const dbTxs = result.data;

    // Also get all_transactions view
    const viewResult = await queryDB({
        table: 'all_transactions',
        select: 'id,reference_id,asset,amount,value_usd,date,source',
        limit: 1000
    });
    const viewTxs = viewResult.data || [];

    // These are the known Etherscan tx hashes from the spreadsheet (first ~50)
    const etherscanHashes = [
        '0xf845e5c07301f508aa60b46460bbe33cc8db1829408c8ec19904fa6e74d199fc', // 2026/1/23 GTC 8.8M
        '0x88ec882fac9d1842fe3eff0af9e5753ac77a5d8fd6ee1a3b60e38256dc6bfdbe', // 2026/1/8 GTC 1.7M
        '0x269e380254f7d869c98a8ec585cafe7d00872d9a5a1e94fc1a25c94ccfe78855', // 2025/11/11 GTC 10K
        '0xf74957c35df4f4f30ff2acfcbf094edb55e47da4263b50262dc212524dbeddfc', // 2025/11/7 GTC 182K
        '0x7f8960e6cfd6593b29ece5a0c6f60870eedbb61d4f2ac89f6f414c5d9e241f2c', // 2025/8/28 USDC 353K
        '0x2b00ac92db2f3a80dd23fd1ad832a80c07214e9a64b3446e93455b686b5bc0a2', // 2025/8/13 USDC+GTC
        '0x066c484fbe46b69447178d2f8f31b6d995c032f67f7b84d68afce0f8cffdf0ce', // 2025/8/13 USDC+GTC
        '0x95111035c193a3fa775e815d628f908e844e97f622b3e906f42be8960003333c', // 2025/7/29 USDC 36K
        '0x920bdba0d0123ddab6837406afed673bbdc109475f82721134cdeb7b3a146535', // 2025/7/29 GTC 2.1M
        '0x96da926a3f2e3c2e87cee7f57ec172cd8b0968e76458dd0c1763b9e4d813b1f5', // 2025/7/2 GTC multi
        '0x5df3c1aa5bc2f9381f5010cd38cbf69c95ffe983ff89d5377172a839ff2fa00a', // 2025/6/5 GTC 3.3M
        '0x0d1716088d217e4f85ad5511bdb58fd80a1e00993d85ba40706e2f10ee46e890', // 2025/5/28 USDC 440K
        '0xffce7e53a06503eb084617d7e16a4affc35d11bd2d2ac86211cc01db0971d748', // 2025/3/31 GTC 1.2M
        '0x0f1c51e8a10c4381c6cd36b2103f8a9edddc039be473283593daad478fc2f74c', // 2025/4/28 GTC 310K
        '0xafbe5495cc84ef76d1c668acb3bc7bea6be6d48980e32caa220d5eb816b89aab', // 2025/4/15 GTC 2.4M
    ];

    console.log('=== ETHERSCAN vs SUPABASE COMPARISON ===\n');

    const dbHashSet = new Set(dbTxs.map(t => t.tx_hash?.toLowerCase()));
    const viewHashSet = new Set(viewTxs.map(t => t.reference_id?.toLowerCase()));

    let missing = 0;
    let present = 0;
    let inWalletNotView = 0;

    for (const hash of etherscanHashes) {
        const inDB = dbHashSet.has(hash.toLowerCase());
        const inView = viewHashSet.has(hash.toLowerCase());

        if (!inDB) {
            console.log(`❌ MISSING from wallet_transactions: ${hash.substring(0, 20)}...`);
            missing++;
        } else if (!inView) {
            console.log(`⚠️  In wallet_transactions but NOT in view: ${hash.substring(0, 20)}...`);
            inWalletNotView++;
        } else {
            // Find view entry to check value_usd
            const viewEntry = viewTxs.filter(t => t.reference_id?.toLowerCase() === hash.toLowerCase());
            const allPriced = viewEntry.every(e => parseFloat(e.value_usd) > 0.01);
            const zeroEntries = viewEntry.filter(e => Math.abs(parseFloat(e.value_usd)) < 0.01);

            if (zeroEntries.length > 0) {
                console.log(`⚠️  Has $0 entries: ${hash.substring(0, 20)}...`);
                for (const z of zeroEntries) {
                    console.log(`    ${z.asset} | amt=${z.amount} | usd=$${z.value_usd}`);
                }
            }
            present++;
        }
    }

    console.log(`\nSummary: ${present} present, ${missing} missing, ${inWalletNotView} in-wallet-not-view`);

    // BROADER CHECK: How many view entries have value_usd = 0 for non-spam tokens?
    console.log('\n\n=== ALL VIEW ENTRIES WITH $0 (non-spam, non-zero-amount) ===');
    const LEGITIMATE_PATTERN = /^[A-Z0-9]{1,10}$/;
    const KNOWN_SPAM = ['SMEGMA', 'SLOINK', 'STEAK', 'SPARK', 'JUNFOX', 'ESTHER', 'TSLA', 'PEIPEIEW', 'PORKWIFHAT', 'HQG'];

    const problemEntries = viewTxs.filter(t => {
        const usd = parseFloat(t.value_usd) || 0;
        const amt = parseFloat(t.amount) || 0;
        const asset = (t.asset || '').toUpperCase();
        return Math.abs(usd) < 0.01 && amt > 0 && LEGITIMATE_PATTERN.test(asset) && !KNOWN_SPAM.includes(asset);
    });

    console.log(`Found ${problemEntries.length} entries:\n`);
    for (const t of problemEntries) {
        console.log(`  ${t.asset.padEnd(8)} | amt=${String(t.amount).padEnd(20)} | usd=$${t.value_usd} | ${t.date?.substring(0, 19)} | ref=${t.reference_id?.substring(0, 20)} | source=${t.source}`);
    }
}

main().catch(console.error);
