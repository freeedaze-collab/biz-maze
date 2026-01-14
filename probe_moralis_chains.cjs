const https = require('https');

// Key from .env (Line 12)
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjA0MWUzZmQ2LTBiZGQtNDllZC04OTAyLTNhODEwMWViOTkwZSIsIm9yZ0lkIjoiNDg4Mjc5IiwidXNlcklkIjoiNTAyMzgyIiwidHlwZUlkIjoiZjRiNTUwNTUtYjY2YS00MWExLTlkODktYzA2ZDdhYTE0Y2MwIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjcyODU1NzMsImV4cCI6NDkyMzA0NTU3M30.W20DpOSledC0LU0NlRmm5oluiH2sSGtVOGf88R53H7k";

// Vitalik's address as a reliable test subject
const ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; 

const options = {
  hostname: 'deep-index.moralis.io',
  path: `/api/v2.2/wallets/${ADDRESS}/chains`,
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'X-API-Key': API_KEY
  }
};

console.log('--- Probing Moralis Active Chains ---');
const req = https.request(options, (res) => {
  console.log(`StatusCode: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Response:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.error('Error parsing JSON:', e);
      console.log('Raw Data:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();
