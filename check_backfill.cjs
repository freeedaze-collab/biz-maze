const https = require('https');

function query(table, select) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ table, select, limit: 1000 });
        const options = {
            hostname: 'yelkjimxejmrkfzeumos.supabase.co', port: 443,
            path: '/functions/v1/query-transactions', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        };
        const req = https.request(options, (res) => {
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
    const res = await query('wallet_transactions', 'id,asset,amount,historical_price_unit,timestamp');
    const txs = res.data || [];

    const isLegit = (sym) => sym && sym.length <= 10 && /^[A-Z0-9]+$/.test(sym.toUpperCase());

    const legit = txs.filter(t => isLegit(t.asset));
    const spam = txs.filter(t => !isLegit(t.asset));
    const legitPriced = legit.filter(t => t.historical_price_unit != null);
    const legitUnpriced = legit.filter(t => t.historical_price_unit == null);

    // Filter out known spam tokens by name
    const KNOWN_SPAM = ['SLOINK', 'SMEGMA', 'STEAK', 'SPARK', 'JUNFOX', 'ESTHER', 'TSLA', 'PEIPEIEW', 'PORKWIFHAT', 'HQG'];
    const realUnpriced = legitUnpriced.filter(t => !KNOWN_SPAM.includes(t.asset?.toUpperCase()));
    const spamUnpriced = legitUnpriced.filter(t => KNOWN_SPAM.includes(t.asset?.toUpperCase()));

    console.log('=== FINAL COVERAGE REPORT ===');
    console.log(`Total wallet_transactions: ${txs.length}`);
    console.log(`Spam (URL/unicode symbols): ${spam.length}`);
    console.log(`Spam (short names, airdrop scams): ${spamUnpriced.length}`);
    console.log(`Legitimate tokens: ${legit.length - spamUnpriced.length}`);
    console.log(`  Priced: ${legitPriced.length}`);
    console.log(`  Unpriced: ${realUnpriced.length}`);
    console.log(`Coverage: ${(legitPriced.length / (legit.length - spamUnpriced.length) * 100).toFixed(1)}%`);

    if (realUnpriced.length > 0) {
        console.log('\nStill unpriced:');
        for (const t of realUnpriced) console.log(`  ${t.asset} amt=${t.amount} ts=${t.timestamp?.substring(0, 19)}`);
    }

    // Exchange
    const eres = await query('exchange_trades', 'trade_id,symbol,value_usd');
    const etrades = eres.data || [];
    const ePriced = etrades.filter(t => t.value_usd != null).length;
    console.log(`\nExchange: ${etrades.length} total, ${ePriced} priced (${(ePriced / etrades.length * 100).toFixed(0)}%)`);
}

main().catch(console.error);
