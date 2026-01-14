
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";

const TABLES = [
    'entities',
    'wallet_connections',
    'exchange_connections',
    'wallet_transactions',
    'exchange_trades',
    'asset_prices',
    'daily_exchange_rates' // This might be large
];

const BACKUP_DIR = path.join(__dirname, '../backups');

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllRows(tableName) {
    let allRows = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    console.log(`\nStarting backup for: ${tableName}`);

    while (hasMore) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(from, to);

        if (error) {
            console.error(`Error fetching ${tableName} (range ${from}-${to}):`, error.message);
            throw error;
        }

        if (data.length > 0) {
            allRows = allRows.concat(data);
            console.log(`  Fetched ${data.length} rows (Total: ${allRows.length})`);
            from += pageSize;
        } else {
            hasMore = false;
        }
    }
    return allRows;
}

async function runBackup() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    console.log(`Backup started at ${timestamp}`);
    console.log(`Target directory: ${BACKUP_DIR}`);

    for (const table of TABLES) {
        try {
            const rows = await fetchAllRows(table);
            const filename = `${table}_${timestamp}.json`;
            const filePath = path.join(BACKUP_DIR, filename);

            fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
            console.log(`✅ Saved ${rows.length} rows to ${filename}`);
        } catch (err) {
            console.error(`❌ Failed to backup ${table}:`, err.message);
        }
    }
    console.log('\nBackup process completed.');
}

runBackup();
