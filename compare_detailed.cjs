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
                method: parts[1],
                block: parts[2],
                dateTime: parts[3],
                from: parts[4],
                direction: parts[5],
                to: parts[6],
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

function readJsonFile(filename) {
    if (!fs.existsSync(filename)) return [];
    let content = fs.readFileSync(filename, 'utf8');
    if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
        content = content.slice(1);
    }
    try {
        const data = JSON.parse(content);
        return data.transactions || [];
    } catch (e) {
        console.error('JSON Error:', e.message);
        return [];
    }
}

const normalizeAsset = (asset) => {
    if (!asset) return 'UNKNOWN';
    const match = asset.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return asset.trim();
};

const sbTxs = readJsonFile('sb_txs_latest.json');
const ethTxs = parseCsv('etherscan_data.csv');

console.log(`Summary: Etherscan=${ethTxs.length}, Supabase=${sbTxs.length}`);

const sbByHash = new Map();
sbTxs.forEach(tx => {
    const hash = tx.tx_hash.toLowerCase();
    if (!sbByHash.has(hash)) sbByHash.set(hash, []);
    sbByHash.get(hash).push(tx);
});

const ethByHash = new Map();
ethTxs.forEach(tx => {
    const hash = tx.hash.toLowerCase();
    if (!ethByHash.has(hash)) ethByHash.set(hash, []);
    ethByHash.get(hash).push(tx);
});

let matches = 0;
let partialMatches = 0; // Hash exists, but specific (asset/dir) doesn't
let missingHashes = 0;

const missingRecords = [];
const extraRecords = [];
const matchedRecords = [];

ethTxs.forEach(eth => {
    const hash = eth.hash;
    const asset = normalizeAsset(eth.asset);
    const dir = eth.direction === 'IN' ? 'DEPOSIT' : 'WITHDRAWAL'; // Mapping Etherscan IN/OUT to SB DEPOSIT/WITHDRAWAL? 
    // Wait, let's check SB direction mapping
    // My previous script used: const dir = tx.direction === 'WITHDRAWAL' ? 'OUT' : 'IN';
    // Let's use exact comparison on asset and amount too if possible, but hash is primary.

    const sbTxList = sbByHash.get(hash) || [];
    if (sbTxList.length === 0) {
        missingRecords.push(eth);
        missingHashes++;
    } else {
        const found = sbTxList.find(sb => sb.asset === asset && Math.abs(sb.amount - eth.amount) < 0.000001);
        if (found) {
            matches++;
            matchedRecords.push({ eth, sb: found });
        } else {
            partialMatches++;
            missingRecords.push(eth);
        }
    }
});

console.log(`\nDetailed Stats:`);
console.log(`- Exact matches (Hash+Asset+Amount): ${matches}`);
console.log(`- Partial matches (Hash exists, but detail differs): ${partialMatches}`);
console.log(`- Completely missing (Hash not found): ${missingHashes}`);

console.log(`\n--- Samples of Matched Records (Success) ---`);
matchedRecords.slice(0, 10).forEach(m => {
    console.log(`MATCH: ${m.eth.hash.slice(0, 10)}... | ${m.eth.asset} | ${m.eth.amount}`);
});

console.log(`\n--- Samples of Missing Records (Etherscan Only) ---`);
missingRecords.slice(0, 20).forEach(tx => {
    console.log(`MISSING: ${tx.hash.slice(0, 10)}... | ${tx.asset} | ${tx.amount} (${sbByHash.has(tx.hash) ? 'Hash exists in SB' : 'Hash MISSING in SB'})`);
});

console.log(`\n--- Samples of Extra Records (Supabase Only) ---`);
const ethHashes = new Set(ethByHash.keys());
sbTxs.forEach(sb => {
    const hash = sb.tx_hash.toLowerCase();
    if (!ethHashes.has(hash)) {
        extraRecords.push(sb);
    } else {
        // Hash exists in ETH, but this record might be the "dummy" ETH=0 one
        const matches = ethByHash.get(hash).some(eth => normalizeAsset(eth.asset) === sb.asset && Math.abs(eth.amount - sb.amount) < 0.000001);
        if (!matches) extraRecords.push(sb);
    }
});
extraRecords.slice(0, 20).forEach(tx => {
    console.log(`EXTRA SB: ${tx.tx_hash.slice(0, 10)}... | ${tx.asset} | ${tx.amount} | ${tx.direction}`);
});
