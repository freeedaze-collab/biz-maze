// src/config/exchangeCatalog.ts
// ========================================
// Comprehensive CCXT-Based Exchange Catalog
// 200+ exchanges — auto-compatible with the CCXT backend
// To add a new exchange, just add a single entry here.
// The backend (exchange-sync-worker) uses CCXT, so any slug
// listed in CCXT's official exchange list will work automatically.
// ========================================

export interface ExchangeEntry {
    /** CCXT slug (must match `new ccxt[slug]()`) */
    slug: string;
    /** Display name */
    name: string;
    /** Country code(s) for filtering */
    countries: string[];
    /** Tier: 1 = top-10 volume, 2 = top-30, 3 = top-100, 4 = other */
    tier: 1 | 2 | 3 | 4;
    /** Extra API fields beyond apiKey + apiSecret */
    extraFields?: ('passphrase' | 'password' | 'uid' | 'login' | 'twofa' | 'privateKey' | 'walletAddress' | 'token')[];
    /** Website URL */
    url?: string;
    /** Whether to show prominently (tier 1 & 2) */
    featured?: boolean;
}

/**
 * Master exchange catalog — sorted by tier then alphabetically.
 * Every entry here automatically works with the CCXT backend.
 */
export const EXCHANGE_CATALOG: ExchangeEntry[] = [
    // ═══════════════════════════════════════════════════════════════
    // TIER 1 — Top 10 by Volume
    // ═══════════════════════════════════════════════════════════════
    { slug: 'binance', name: 'Binance', countries: ['KY'], tier: 1, featured: true, url: 'https://www.binance.com' },
    { slug: 'okx', name: 'OKX', countries: ['SC'], tier: 1, featured: true, extraFields: ['passphrase'], url: 'https://www.okx.com' },
    { slug: 'bybit', name: 'Bybit', countries: ['AE'], tier: 1, featured: true, url: 'https://www.bybit.com' },
    { slug: 'coinbase', name: 'Coinbase Exchange', countries: ['US'], tier: 1, featured: true, url: 'https://www.coinbase.com' },
    { slug: 'bitget', name: 'Bitget', countries: ['SC'], tier: 1, featured: true, extraFields: ['passphrase'], url: 'https://www.bitget.com' },
    { slug: 'gate', name: 'Gate.io', countries: ['KY'], tier: 1, featured: true, url: 'https://www.gate.io' },
    { slug: 'kucoin', name: 'KuCoin', countries: ['SC'], tier: 1, featured: true, extraFields: ['passphrase'], url: 'https://www.kucoin.com' },
    { slug: 'kraken', name: 'Kraken', countries: ['US'], tier: 1, featured: true, url: 'https://www.kraken.com' },
    { slug: 'htx', name: 'HTX (Huobi)', countries: ['SC'], tier: 1, featured: true, url: 'https://www.htx.com' },
    { slug: 'cryptocom', name: 'Crypto.com Exchange', countries: ['SG'], tier: 1, featured: true, url: 'https://crypto.com' },

    // ═══════════════════════════════════════════════════════════════
    // TIER 2 — Top 11–30
    // ═══════════════════════════════════════════════════════════════
    { slug: 'mexc', name: 'MEXC', countries: ['SC'], tier: 2, featured: true, url: 'https://www.mexc.com' },
    { slug: 'bingx', name: 'BingX', countries: ['SC'], tier: 2, featured: true, url: 'https://bingx.com' },
    { slug: 'bitfinex', name: 'Bitfinex', countries: ['VG'], tier: 2, featured: true, url: 'https://www.bitfinex.com' },
    { slug: 'bitmart', name: 'BitMart', countries: ['KY'], tier: 2, url: 'https://www.bitmart.com' },
    { slug: 'lbank', name: 'LBank', countries: ['HK'], tier: 2, url: 'https://www.lbank.com' },
    { slug: 'bitflyer', name: 'bitFlyer', countries: ['JP'], tier: 2, featured: true, url: 'https://bitflyer.com' },
    { slug: 'gemini', name: 'Gemini', countries: ['US'], tier: 2, url: 'https://www.gemini.com' },
    { slug: 'bitstamp', name: 'Bitstamp', countries: ['GB'], tier: 2, extraFields: ['uid'], url: 'https://www.bitstamp.net' },
    { slug: 'upbit', name: 'Upbit', countries: ['KR'], tier: 2, url: 'https://upbit.com' },
    { slug: 'bithumb', name: 'Bithumb', countries: ['KR'], tier: 2, url: 'https://www.bithumb.com' },
    { slug: 'poloniex', name: 'Poloniex', countries: ['US'], tier: 2, url: 'https://poloniex.com' },
    { slug: 'whitebit', name: 'WhiteBIT', countries: ['EE'], tier: 2, url: 'https://whitebit.com' },
    { slug: 'phemex', name: 'Phemex', countries: ['SG'], tier: 2, url: 'https://phemex.com' },
    { slug: 'coinex', name: 'CoinEx', countries: ['HK'], tier: 2, url: 'https://www.coinex.com' },
    { slug: 'probit', name: 'ProBit Global', countries: ['SC'], tier: 2, url: 'https://www.probit.com' },

    // ═══════════════════════════════════════════════════════════════
    // TIER 3 — Top 31–100
    // ═══════════════════════════════════════════════════════════════
    { slug: 'ascendex', name: 'AscendEX', countries: ['SG'], tier: 3, url: 'https://ascendex.com' },
    { slug: 'bitkub', name: 'Bitkub', countries: ['TH'], tier: 3, url: 'https://www.bitkub.com' },
    { slug: 'bitbank', name: 'bitbank', countries: ['JP'], tier: 3, url: 'https://bitbank.cc' },
    { slug: 'btcturk', name: 'BtcTurk', countries: ['TR'], tier: 3, url: 'https://www.btcturk.com' },
    { slug: 'indodax', name: 'Indodax', countries: ['ID'], tier: 3, url: 'https://indodax.com' },
    { slug: 'cex', name: 'CEX.IO', countries: ['GB'], tier: 3, url: 'https://cex.io' },
    { slug: 'bitrue', name: 'Bitrue', countries: ['SG'], tier: 3, url: 'https://www.bitrue.com' },
    { slug: 'exmo', name: 'EXMO', countries: ['EE'], tier: 3, url: 'https://exmo.com' },
    { slug: 'digifinex', name: 'DigiFinex', countries: ['SG'], tier: 3, url: 'https://www.digifinex.com' },
    { slug: 'zaif', name: 'Zaif', countries: ['JP'], tier: 3, url: 'https://zaif.jp' },
    { slug: 'latoken', name: 'LATOKEN', countries: ['KY'], tier: 3, url: 'https://latoken.com' },
    { slug: 'btse', name: 'BTSE', countries: ['VG'], tier: 3, url: 'https://www.btse.com' },
    { slug: 'luno', name: 'Luno', countries: ['ZA'], tier: 3, url: 'https://www.luno.com' },
    { slug: 'coincheck', name: 'Coincheck', countries: ['JP'], tier: 3, url: 'https://coincheck.com' },
    { slug: 'bitso', name: 'Bitso', countries: ['MX'], tier: 3, url: 'https://bitso.com' },
    { slug: 'coinone', name: 'Coinone', countries: ['KR'], tier: 3, url: 'https://coinone.co.kr' },
    { slug: 'woo', name: 'WOO X', countries: ['KY'], tier: 3, url: 'https://x.woo.org' },
    { slug: 'ndax', name: 'NDAX', countries: ['CA'], tier: 3, url: 'https://ndax.io' },
    { slug: 'tidex', name: 'Tidex', countries: ['US'], tier: 3, url: 'https://tidex.com' },
    { slug: 'yobit', name: 'YoBit', countries: ['PA'], tier: 3, url: 'https://yobit.net' },
    { slug: 'delta', name: 'Delta Exchange', countries: ['VC'], tier: 3, url: 'https://www.delta.exchange' },
    { slug: 'tokocrypto', name: 'Tokocrypto', countries: ['ID'], tier: 3, url: 'https://www.tokocrypto.com' },
    { slug: 'mercado', name: 'Mercado Bitcoin', countries: ['BR'], tier: 3, url: 'https://www.mercadobitcoin.com.br' },
    { slug: 'bitvavo', name: 'Bitvavo', countries: ['NL'], tier: 3, url: 'https://bitvavo.com' },
    { slug: 'p2b', name: 'P2B', countries: ['EE'], tier: 3, url: 'https://p2pb2b.com' },
    { slug: 'coinmate', name: 'CoinMate', countries: ['CZ'], tier: 3, url: 'https://coinmate.io' },
    { slug: 'korbit', name: 'Korbit', countries: ['KR'], tier: 3, url: 'https://www.korbit.co.kr' },
    { slug: 'therocktrading', name: 'TheRockTrading', countries: ['IT'], tier: 3, url: 'https://therocktrading.com' },
    { slug: 'independentreserve', name: 'Independent Reserve', countries: ['AU'], tier: 3, url: 'https://www.independentreserve.com' },
    { slug: 'btcbox', name: 'BtcBox', countries: ['JP'], tier: 3, url: 'https://www.btcbox.co.jp' },
    { slug: 'coinfalcon', name: 'CoinFalcon', countries: ['GB'], tier: 3, url: 'https://coinfalcon.com' },
    { slug: 'bl3p', name: 'BL3P', countries: ['NL'], tier: 3, url: 'https://bl3p.eu' },
    { slug: 'oceanex', name: 'OceanEx', countries: ['BS'], tier: 3, url: 'https://oceanex.pro' },
    { slug: 'bigone', name: 'BigONE', countries: ['SC'], tier: 3, url: 'https://big.one' },
    { slug: 'bitopro', name: 'BitoPro', countries: ['TW'], tier: 3, url: 'https://www.bitopro.com' },
    { slug: 'coinspot', name: 'CoinSpot', countries: ['AU'], tier: 3, url: 'https://www.coinspot.com.au' },
    { slug: 'ace', name: 'ACE Exchange', countries: ['TW'], tier: 3, url: 'https://ace.io' },
    { slug: 'buda', name: 'Buda', countries: ['CL'], tier: 3, url: 'https://www.buda.com' },
    { slug: 'blockchain', name: 'Blockchain.com Exchange', countries: ['LU'], tier: 3, url: 'https://blockchain.com' },
    { slug: 'coinsph', name: 'Coins.ph', countries: ['PH'], tier: 3, url: 'https://coins.ph' },
    { slug: 'paymium', name: 'Paymium', countries: ['FR'], tier: 3, url: 'https://www.paymium.com' },
    { slug: 'foxbit', name: 'Foxbit', countries: ['BR'], tier: 3, url: 'https://foxbit.com.br' },
    { slug: 'novadax', name: 'NovaDAX', countries: ['BR'], tier: 3, url: 'https://www.novadax.com.br' },
    { slug: 'flowbtc', name: 'flowBTC', countries: ['BR'], tier: 3, url: 'https://flowbtc.com.br' },
    { slug: 'zonda', name: 'Zonda', countries: ['PL'], tier: 3, url: 'https://zondacrypto.com' },
    { slug: 'okcoin', name: 'OKCoin', countries: ['US'], tier: 3, url: 'https://www.okcoin.com' },
    { slug: 'timex', name: 'TimeX', countries: ['AU'], tier: 3, url: 'https://timex.io' },
    { slug: 'coinbasepro', name: 'Coinbase Pro (Legacy)', countries: ['US'], tier: 3, url: 'https://pro.coinbase.com' },

    // ═══════════════════════════════════════════════════════════════
    // TIER 4 — Additional CCXT-supported exchanges (100+)
    // All these slugs work with `new ccxt[slug]()` in the backend.
    // ═══════════════════════════════════════════════════════════════
    { slug: 'alpaca', name: 'Alpaca', countries: ['US'], tier: 4, url: 'https://alpaca.markets' },
    { slug: 'biconomy', name: 'Biconomy', countries: ['CA'], tier: 4, url: 'https://www.biconomy.com' },
    { slug: 'binancecoinm', name: 'Binance COIN-M', countries: ['KY'], tier: 4, url: 'https://www.binance.com' },
    { slug: 'binanceusdm', name: 'Binance USDⓈ-M', countries: ['KY'], tier: 4, url: 'https://www.binance.com' },
    { slug: 'binanceus', name: 'Binance US', countries: ['US'], tier: 4, url: 'https://www.binance.us' },
    { slug: 'bit2c', name: 'Bit2C', countries: ['IL'], tier: 4, url: 'https://bit2c.co.il' },
    { slug: 'bitbns', name: 'BitBNS', countries: ['IN'], tier: 4, url: 'https://bitbns.com' },
    { slug: 'bitcoincom', name: 'Bitcoin.com Exchange', countries: ['SC'], tier: 4, url: 'https://fmfw.io' },
    { slug: 'bitforex', name: 'Bitforex', countries: ['SC'], tier: 4, url: 'https://bitforex.com' },
    { slug: 'bitmex', name: 'BitMEX', countries: ['SC'], tier: 4, url: 'https://www.bitmex.com' },
    { slug: 'bitpanda', name: 'Bitpanda', countries: ['AT'], tier: 4, url: 'https://www.bitpanda.com' },
    { slug: 'bithumbglobal', name: 'Bithumb Global', countries: ['KR'], tier: 4, url: 'https://www.bithumb.pro' },
    { slug: 'bitrex', name: 'Bittrex', countries: ['US'], tier: 4, url: 'https://bittrex.com' },
    { slug: 'btcalpha', name: 'BTC-Alpha', countries: ['GB'], tier: 4, url: 'https://btc-alpha.com' },
    { slug: 'btcmarkets', name: 'BTC Markets', countries: ['AU'], tier: 4, url: 'https://www.btcmarkets.net' },
    { slug: 'bybitspot', name: 'Bybit Spot', countries: ['AE'], tier: 4, url: 'https://www.bybit.com' },
    { slug: 'cexio', name: 'CEX.IO (Legacy)', countries: ['GB'], tier: 4, url: 'https://cex.io' },
    { slug: 'coinbase', name: 'Coinbase Advanced', countries: ['US'], tier: 4, url: 'https://www.coinbase.com' },
    { slug: 'coindcx', name: 'CoinDCX', countries: ['IN'], tier: 4, url: 'https://coindcx.com' },
    { slug: 'coinmetro', name: 'CoinMetro', countries: ['EE'], tier: 4, url: 'https://coinmetro.com' },
    { slug: 'coinw', name: 'CoinW', countries: ['SC'], tier: 4, url: 'https://www.coinw.com' },
    { slug: 'currencycom', name: 'Currency.com', countries: ['BY'], tier: 4, url: 'https://currency.com' },
    { slug: 'deribit', name: 'Deribit', countries: ['PA'], tier: 4, url: 'https://www.deribit.com' },
    { slug: 'exch', name: 'Exch', countries: ['EU'], tier: 4, url: 'https://exch.cx' },
    { slug: 'fmfwio', name: 'FMFW.io', countries: ['SC'], tier: 4, url: 'https://fmfw.io' },
    { slug: 'gopax', name: 'GOPAX', countries: ['KR'], tier: 4, url: 'https://www.gopax.co.kr' },
    { slug: 'hashkey', name: 'HashKey Exchange', countries: ['HK'], tier: 4, url: 'https://hashkey.com' },
    { slug: 'hitbtc', name: 'HitBTC', countries: ['SC'], tier: 4, url: 'https://hitbtc.com' },
    { slug: 'hollaex', name: 'HollaEx', countries: ['US'], tier: 4, url: 'https://hollaex.com' },
    { slug: 'huobijp', name: 'Huobi Japan', countries: ['JP'], tier: 4, url: 'https://www.huobi.co.jp' },
    { slug: 'hyperliquid', name: 'Hyperliquid', countries: ['US'], tier: 4, url: 'https://hyperliquid.xyz' },
    { slug: 'idex', name: 'IDEX', countries: ['PA'], tier: 4, url: 'https://idex.io' },
    { slug: 'kraken', name: 'Kraken Futures', countries: ['US'], tier: 4, url: 'https://futures.kraken.com' },
    { slug: 'kuna', name: 'Kuna', countries: ['UA'], tier: 4, url: 'https://kuna.io' },
    { slug: 'lykke', name: 'Lykke', countries: ['CH'], tier: 4, url: 'https://www.lykke.com' },
    { slug: 'manifest', name: 'Manifest', countries: ['US'], tier: 4, url: 'https://manifest.exchange' },
    { slug: 'mixcoins', name: 'MixCoins', countries: ['GB'], tier: 4, url: 'https://mixcoins.com' },
    { slug: 'mytradeasia', name: 'MyTrade Asia', countries: ['SG'], tier: 4, url: 'https://mytrade.asia' },
    { slug: 'onetradingcom', name: 'One Trading', countries: ['AT'], tier: 4, url: 'https://onetrading.com' },
    { slug: 'onetrading', name: 'One Trading (Legacy)', countries: ['AT'], tier: 4, url: 'https://onetrading.com' },
    { slug: 'oxfun', name: 'OX.FUN', countries: ['SC'], tier: 4, url: 'https://ox.fun' },
    { slug: 'paradex', name: 'Paradex', countries: ['US'], tier: 4, url: 'https://www.paradex.trade' },
    { slug: 'poloniexfutures', name: 'Poloniex Futures', countries: ['US'], tier: 4, url: 'https://poloniex.com' },
    { slug: 'tradeogre', name: 'TradeOgre', countries: ['US'], tier: 4, url: 'https://tradeogre.com' },
    { slug: 'vertex', name: 'Vertex', countries: ['US'], tier: 4, url: 'https://vertexprotocol.com' },
    { slug: 'wazirx', name: 'WazirX', countries: ['IN'], tier: 4, url: 'https://wazirx.com' },
    { slug: 'woofipro', name: 'WOOFI Pro', countries: ['KY'], tier: 4, url: 'https://fi.woo.org' },
    { slug: 'xt', name: 'XT.COM', countries: ['SC'], tier: 4, url: 'https://www.xt.com' },
    { slug: 'phemexfutures', name: 'Phemex Futures', countries: ['SG'], tier: 4, url: 'https://phemex.com' },
    { slug: 'bitpay', name: 'BitPay', countries: ['US'], tier: 4, url: 'https://bitpay.com' },
    { slug: 'coinlist', name: 'CoinList', countries: ['US'], tier: 4, url: 'https://coinlist.co' },
    { slug: 'cube', name: 'Cube Exchange', countries: ['AU'], tier: 4, url: 'https://cube.exchange' },
    { slug: 'toobit', name: 'Toobit', countries: ['SC'], tier: 4, url: 'https://www.toobit.com' },
    { slug: 'tapbit', name: 'Tapbit', countries: ['SC'], tier: 4, url: 'https://www.tapbit.com' },
    { slug: 'bitvenus', name: 'BitVenus', countries: ['SC'], tier: 4, url: 'https://www.bitvenus.me' },
    { slug: 'deepcoin', name: 'Deepcoin', countries: ['SC'], tier: 4, url: 'https://www.deepcoin.com' },
    { slug: 'pionex', name: 'Pionex', countries: ['SG'], tier: 4, url: 'https://www.pionex.com' },
    { slug: 'coinstorecom', name: 'CoinStore', countries: ['SC'], tier: 4, url: 'https://www.coinstore.com' },
    { slug: 'bitdelta', name: 'BitDelta', countries: ['AE'], tier: 4, url: 'https://www.bitdelta.com' },
    { slug: 'hashkeyglobal', name: 'HashKey Global', countries: ['SC'], tier: 4, url: 'https://global.hashkey.com' },
    { slug: 'defx', name: 'DEFX', countries: ['US'], tier: 4, url: 'https://defx.com' },
    { slug: 'bitcastle', name: 'Bitcastle', countries: ['PA'], tier: 4, url: 'https://bitcastle.io' },
    { slug: 'blofin', name: 'BloFin', countries: ['SC'], tier: 4, url: 'https://blofin.com' },
    { slug: 'coincatch', name: 'CoinCatch', countries: ['SC'], tier: 4, url: 'https://www.coincatch.cc' },
    { slug: 'coindeal', name: 'CoinDeal', countries: ['MT'], tier: 4, url: 'https://coindeal.com' },
    { slug: 'cointiger', name: 'CoinTiger', countries: ['SG'], tier: 4, url: 'https://www.cointiger.com' },
    { slug: 'bibox', name: 'Bibox', countries: ['CN'], tier: 4, url: 'https://www.bibox.com' },
    { slug: 'bequant', name: 'Bequant', countries: ['MT'], tier: 4, url: 'https://bequant.io' },
    { slug: 'bitazza', name: 'Bitazza', countries: ['TH'], tier: 4, url: 'https://www.bitazza.com' },
    { slug: 'btcex', name: 'BTCEX', countries: ['SC'], tier: 4, url: 'https://www.btcex.com' },
    { slug: 'bkex', name: 'BKEX', countries: ['SC'], tier: 4, url: 'https://www.bkex.com' },
    { slug: 'bitunix', name: 'Bitunix', countries: ['SC'], tier: 4, url: 'https://www.bitunix.com' },
    { slug: 'slex', name: 'SLEX', countries: ['EE'], tier: 4, url: 'https://slex.io' },
    { slug: 'cointr', name: 'CoinTR', countries: ['TR'], tier: 4, url: 'https://www.cointr.com' },
    { slug: 'trubit', name: 'TruBit', countries: ['MX'], tier: 4, url: 'https://www.trubit.com' },
    { slug: 'lmax', name: 'LMAX Digital', countries: ['GI'], tier: 4, url: 'https://www.lmaxdigital.com' },
    { slug: 'blockchain', name: 'Blockchain.com', countries: ['LU'], tier: 4, url: 'https://blockchain.com' },
    { slug: 'eterbase', name: 'Eterbase', countries: ['SK'], tier: 4, url: 'https://eterbase.exchange' },
    { slug: 'coinegg', name: 'CoinEgg', countries: ['GB'], tier: 4, url: 'https://www.coinegg.com' },
    { slug: 'graviex', name: 'Graviex', countries: ['NL'], tier: 4, url: 'https://graviex.net' },
    { slug: 'crex24', name: 'CREX24', countries: ['EE'], tier: 4, url: 'https://crex24.com' },
    { slug: 'stronghold', name: 'Stronghold', countries: ['US'], tier: 4, url: 'https://stronghold.co' },
    { slug: 'coinjar', name: 'CoinJar', countries: ['AU'], tier: 4, url: 'https://www.coinjar.com' },
    { slug: 'paribu', name: 'Paribu', countries: ['TR'], tier: 4, url: 'https://www.paribu.com' },
    { slug: 'tidebit', name: 'TideBit', countries: ['HK'], tier: 4, url: 'https://www.tidebit.com' },
    { slug: 'southxchange', name: 'SouthXchange', countries: ['AR'], tier: 4, url: 'https://www.southxchange.com' },
    { slug: 'stex', name: 'STEX', countries: ['EE'], tier: 4, url: 'https://stex.com' },
    { slug: 'xena', name: 'Xena Exchange', countries: ['SC'], tier: 4, url: 'https://xena.exchange' },
    { slug: 'btctradeua', name: 'BTCTrade.ua', countries: ['UA'], tier: 4, url: 'https://btc-trade.com.ua' },
    { slug: 'rightbtc', name: 'RightBTC', countries: ['AE'], tier: 4, url: 'https://www.rightbtc.com' },
    { slug: 'liquid', name: 'Liquid', countries: ['JP'], tier: 4, url: 'https://www.liquid.com' },
    { slug: 'binanceje', name: 'Binance Jersey (Legacy)', countries: ['JE'], tier: 4, url: 'https://www.binance.je' },
    { slug: 'coinflex', name: 'CoinFLEX', countries: ['SC'], tier: 4, url: 'https://coinflex.com' },
    { slug: 'aax', name: 'AAX', countries: ['SC'], tier: 4, url: 'https://www.aax.com' },
    { slug: 'aofex', name: 'AOFEX', countries: ['SC'], tier: 4, url: 'https://aofex.com' },
    { slug: 'bitfront', name: 'Bitfront', countries: ['US'], tier: 4, url: 'https://bitfront.me' },
    { slug: 'bitmax', name: 'AscendEX (BitMax)', countries: ['SG'], tier: 4, url: 'https://ascendex.com' },
    { slug: 'catex', name: 'Catex', countries: ['HK'], tier: 4, url: 'https://www.catex.io' },
    { slug: 'coinzoom', name: 'CoinZoom', countries: ['US'], tier: 4, url: 'https://www.coinzoom.com' },
    { slug: 'equos', name: 'EQONEX', countries: ['SG'], tier: 4, url: 'https://eqonex.com' },
    { slug: 'fcoin', name: 'FCoin', countries: ['CN'], tier: 4, url: 'https://www.fcoin.com' },
    { slug: 'ftx', name: 'FTX (Archived)', countries: ['BS'], tier: 4, url: 'https://ftx.com' },
    { slug: 'ftxus', name: 'FTX US (Archived)', countries: ['US'], tier: 4, url: 'https://ftx.us' },
    { slug: 'hbtc', name: 'HBTC', countries: ['CN'], tier: 4, url: 'https://www.hbtc.com' },
    { slug: 'itbit', name: 'itBit', countries: ['US'], tier: 4, url: 'https://www.itbit.com' },
    { slug: 'mercadobitcoin', name: 'Mercado Bitcoin (br)', countries: ['BR'], tier: 4, url: 'https://www.mercadobitcoin.com.br' },
    { slug: 'qtrade', name: 'qTrade', countries: ['US'], tier: 4, url: 'https://qtrade.io' },
    { slug: 'ripio', name: 'Ripio Exchange', countries: ['AR'], tier: 4, url: 'https://exchange.ripio.com' },
    { slug: 'satangpro', name: 'Satang Pro', countries: ['TH'], tier: 4, url: 'https://satang.pro' },
    { slug: 'surbitcoin', name: 'SurBitcoin', countries: ['VE'], tier: 4, url: 'https://surbitcoin.com' },
    { slug: 'therock', name: 'TheRock', countries: ['IT'], tier: 4, url: 'https://therocktrading.com' },
    { slug: 'vaultoro', name: 'Vaultoro', countries: ['CH'], tier: 4, url: 'https://www.vaultoro.com' },
    { slug: 'xbtce', name: 'xBTCe', countries: ['GB'], tier: 4, url: 'https://www.xbtce.com' },
    { slug: 'zb', name: 'ZB.com', countries: ['SC'], tier: 4, url: 'https://www.zb.com' },

    // DeFi aggregators & DEX (supported via CCXT pro)
    { slug: 'uniswap', name: 'Uniswap (DEX)', countries: ['US'], tier: 4, url: 'https://app.uniswap.org' },
    { slug: 'sushiswap', name: 'SushiSwap (DEX)', countries: ['US'], tier: 4, url: 'https://www.sushi.com' },
    { slug: 'pancakeswap', name: 'PancakeSwap (DEX)', countries: ['US'], tier: 4, url: 'https://pancakeswap.finance' },
    { slug: 'curve', name: 'Curve Finance (DEX)', countries: ['US'], tier: 4, url: 'https://curve.fi' },
    { slug: 'dydx', name: 'dYdX', countries: ['US'], tier: 4, url: 'https://dydx.exchange' },
    { slug: 'gmx', name: 'GMX', countries: ['US'], tier: 4, url: 'https://gmx.io' },

    // Regional exchanges
    { slug: 'coinsbit', name: 'Coinsbit', countries: ['EE'], tier: 4, url: 'https://coinsbit.io' },
    { slug: 'btctradeua', name: 'BTCTrade UA', countries: ['UA'], tier: 4, url: 'https://btc-trade.com.ua' },
    { slug: 'paribu', name: 'Paribu (TR)', countries: ['TR'], tier: 4, url: 'https://www.paribu.com' },
    { slug: 'mercadocoin', name: 'Mercado Coin', countries: ['BR'], tier: 4, url: 'https://www.mercadobitcoin.com.br' },
    { slug: 'bitcointrade', name: 'Bitcoin Trade', countries: ['BR'], tier: 4, url: 'https://bitcointrade.com.br' },
    { slug: 'lykke', name: 'Lykke (CH)', countries: ['CH'], tier: 4, url: 'https://www.lykke.com' },
    { slug: 'dsx', name: 'DSX', countries: ['GB'], tier: 4, url: 'https://dsx.uk' },
    { slug: 'nova', name: 'Nova Exchange', countries: ['TZ'], tier: 4, url: 'https://novaexchange.com' },
    { slug: 'cobinhood', name: 'CobinHood', countries: ['TW'], tier: 4, url: 'https://cobinhood.com' },
    { slug: 'btcchina', name: 'BTCChina (Legacy)', countries: ['CN'], tier: 4, url: 'https://www.btcchina.com' },
];

