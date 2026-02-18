const fs = require('fs');

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
                transactions.push({ hash: currentHash, asset: parts[8] });
            }
        } else if (!parts[0] && parts[8] && currentHash) {
            transactions.push({ hash: currentHash, asset: parts[8] });
        }
    }
    return transactions;
}

const csvTxs = parseCsv('etherscan_data.csv');
const collisionGroups = {};
csvTxs.forEach(tx => {
    const key = `${tx.hash}|${tx.asset}`;
    collisionGroups[key] = (collisionGroups[key] || 0) + 1;
});

let sameAssetCollisionCount = 0;
console.log('--- Same-Asset Collisions in CSV (Same Hash + Same Asset) ---');
Object.entries(collisionGroups).forEach(([key, count]) => {
    if (count > 1) {
        const [hash, asset] = key.split('|');
        sameAssetCollisionCount += (count - 1);
        if (sameAssetCollisionCount <= 10) console.log(`${hash} | ${asset}: ${count} transfers`);
    }
});

console.log(`\nTotal same-asset collision potential: ${sameAssetCollisionCount}`);
console.log(`Total unique (hash, asset) pairs: ${Object.keys(collisionGroups).length}`);
console.log(`Total rows in CSV: ${csvTxs.length}`);
