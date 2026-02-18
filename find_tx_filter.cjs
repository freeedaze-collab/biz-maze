const https = require('https');

async function checkTable(table, dateCol) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            table: table,
            select: "*",
            limit: 10,
            filter: `${dateCol}.gte.2026-02-09T00:00:00Z`
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
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    const p = JSON.parse(body);
                    resolve({ table, data: p.data || [], error: p.error });
                } catch (e) {
                    resolve({ table, error: 'Parse error' });
                }
            });
        });
        req.on('error', e => resolve({ table, error: e.message }));
        req.write(data);
        req.end();
    });
}

async function main() {
    const results = await Promise.all([
        checkTable('wallet_transactions', 'timestamp'),
        checkTable('exchange_trades', 'ts'),
    ]);
    console.log(JSON.stringify(results, null, 2));
}

main();
