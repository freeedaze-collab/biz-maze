const fs = require('fs');
const data = JSON.parse(fs.readFileSync('sb_txs_final_check.json', 'utf8'));
const txs = data.transactions || [];

const assets = {};
txs.forEach(tx => {
    assets[tx.asset] = (assets[tx.asset] || 0) + 1;
});

console.log('--- Assets in Supabase ---');
console.log(JSON.stringify(assets, null, 2));

function parseCsv(filename) {
    if (!fs.existsSync(filename)) return [];
    let content = fs.readFileSync(filename, 'utf8');
    if (content.includes('\0')) content = fs.readFileSync(filename, 'utf16le');
    if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) content = content.slice(1);
    const lines = content.split(/\r?\n/);
    const transactions = [];
    let currentTx = null;

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('Transaction Hash,Method?,Block')) continue;
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts[0] && parts[0].startsWith('0x')) {
            currentTx = {
                hash: parts[0].toLowerCase(),
                amount: parts[7] ? parseFloat(parts[7].replace(/,/g, '')) : 0,
                asset: parts[8] || ''
            };
            if (currentTx.asset) {
                transactions.push(currentTx);
                currentTx = null;
            }
        } else if (currentTx && !parts[0] && parts[8]) {
            currentTx.asset = parts[8];
            transactions.push(currentTx);
            currentTx = null;
        }
    }
    return transactions;
}

const normalizeAsset = (asset) => {
    if (!asset) return 'UNKNOWN';
    const match = asset.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return asset.trim();
};

const ethTxs = parseCsv('etherscan_data.csv');
console.log('\n--- Etherscan Asset Counts ---');
const ethAssets = {};
ethTxs.forEach(tx => {
    const a = normalizeAsset(tx.asset);
    ethAssets[a] = (ethAssets[a] || 0) + 1;
});
console.log(JSON.stringify(ethAssets, null, 2));

const sbHashes = new Set(txs.map(t => t.tx_hash.toLowerCase()));
const missingFromEth = ethTxs.filter(tx => !sbHashes.has(tx.hash));

console.log(`\nTransactions in CSV but NOT in Supabase: ${missingFromEth.length}`);
if (missingFromEth.length > 0) {
    console.log('Samples of missing (by hash):');
    missingFromEth.slice(0, 10).forEach(m => console.log(`${m.hash} | ${m.asset} | ${m.amount}`));
}
