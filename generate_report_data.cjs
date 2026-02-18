const fs = require('fs');

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
                method: parts[1],
                dateTime: parts[3],
                direction: parts[5],
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

const sbRaw = JSON.parse(fs.readFileSync('sb_txs_latest.json', 'utf8'));
const sbTxs = sbRaw.transactions || [];
const ethTxs = parseCsv('etherscan_data.csv');

const sbHashes = new Set(sbTxs.map(tx => tx.tx_hash.toLowerCase()));
const sbDetailed = new Set(sbTxs.map(tx => `${tx.tx_hash.toLowerCase()}-${tx.asset}`));

const missingGtc = ethTxs.filter(tx => normalizeAsset(tx.asset) === 'GTC' && !sbDetailed.has(`${tx.hash}-GTC`));
const missingUsdc = ethTxs.filter(tx => normalizeAsset(tx.asset) === 'USDC' && !sbDetailed.has(`${tx.hash}-USDC`));

console.log('--- Missing GTC (Top 10) ---');
missingGtc.slice(0, 10).forEach(tx => console.log(`${tx.hash} | ${tx.amount} | ${sbHashes.has(tx.hash) ? 'Hash exists as ETH in SB' : 'Hash MISSING from SB'}`));

console.log('\n--- Missing USDC (Top 10) ---');
missingUsdc.slice(0, 10).forEach(tx => console.log(`${tx.hash} | ${tx.amount} | ${sbHashes.has(tx.hash) ? 'Hash exists as ETH in SB' : 'Hash MISSING from SB'}`));

const partialHashes = ethTxs.filter(tx => sbHashes.has(tx.hash) && !sbDetailed.has(`${tx.hash}-${normalizeAsset(tx.asset)}`));
console.log(`\nHashes that exist in both but are missing the token record in Supabase: ${new Set(partialHashes.map(tx => tx.hash)).size}`);
