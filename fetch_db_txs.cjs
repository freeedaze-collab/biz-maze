// fetch_db_txs.cjs - 現在のDBのwallet_transactionsを取得してJSONに保存
const https = require('https')
const fs = require('fs')

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const USER_ID = '61e6b197-79b3-465a-9ba7-41923b1d66ca'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars')
    process.exit(1)
}

function fetchPage(offset) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}/rest/v1/wallet_transactions`)
        url.searchParams.set('select', 'tx_hash,asset,direction,amount,chain,log_index,from_address,to_address,timestamp')
        url.searchParams.set('user_id', `eq.${USER_ID}`)
        url.searchParams.set('chain', 'eq.eth')
        url.searchParams.set('order', 'id.asc')
        url.searchParams.set('limit', '1000')
        url.searchParams.set('offset', String(offset))

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            }
        }

        https.get(options, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                try { resolve(JSON.parse(data)) }
                catch (e) { reject(e) }
            })
        }).on('error', reject)
    })
}

async function main() {
    let all = []
    let offset = 0
    while (true) {
        const page = await fetchPage(offset)
        if (!Array.isArray(page) || page.length === 0) break
        all = all.concat(page)
        console.log(`Fetched ${all.length} records...`)
        if (page.length < 1000) break
        offset += 1000
    }

    fs.writeFileSync('sb_txs_latest.json', JSON.stringify({ transactions: all }, null, 2))
    console.log(`\nSaved ${all.length} transactions to sb_txs_latest.json`)

    // サマリー
    const byTxHash = {}
    all.forEach(tx => {
        if (!byTxHash[tx.tx_hash]) byTxHash[tx.tx_hash] = []
        byTxHash[tx.tx_hash].push(tx)
    })
    const multiTransfer = Object.entries(byTxHash).filter(([, v]) => v.length > 1)
    console.log(`\nTotal: ${all.length} records`)
    console.log(`Unique tx_hash: ${Object.keys(byTxHash).length}`)
    console.log(`tx_hash with multiple transfers: ${multiTransfer.length}`)
    console.log(`Max transfers per tx: ${Math.max(...multiTransfer.map(([, v]) => v.length))}`)
}

main().catch(console.error)
