const https = require('https');

const data = JSON.stringify({
    table: "transactions",
    select: "description, date",
    limit: 20,
    order: "date.desc"
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
                console.log('Most recent Transactions:');
                console.log(JSON.stringify(parsed.data, null, 2));
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
