const https = require('https');

const apiKey = process.env.ETHERSCAN_API_KEY || '';
const walletAddress = '0x931896A8A9313F622a2AFCA76d1471B97955e551';
const chainUrl = 'https://api.etherscan.io/v2/api';
const chainId = '1';

const url = `${chainUrl}?chainid=${chainId}&module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${apiKey}`;

console.log('Testing URL:', url.replace(apiKey, 'HIDDEN'));

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Response:', data);
    });
}).on('error', (e) => {
    console.error('Error:', e.message);
});
