const https = require('https');

const url = 'https://ymddtgbsybvxfitgupqy.supabase.co/functions/v1/check-db-count';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZGR0Z2JzeWJ2eGZpdGd1cHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMjc0MjcsImV4cCI6MjA3MzYwMzQyN30.chcgcQ3Uwpow7PluU-5uvioe1IWIYjCC0QSzdF-T3_g';

const req = https.request(url, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
    }
}, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('RESULT:', data);
    });
});

req.on('error', (e) => console.error(e));
req.write(JSON.stringify({}));
req.end();