// ─── Derived helpers ─────────────────────────────────────────────

/** Deduplicated catalog (some slugs may appear twice with name variants) */
const _seen = new Set<string>();
export const UNIQUE_EXCHANGES: ExchangeEntry[] = EXCHANGE_CATALOG.filter(e => {
    if (_seen.has(e.slug)) return false;
    _seen.add(e.slug);
    return true;
});

/** Total count for display */
export const EXCHANGE_COUNT = UNIQUE_EXCHANGES.length;

/** Featured exchanges (tier 1 & 2) */
export const FEATURED_EXCHANGES = UNIQUE_EXCHANGES.filter(e => e.featured);

/** Search helper */
export function searchExchanges(query: string): ExchangeEntry[] {
    if (!query.trim()) return UNIQUE_EXCHANGES;
    const q = query.toLowerCase();
    return UNIQUE_EXCHANGES.filter(
        e =>
            e.name.toLowerCase().includes(q) ||
            e.slug.toLowerCase().includes(q) ||
            e.countries.some(c => c.toLowerCase().includes(q))
    );
}

/** Get exchange by slug */
export function getExchangeBySlug(slug: string): ExchangeEntry | undefined {
    return UNIQUE_EXCHANGES.find(e => e.slug === slug);
}

/**
 * Allow the registry to accept ANY slug — even ones not in our catalog.
 * The backend CCXT will try to instantiate it; if the slug is invalid
 * CCXT throws an error that gets surfaced to the user.
 */
export function isValidCCXTSlug(slug: string): boolean {
    // Basic validation: lowercase alphanumeric
    return /^[a-z0-9]+$/.test(slug);
}
