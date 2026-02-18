const fs = require('fs');
const data = JSON.parse(fs.readFileSync('sb_full_dump.json', 'utf8'));
const txs = data.transactions || [];

console.log('=== Supabase Full Audit (366 Records) ===');
console.log(`Total Records: ${txs.length}`);

// Asset counts
const assets = {};
txs.forEach(tx => {
    assets[tx.asset] = (assets[tx.asset] || 0) + 1;
});
console.log('\n--- Asset Distribution (Supabase) ---');
Object.entries(assets).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`${k}: ${v}`);
});

// Check for duplicates (same hash, asset, direction, log_index)
const uniqueKeys = new Set();
const duplicates = [];
txs.forEach(tx => {
    const key = `${tx.tx_hash}|${tx.asset}|${tx.direction}|${tx.log_index}`;
    if (uniqueKeys.has(key)) {
        duplicates.push(tx);
    } else {
        uniqueKeys.add(key);
    }
});
console.log(`\nDuplicates found: ${duplicates.length}`);

// Compare with CSV
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

const normalizeAsset = (asset) => {
    if (!asset) return 'UNKNOWN';
    const match = asset.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return asset.trim();
};

const csvTxs = parseCsv('etherscan_data.csv');
const csvAssets = {};
csvTxs.forEach(tx => {
    const a = normalizeAsset(tx.asset);
    csvAssets[a] = (csvAssets[a] || 0) + 1;
});

console.log('\n--- Asset Distribution (CSV) ---');
Object.entries(csvAssets).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`${k}: ${v}`);
});

// Find missing USDC
const sbUsdcHashes = new Set(txs.filter(t => t.asset === 'USDC').map(t => t.tx_hash.toLowerCase()));
const missingUsdc = csvTxs.filter(tx => normalizeAsset(tx.asset) === 'USDC' && !sbUsdcHashes.has(tx.hash));

console.log(`\nUSDC hashes in CSV missing from Supabase: ${missingUsdc.length}`);
if (missingUsdc.length > 0) {
    console.log('Sample missing USDC hash:', missingUsdc[0].hash);
}

// Explain the 366 count
const inCsvHashes = new Set(csvTxs.map(tx => tx.hash.toLowerCase()));
const extraInSb = txs.filter(tx => !inCsvHashes.has(tx.tx_hash.toLowerCase()));
console.log(`\nRecords in Supabase NOT in CSV: ${extraInSb.length}`);
if (extraInSb.length > 0) {
    console.log('Example extra asset:', extraInSb[0].asset);
}
