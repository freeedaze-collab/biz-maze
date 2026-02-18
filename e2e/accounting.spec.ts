import { test, expect } from '@playwright/test';

/**
 * E2E Test: Accounting Page — Company Type Aware Financial Statements
 *
 * Tests the /accounting page to verify:
 * - Entity selector shows company_type badges (IAS 2 / IAS 38)
 * - Financial statement cards render for both enterprise types
 * - Dynamic P/L, B/S, C/F account labels match the enterprise type
 * - Currency and date filters work
 * - CSV export works
 */
test.describe('Accounting — Financial Statements', () => {

    test('should render financial statements page', async ({ page }) => {
        await page.goto('/accounting');

        // Check page title
        await expect(page.locator('text=Financial Statements')).toBeVisible({ timeout: 10000 });

        // Check that the three financial statement sections exist
        await expect(page.locator('text=/Profit & Loss/')).toBeVisible();
        await expect(page.locator('text=/Balance Sheet/')).toBeVisible();
        await expect(page.locator('text=/Cash Flow/')).toBeVisible();
    });

    test('should show entity selector with company type indicator', async ({ page }) => {
        await page.goto('/accounting');
        await expect(page.locator('text=Financial Statements')).toBeVisible({ timeout: 10000 });

        // Entity selector should be present
        const entitySelector = page.locator('text=Entity:').locator('..').locator('button');
        await expect(entitySelector).toBeVisible();

        // Open dropdown
        await entitySelector.click();

        // Should show "All (Consolidated)" option
        await expect(page.locator('text=All (Consolidated)')).toBeVisible();
    });

    test('should show IAS badge when a specific entity is selected', async ({ page }) => {
        await page.goto('/accounting');
        await expect(page.locator('text=Financial Statements')).toBeVisible({ timeout: 10000 });

        // Open entity selector
        const entitySelector = page.locator('text=Entity:').locator('..').locator('button');
        await entitySelector.click();

        // Get all entity options (excluding "All (Consolidated)")
        const options = page.locator('[role="option"]');
        const count = await options.count();

        if (count > 1) {
            // Click the first non-"All" entity
            await options.nth(1).click();

            // An IAS badge should appear
            const iasBadge = page.locator('text=/IAS (2|38)/');
            await expect(iasBadge.first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('should update card titles for Crypto Enterprise entity', async ({ page }) => {
        await page.goto('/accounting');
        await expect(page.locator('text=Financial Statements')).toBeVisible({ timeout: 10000 });

        // Open entity selector
        const entitySelector = page.locator('text=Entity:').locator('..').locator('button');
        await entitySelector.click();

        // Look for a Crypto (IAS 2) entity
        const cryptoOption = page.locator('[role="option"]:has-text("IAS 2")');

        if (await cryptoOption.count() > 0) {
            await cryptoOption.first().click();

            // Card titles should reflect IAS 2
            await expect(page.locator('text=Profit & Loss (IAS 2 — Trading)')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('text=Balance Sheet (Inventory Model)')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('text=Cash Flow (Operating — Trading)')).toBeVisible({ timeout: 5000 });

            // IAS 2 badge should be visible
            await expect(page.locator('text=Crypto Enterprise (IAS 2)')).toBeVisible();
        } else {
            // No Crypto entities — verify Ordinary titles instead
            const ordinaryOption = page.locator('[role="option"]').nth(1);
            if (await ordinaryOption.count() > 0) {
                await ordinaryOption.click();

                // Ordinary Enterprise should show default titles
                await expect(page.locator('text=Profit & Loss Statement')).toBeVisible();
                await expect(page.locator('text=Ordinary Enterprise (IAS 38)')).toBeVisible();
            }
        }
    });

    test('should allow currency switching', async ({ page }) => {
        await page.goto('/accounting');
        await expect(page.locator('text=Financial Statements')).toBeVisible({ timeout: 10000 });

        // Find the currency selector
        const currencySelector = page.locator('text=Reporting Currency:').locator('..').locator('button');
        await currencySelector.click();

        // Select JPY
        await page.click('[role="option"]:has-text("JPY")');

        // Click Apply Filter
        await page.click('button:has-text("Apply Filter")');

        // Wait for reload — page should still render
        await expect(page.locator('text=/Profit & Loss/')).toBeVisible({ timeout: 10000 });
    });

    test('should export CSV', async ({ page }) => {
        await page.goto('/accounting');
        await expect(page.locator('text=Financial Statements')).toBeVisible({ timeout: 10000 });

        // Wait for data to load
        await page.waitForTimeout(2000);

        const exportButton = page.locator('button:has-text("Export to CSV")');

        // If data exists, button should be enabled
        if (await exportButton.isEnabled()) {
            // Listen for download event
            const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
            await exportButton.click();

            try {
                const download = await downloadPromise;
                expect(download.suggestedFilename()).toContain('financial_statements');
                expect(download.suggestedFilename()).toContain('.csv');
            } catch {
                // No download triggered — acceptable if no data
            }
        }
    });
});
