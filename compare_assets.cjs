const fs = require('fs');

function parseCsv(filename) {
    if (!fs.existsSync(filename)) return [];
    let content = fs.readFileSync(filename, 'utf8');
    if (content.includes('\0')) {
        content = fs.readFileSync(filename, 'utf16le');
    }
    if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
        content = content.slice(1);
    }
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

const sbRaw = JSON.parse(fs.readFileSync('sb_txs_latest.json', 'utf8'));
const sbTxs = sbRaw.transactions || [];
const ethTxs = parseCsv('etherscan_data.csv');

const ethAssets = {};
ethTxs.forEach(tx => {
    const a = normalizeAsset(tx.asset);
    ethAssets[a] = (ethAssets[a] || 0) + 1;
});

const sbAssets = {};
sbTxs.forEach(tx => {
    sbAssets[tx.asset] = (sbAssets[tx.asset] || 0) + 1;
});

console.log('--- Assets in Etherscan ---');
console.log(JSON.stringify(ethAssets, null, 2));

console.log('\n--- Assets in Supabase ---');
console.log(JSON.stringify(sbAssets, null, 2));

// Find a hash that is in ETH (ERC20) but NOT in SB at all
const sbHashes = new Set(sbTxs.map(tx => tx.tx_hash.toLowerCase()));
const missingHashes = ethTxs.filter(tx => !sbHashes.has(tx.hash));

console.log(`\nHashes completely missing from Supabase: ${missingHashes.length}`);
if (missingHashes.length > 0) {
    console.log('Examples of missing hashes (Etherscan only):');
    missingHashes.slice(0, 10).forEach(tx => {
        console.log(`${tx.hash} | ${tx.asset}`);
    });
}
