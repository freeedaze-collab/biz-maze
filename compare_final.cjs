// compare_final.cjs
// etherscan_data.csv (スプレッドシート) と DB の366件を比較
// DB側はSQLで取得したデータをJSONとして渡す想定だが、
// まずCSVの全tx_hashリストを出力して、DBと突き合わせるSQLを生成する

const fs = require('fs')

function parseCsv(filename) {
    let content
    try {
        // UTF-16 LE (Excelエクスポート形式)
        const buf = fs.readFileSync(filename)
        if (buf[0] === 0xFF && buf[1] === 0xFE) {
            content = buf.toString('utf16le').slice(1) // BOM除去
        } else if (buf[0] === 0xFE && buf[1] === 0xFF) {
            content = buf.toString('utf16le')
        } else {
            content = buf.toString('utf8')
        }
    } catch (e) {
        console.error('Failed to read file:', e.message)
        return []
    }

    const lines = content.split(/\r?\n/)
    const rows = []
    let currentHash = null

    for (let line of lines) {
        line = line.trim()
        if (!line) continue
        if (line.startsWith('Transaction Hash')) continue

        // CSVパース（クォート対応）
        const parts = []
        let inQuote = false
        let cur = ''
        for (let i = 0; i < line.length; i++) {
            const c = line[i]
            if (c === '"') { inQuote = !inQuote }
            else if (c === ',' && !inQuote) { parts.push(cur.trim()); cur = '' }
            else { cur += c }
        }
        parts.push(cur.trim())

        if (parts[0] && parts[0].startsWith('0x')) {
            // 新しいtx行
            currentHash = parts[0]
            const direction = parts[5] || ''
            const amount = parts[7] ? parseFloat(parts[7].replace(/,/g, '')) : 0
            const token = parts[8] || ''

            if (token) {
                rows.push({ hash: currentHash, direction, amount, token: token.trim() })
                currentHash = null
            }
            // tokenが次行にある場合はcurrentHashを保持
        } else if (currentHash && parts[8]) {
            // 継続行（tokenが次行）
            const direction = parts[5] || rows.length > 0 ? '' : ''
            // 前の行のdirectionを使う必要があるので、別アプローチ
            rows.push({ hash: currentHash, direction: '?', amount: 0, token: parts[8].trim() })
            currentHash = null
        }
    }
    return rows
}

// より正確なパーサー
function parseCsvV2(filename) {
    let content
    const buf = fs.readFileSync(filename)
    if (buf[0] === 0xFF && buf[1] === 0xFE) {
        content = buf.slice(2).toString('utf16le')
    } else if (buf.includes(Buffer.from('\0', 'utf8'))) {
        content = buf.toString('utf16le')
    } else {
        content = buf.toString('utf8')
    }
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)

    const lines = content.split(/\r?\n/)
    const rows = []
    let pending = null  // {hash, direction, amount}

    for (let line of lines) {
        line = line.trim()
        if (!line) continue
        if (line.startsWith('Transaction Hash')) continue

        const parts = []
        let inQuote = false, cur = ''
        for (let i = 0; i < line.length; i++) {
            const c = line[i]
            if (c === '"') inQuote = !inQuote
            else if (c === ',' && !inQuote) { parts.push(cur.trim()); cur = '' }
            else cur += c
        }
        parts.push(cur.trim())

        if (parts[0] && parts[0].startsWith('0x')) {
            const hash = parts[0]
            const direction = (parts[5] || '').trim()
            const amount = parts[7] ? parseFloat(parts[7].replace(/,/g, '')) : 0
            const token = (parts[8] || '').trim()

            if (token) {
                rows.push({ hash, direction, amount, token })
                pending = null
            } else {
                pending = { hash, direction, amount }
            }
        } else if (pending) {
            const token = (parts[8] || '').trim()
            if (token) {
                rows.push({ ...pending, token })
            }
            pending = null
        }
    }
    return rows
}

const csvRows = parseCsvV2('etherscan_data.csv')
console.log(`CSV total rows: ${csvRows.length}`)

// tx_hash ごとの集計
const byHash = {}
csvRows.forEach(r => {
    if (!byHash[r.hash]) byHash[r.hash] = []
    byHash[r.hash].push(r)
})

console.log(`Unique tx_hash in CSV: ${Object.keys(byHash).length}`)
console.log(`\nTop 10 by transfer count:`)
Object.entries(byHash)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .forEach(([hash, txs]) => {
        const tokens = [...new Set(txs.map(t => t.token))]
        console.log(`  ${hash.slice(0, 12)}... cnt=${txs.length} tokens=${tokens.join(',')}`)
    })

// DBに入れるべき全tx_hashリストを出力
const allHashes = Object.keys(byHash)
console.log(`\n-- SQL to check missing in DB --`)
console.log(`SELECT tx_hash, COUNT(*) as db_cnt`)
console.log(`FROM wallet_transactions`)
console.log(`WHERE user_id = '61e6b197-79b3-465a-9ba7-41923b1d66ca'`)
console.log(`  AND chain = 'eth'`)
console.log(`  AND tx_hash IN (`)
// 最初の20件だけ表示
allHashes.slice(0, 20).forEach((h, i) => {
    console.log(`  '${h}'${i < Math.min(19, allHashes.length - 1) ? ',' : ''}`)
})
console.log(`)`)
console.log(`GROUP BY tx_hash`)
console.log(`ORDER BY db_cnt DESC;`)

// CSV件数とDB期待件数の差分
console.log(`\n-- Expected DB count by tx_hash (from CSV) --`)
Object.entries(byHash)
    .filter(([, v]) => v.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20)
    .forEach(([hash, txs]) => {
        console.log(`  ${hash.slice(0, 12)}... expected=${txs.length}`)
    })
