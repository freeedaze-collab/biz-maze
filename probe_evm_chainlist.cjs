const https = require('https');

console.log('--- Probing EVM Chain List ---');
const url = 'https://chainid.network/chains.json';

const req = https.get(url, (res) => {
    console.log(`StatusCode: ${res.statusCode}`);
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const chains = JSON.parse(data);
            console.log(`Successfully fetched ${chains.length} chains.`);

            // Test lookup for a few common chains
            const testIds = [1, 137, 43114, 8453]; // ETH, Polygon, Avax, Base
            testIds.forEach(id => {
                const chain = chains.find(c => c.chainId === id);
                if (chain) {
                    console.log(`ID ${id}: ${chain.name} -> Native Symbol: ${chain.nativeCurrency.symbol}`);
                } else {
                    console.log(`ID ${id}: Not Found`);
                }
            });

        } catch (e) {
            console.error('Error parsing JSON:', e);
        }
    });
});

req.on('error', (e) => {
    console.error('Request error:', e);
});
