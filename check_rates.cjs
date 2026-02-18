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
    // Check what currencies exist in daily_exchange_rates
    const result = await queryDB({
        table: 'daily_exchange_rates',
        select: 'source_currency,target_currency,rate,date',
        limit: 200
    });

    if (!result.data) {
        console.log('Error:', JSON.stringify(result));
        return;
    }

    // Group by source_currency -> target_currency
    const groups = {};
    result.data.forEach(r => {
        const key = `${r.source_currency} -> ${r.target_currency}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ rate: r.rate, date: r.date });
    });

    console.log('=== EXCHANGE RATES IN DATABASE ===');
    console.log(`Total records fetched: ${result.data.length}`);
    console.log('');

    Object.keys(groups).sort().forEach(key => {
        const records = groups[key].sort((a, b) => b.date.localeCompare(a.date));
        console.log(`${key}: ${records.length} records`);
        records.slice(0, 3).forEach(r => {
            console.log(`  ${r.date} => ${r.rate}`);
        });
    });

    // Also check total count per target_currency for USD source
    console.log('\n=== USD SOURCE RATES SUMMARY ===');
    const usdRates = result.data.filter(r => r.source_currency === 'USD');
    const byTarget = {};
    usdRates.forEach(r => {
        if (!byTarget[r.target_currency]) byTarget[r.target_currency] = 0;
        byTarget[r.target_currency]++;
    });
    Object.keys(byTarget).sort().forEach(t => {
        console.log(`  USD -> ${t}: ${byTarget[t]} records`);
    });

    // Check crypto rates (e.g. ETH -> USD, GTC -> USD)
    console.log('\n=== CRYPTO RATES (non-USD source) ===');
    const cryptoRates = result.data.filter(r => r.source_currency !== 'USD');
    const byCrypto = {};
    cryptoRates.forEach(r => {
        const key = `${r.source_currency} -> ${r.target_currency}`;
        if (!byCrypto[key]) byCrypto[key] = { count: 0, latest: null };
        byCrypto[key].count++;
        if (!byCrypto[key].latest || r.date > byCrypto[key].latest.date) byCrypto[key].latest = r;
    });
    Object.keys(byCrypto).sort().forEach(k => {
        const info = byCrypto[k];
        console.log(`  ${k}: ${info.count} records, latest: ${info.latest.date} => ${info.latest.rate}`);
    });
}

main().catch(console.error);
