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
                hash: parts[0],
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
    if (!fs.existsSync(filename)) return {};
    let content = fs.readFileSync(filename, 'utf8');
    if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
        content = content.slice(1);
    }
    try {
        return JSON.parse(content);
    } catch (e) {
        return {};
    }
}

const normalizeAsset = (asset) => {
    if (!asset) return 'UNKNOWN';
    const match = asset.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return asset.trim();
};

async function run() {
    const sbData = readJsonFile('sb_txs_latest.json');
    const sbTxs = sbData.transactions || [];
    const ethTxs = parseCsv('etherscan_data.csv');

    console.log(`Statistics: ETH=${ethTxs.length}, SB=${sbTxs.length}`);

    const sbKeys = new Set();
    sbTxs.forEach(tx => {
        const dir = tx.direction === 'WITHDRAWAL' ? 'OUT' : 'IN';
        sbKeys.add(`${tx.tx_hash}-${tx.asset}-${dir}`);
    });

    const ethKeys = new Set();
    ethTxs.forEach(tx => {
        const asset = normalizeAsset(tx.asset);
        ethKeys.add(`${tx.hash}-${asset}-${tx.direction}`);
    });

    console.log(`\n--- [ONLY IN ETHERSCAN] ---`);
    let missingCount = 0;
    ethTxs.forEach(tx => {
        const asset = normalizeAsset(tx.asset);
        const key = `${tx.hash}-${asset}-${tx.direction}`;
        if (!sbKeys.has(key)) {
            missingCount++;
            if (missingCount <= 50) {
                console.log(`${tx.hash.slice(0, 10)}... | ${asset} | ${tx.direction} | ${tx.amount}`);
            }
        }
    });

    console.log(`\n--- [ONLY IN SUPABASE] ---`);
    let extraCount = 0;
    sbTxs.forEach(tx => {
        const dir = tx.direction === 'WITHDRAWAL' ? 'OUT' : 'IN';
        const key = `${tx.tx_hash}-${tx.asset}-${dir}`;
        if (!ethKeys.has(key)) {
            extraCount++;
            if (extraCount <= 50) {
                console.log(`${tx.tx_hash.slice(0, 10)}... | ${tx.asset} | ${dir} | ${tx.amount}`);
            }
        }
    });

    console.log(`\nSummary: Missing In SB: ${missingCount}, Extra In SB: ${extraCount}`);
}

run();
