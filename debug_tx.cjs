// debug_tx.cjs - 問題の tx_hash で Etherscan API が何を返すか確認
// Usage: ETHERSCAN_API_KEY=xxx node debug_tx.cjs

const API_KEY = process.env.ETHERSCAN_API_KEY
const WALLET = '0x931896a8a9313f622a2afca76d1471b97955e551'
const TX_HASH = '0x371fb75aa6fa996e2925c1db76c9e6af177a855d7a2bc05443f4be322926f691'

if (!API_KEY) {
    console.error('ETHERSCAN_API_KEY が設定されていません')
    console.error('Usage: ETHERSCAN_API_KEY=xxx node debug_tx.cjs')
    process.exit(1)
}

async function main() {
    // 1. tokentx で wallet のトランザクション一覧を取得（ページ1）
    // Etherscan は txhash フィルタをサポートしていないので、全件取得してフィルタ
    console.log('=== ERC20 transfers for wallet (page 1-3) ===')

    for (let page = 1; page <= 3; page++) {
        const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${WALLET}&page=${page}&offset=1000&sort=asc&apikey=${API_KEY}`
        const res = await fetch(url)
        const data = await res.json()

        if (data.status !== '1' || !Array.isArray(data.result)) {
            console.log(`Page ${page}: ${data.message}`)
            break
        }

        // 問題の tx_hash に絞り込み
        const matching = data.result.filter(tx => tx.hash === TX_HASH)
        if (matching.length > 0) {
            console.log(`\n=== Page ${page}: Found ${matching.length} transfers for tx ${TX_HASH} ===`)
            for (const tx of matching) {
                console.log({
                    hash: tx.hash,
                    tokenSymbol: tx.tokenSymbol,
                    tokenName: tx.tokenName,
                    from: tx.from,
                    to: tx.to,
                    value: tx.value,
                    tokenDecimal: tx.tokenDecimal,
                    logIndex: tx.logIndex,
                    blockNumber: tx.blockNumber,
                    timeStamp: tx.timeStamp,
                    isWalletFrom: tx.from?.toLowerCase() === WALLET.toLowerCase(),
                    isWalletTo: tx.to?.toLowerCase() === WALLET.toLowerCase(),
                    amount: parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal || '18'))
                })
            }
        } else {
            console.log(`Page ${page}: ${data.result.length} txs, none matching`)
        }

        if (data.result.length < 1000) break
        await new Promise(r => setTimeout(r, 1200))
    }

    // 2. 同じ tx_hash の native tx も確認
    console.log('\n=== Native ETH tx for same hash ===')
    const nativeUrl = `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_getTransactionByHash&txhash=${TX_HASH}&apikey=${API_KEY}`
    const nativeRes = await fetch(nativeUrl)
    const nativeData = await nativeRes.json()
    if (nativeData.result) {
        console.log({
            hash: nativeData.result.hash,
            from: nativeData.result.from,
            to: nativeData.result.to,
            value: parseInt(nativeData.result.value, 16) / 1e18,
            blockNumber: parseInt(nativeData.result.blockNumber, 16)
        })
    }

    // 3. tx receipt の logs を確認（全 ERC20 transfer events）
    console.log('\n=== Transaction Receipt Logs (all ERC20 Transfer events) ===')
    const receiptUrl = `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_getTransactionReceipt&txhash=${TX_HASH}&apikey=${API_KEY}`
    const receiptRes = await fetch(receiptUrl)
    const receiptData = await receiptRes.json()
    if (receiptData.result?.logs) {
        // ERC20 Transfer event topic
        const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
        const transferLogs = receiptData.result.logs.filter(log => log.topics[0] === TRANSFER_TOPIC)
        console.log(`Total logs: ${receiptData.result.logs.length}, Transfer events: ${transferLogs.length}`)
        for (const log of transferLogs) {
            const from = '0x' + log.topics[1].slice(26)
            const to = '0x' + log.topics[2].slice(26)
            const value = BigInt(log.data)
            const isWalletInvolved = from.toLowerCase() === WALLET.toLowerCase() || to.toLowerCase() === WALLET.toLowerCase()
            console.log({
                logIndex: parseInt(log.logIndex, 16),
                address: log.address,  // token contract
                from,
                to,
                value: value.toString(),
                isWalletInvolved,
                direction: to.toLowerCase() === WALLET.toLowerCase() ? 'IN' : 'OUT'
            })
        }
    }
}

main().catch(console.error)
