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
const hashGroups = {};
csvTxs.forEach(tx => {
    hashGroups[tx.hash] = (hashGroups[tx.hash] || 0) + 1;
});

let multiCount = 0;
let totalEventsInMulti = 0;
console.log('--- Hashes with Multiple Transfers in CSV ---');
Object.entries(hashGroups).forEach(([hash, count]) => {
    if (count > 1) {
        multiCount++;
        totalEventsInMulti += count;
        if (multiCount <= 10) console.log(`${hash}: ${count} transfers`);
    }
});

console.log(`\nHashes with >1 transfer: ${multiCount}`);
console.log(`Total transfers involved in multi-transfer hashes: ${totalEventsInMulti}`);
console.log(`Total unique hashes: ${Object.keys(hashGroups).length}`);
console.log(`Total rows in CSV: ${csvTxs.length}`);
