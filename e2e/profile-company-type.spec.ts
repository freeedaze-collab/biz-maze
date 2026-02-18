import { test, expect } from '@playwright/test';

/**
 * E2E Test: Profile Page — Corporate Structure & Company Type
 *
 * Tests the /profile page's corporate structure section where users
 * manage entities and their company_type (ordinary vs crypto).
 * Verifies:
 * - Entity list renders with company_type badges
 * - Company type dropdown works and saves
 * - Adding new entity with company_type
 */
test.describe('Profile — Corporate Structure', () => {

    test('should display entities with company type badges', async ({ page }) => {
        await page.goto('/profile');

        // Wait for the Corporate Structure card
        await expect(page.locator('text=Corporate Structure')).toBeVisible({ timeout: 10000 });

        // Check that entity rows exist (at least Head Office)
        const entityRows = page.locator('.space-y-3 > div');
        const count = await entityRows.count();

        if (count > 0) {
            // Check that company type selector exists
            const firstSelect = entityRows.first().locator('select');
            await expect(firstSelect).toBeVisible();

            // Check that IAS badge exists
            const badge = entityRows.first().locator('text=/IAS (2|38)/');
            await expect(badge).toBeVisible();
        }
    });

    test('should allow changing entity company type', async ({ page }) => {
        await page.goto('/profile');
        await expect(page.locator('text=Corporate Structure')).toBeVisible({ timeout: 10000 });

        const entityRows = page.locator('.space-y-3 > div');
        const count = await entityRows.count();

        if (count === 0) {
            test.skip();
            return;
        }

        // Find the company type dropdown in the first entity
        const companyTypeSelect = entityRows.first().locator('select').first();
        const currentValue = await companyTypeSelect.inputValue();

        // Toggle to the other option
        const newValue = currentValue === 'ordinary' ? 'crypto' : 'ordinary';
        await companyTypeSelect.selectOption(newValue);

        // Wait for the toast confirmation
        await expect(page.locator('text=/Enterprise type updated/')).toBeVisible({ timeout: 5000 });

        // Verify the badge changed
        if (newValue === 'crypto') {
            await expect(entityRows.first().locator('text=IAS 2')).toBeVisible();
        } else {
            await expect(entityRows.first().locator('text=IAS 38')).toBeVisible();
        }

        // Revert to original value
        await companyTypeSelect.selectOption(currentValue);
        await expect(page.locator('text=/Enterprise type updated/')).toBeVisible({ timeout: 5000 });
    });

    test('should add new entity with company type', async ({ page }) => {
        await page.goto('/profile');
        await expect(page.locator('text=Corporate Structure')).toBeVisible({ timeout: 10000 });

        const testName = `E2E Test Entity ${Date.now()}`;

        // Fill in entity name
        await page.fill('input[placeholder*="New Subsidiary"]', testName);

        // Select Crypto Enterprise type
        const newEntityTypeSelect = page.locator('select:near(input[placeholder*="New Subsidiary"])').first();
        await newEntityTypeSelect.selectOption('crypto');

        // Click Add button
        await page.click('button:has-text("Add")');

        // Wait for toast
        await expect(page.locator('text=Subsidiary added')).toBeVisible({ timeout: 5000 });

        // Verify the new entity appears with IAS 2 badge
        await expect(page.locator(`text=${testName}`)).toBeVisible();

        // Clean up: delete the test entity
        const entityRow = page.locator(`div:has(input[value="${testName}"])`);
        const deleteBtn = entityRow.locator('button:has(svg.text-destructive)');
        if (await deleteBtn.isVisible()) {
            page.on('dialog', dialog => dialog.accept()); // Accept confirm dialog
            await deleteBtn.click();
            await page.waitForTimeout(1000);
        }
    });
});
