// check_logindex.cjs - Etherscan API の logIndex 実値を確認
const https = require('https')

const WALLET = '0x931896a897955e551e4b8f8b8b8b8b8b8b8b8b8b'
// 実際のウォレットアドレスを環境変数から取得するか直接指定
// スプレッドシートから: 0x931896A8...97955e551
const WALLET_ADDR = process.env.WALLET_ADDR || '0x931896a897955e551'
const API_KEY = process.env.ETHERSCAN_API_KEY || ''

// 問題の tx が含まれるブロック周辺を取得
const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${WALLET_ADDR}&startblock=13443000&endblock=13443200&sort=asc&apikey=${API_KEY}`

console.log('Fetching:', url.replace(API_KEY, 'REDACTED'))

https.get(url, (res) => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
        const json = JSON.parse(data)
        if (!Array.isArray(json.result)) {
            console.log('Error:', json)
            return
        }
        console.log(`Total results: ${json.result.length}`)
        for (const tx of json.result) {
            console.log(JSON.stringify({
                hash: tx.hash?.substring(0, 20),
                token: tx.tokenSymbol,
                from: tx.from?.substring(0, 12),
                to: tx.to?.substring(0, 12),
                value: tx.value,
                logIndex: tx.logIndex,
                logIndex_type: typeof tx.logIndex,
                logIndex_raw: JSON.stringify(tx.logIndex),
            }))
        }
    })
}).on('error', e => console.error(e))
