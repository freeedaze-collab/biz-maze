// debug_tx2.cjs - Check what Etherscan returns for the problematic tx
const https = require('https')

const WALLET = '0x931896a8a9313f622a2afca76d1471b97955e551'
const TX_HASH = '0x371fb75aa6fa996e2925c1db76c9e6af177a855d7a2bc05443f4be322926f691'
const API_KEY = process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken'

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => resolve(JSON.parse(data)))
        }).on('error', reject)
    })
}

async function main() {
    // Fetch all ERC20 transfers for this wallet around block 13443079
    const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${WALLET}&startblock=13443070&endblock=13443090&sort=asc&apikey=${API_KEY}`

    console.log('Fetching ERC20 transfers around block 13443079...')
    const data = await fetch(url)

    if (data.status !== '1') {
        console.log('Error:', data.message, data.result)
        return
    }

    console.log(`Total results: ${data.result.length}`)

    // Filter to just the problematic tx
    const txTransfers = data.result.filter(t => t.hash === TX_HASH)
    console.log(`\nTransfers in tx ${TX_HASH}: ${txTransfers.length}`)

    txTransfers.forEach((t, i) => {
        console.log(`\n[${i}] logIndex=${t.logIndex} (type: ${typeof t.logIndex})`)
        console.log(`    from: ${t.from}`)
        console.log(`    to: ${t.to}`)
        console.log(`    token: ${t.tokenSymbol} (${t.contractAddress})`)
        console.log(`    value: ${parseFloat(t.value) / Math.pow(10, parseInt(t.tokenDecimal))}`)

        // Simulate the log_index calculation
        const isOut = t.from.toLowerCase() === WALLET.toLowerCase()
        const direction = isOut ? 'WITHDRAWAL' : 'DEPOSIT'

        // New hash method: tx_hash:idx
        const str = `${t.hash}:${i}`
        const hash = Math.abs(str.split('').reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0)) % 999999999 + 2
        const logIndex = t.logIndex !== undefined ? parseInt(t.logIndex) : -hash

        console.log(`    direction: ${direction}`)
        console.log(`    computed log_index: ${logIndex}`)
    })

    // Also show ALL transfers in this block range
    console.log('\n\nAll transfers in block range:')
    data.result.forEach((t, i) => {
        const isOut = t.from.toLowerCase() === WALLET.toLowerCase()
        console.log(`[${i}] ${t.hash.slice(0, 10)}... ${isOut ? 'OUT' : 'IN'} ${t.tokenSymbol} logIndex=${t.logIndex}`)
    })
}

main().catch(console.error)
