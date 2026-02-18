import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load test env vars
const envPath = path.resolve(__dirname, '../.env.test');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const authFile = path.resolve(__dirname, '.auth/user.json');

/**
 * This setup test logs in via the Supabase auth UI and saves
 * the browser storage state (cookies + localStorage) for reuse
 * in all subsequent tests.
 *
 * If TEST_USER_EMAIL / TEST_USER_PASSWORD are not set,
 * it will skip and tests must handle auth manually.
 */
setup('authenticate via Supabase login', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email || !password) {
        console.warn('⚠️  TEST_USER_EMAIL / TEST_USER_PASSWORD not set. Skipping auth setup.');
        console.warn('   Create .env.test with credentials to enable E2E auth.');
        // Save empty storage state so tests can still run (unauthenticated)
        const dir = path.dirname(authFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
        return;
    }

    // Navigate to login page
    await page.goto('/login');

    // Wait for the login form to appear
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });

    // Fill in credentials
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard or any authenticated page
    await page.waitForURL(/\/(dashboard|account-type|profile|accounting)/, { timeout: 30000 });

    // Ensure we're logged in
    await expect(page).not.toHaveURL(/\/login/);

    // Save storage state for reuse
    const dir = path.dirname(authFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await page.context().storageState({ path: authFile });
});
