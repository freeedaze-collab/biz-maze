const https = require('https');

const data = JSON.stringify({
    table: "wallet_transactions",
    select: "asset, timestamp",
    limit: 100,
    order: "timestamp.desc"
});

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
        try {
            const parsed = JSON.parse(responseBody);
            if (parsed.success) {
                const febTxs = parsed.data.filter(t => t.timestamp && t.timestamp.startsWith('2026-02'));
                console.log('Feb 2026 Transactions Found:', febTxs.length);
                const assetDates = new Set(febTxs.map(t => `${t.asset} on ${t.timestamp.split('T')[0]}`));
                console.log('Unique Asset/Date pairs:');
                console.log(Array.from(assetDates));

                if (febTxs.length === 0 && parsed.data.length > 0) {
                    console.log('Most recent transaction:', parsed.data[0]);
                }
            } else {
                console.log('Error:', parsed.error);
            }
        } catch (e) {
            console.log('JSON Parse Error:', responseBody);
        }
    });
});

req.on('error', (e) => {
    console.error('Error:', e);
});

req.write(data);
req.end();
