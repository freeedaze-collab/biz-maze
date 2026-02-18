const fs = require('fs');
const raw = fs.readFileSync('sb_txs_latest.json', 'utf8');
const nonEth = raw.match(/"asset":"(?!ETH)[^"]+"/g);
if (nonEth) {
    console.log('Found non-ETH assets:', [...new Set(nonEth)]);
} else {
    console.log('No non-ETH assets found in Supabase JSON.');
}
