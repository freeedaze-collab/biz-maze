const fs = require('fs');
const data = JSON.parse(fs.readFileSync('sb_txs_final_v5.json', 'utf8'));
const txs = data.transactions || [];

console.log('--- Database State ---');
console.log(`Total Records: ${txs.length}`);

const assets = {};
txs.forEach(tx => {
    assets[tx.asset] = (assets[tx.asset] || 0) + 1;
});
console.log('Assets in Supabase:', JSON.stringify(assets, null, 2));

function parseCsv(filename) {
    if (!fs.existsSync(filename)) return [];
    let content = fs.readFileSync(filename, 'utf8');
    if (content.includes('\0')) content = fs.readFileSync(filename, 'utf16le');
    if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) content = content.slice(1);
    const lines = content.split(/\r?\n/);
    const transactions = [];
    let currentHash = null;

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('Transaction Hash,Method?,Block')) continue;
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts[0] && parts[0].startsWith('0x')) {
            currentHash = parts[0].toLowerCase();
            if (parts[8]) {
                transactions.push({ hash: currentHash, asset: parts[8], amount: parts[7] });
            }
        } else if (!parts[0] && parts[8] && currentHash) {
            transactions.push({ hash: currentHash, asset: parts[8], amount: parts[7] });
        }
    }
    return transactions;
}

const csvTxs = parseCsv('etherscan_data.csv');
console.log('\n--- Etherscan CSV State ---');
console.log(`Total Records: ${csvTxs.length}`);

const normalizeAsset = (asset) => {
    if (!asset) return 'UNKNOWN';
    const match = asset.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return asset.trim();
};

const ethAssets = {};
csvTxs.forEach(tx => {
    const a = normalizeAsset(tx.asset);
    ethAssets[a] = (ethAssets[a] || 0) + 1;
});
console.log('Assets in Etherscan:', JSON.stringify(ethAssets, null, 2));

const sbHashes = new Set(txs.map(t => t.tx_hash.toLowerCase()));
const missingFromEth = csvTxs.filter(tx => !sbHashes.has(tx.hash));

console.log(`\nHashes in CSV missing from Supabase: ${missingFromEth.length}`);

const sbGrouped = {};
txs.forEach(t => {
    const key = `${t.tx_hash.toLowerCase()}|${t.asset}`;
    sbGrouped[key] = (sbGrouped[key] || 0) + 1;
});

const csvGrouped = {};
csvTxs.forEach(t => {
    const key = `${t.hash}|${normalizeAsset(t.asset)}`;
    csvGrouped[key] = (csvGrouped[key] || 0) + 1;
});

let mismatchCount = 0;
console.log('\n--- Multi-Transfer Collision Check ---');
Object.entries(csvGrouped).forEach(([key, count]) => {
    const sbCount = sbGrouped[key] || 0;
    if (count !== sbCount) {
        mismatchCount++;
        if (mismatchCount <= 5) console.log(`Mismatch for ${key}: CSV has ${count}, Supabase has ${sbCount}`);
    }
});
console.log(`Total (hash, asset) mismatches: ${mismatchCount}`);
