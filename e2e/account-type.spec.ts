import { test, expect } from '@playwright/test';

/**
 * E2E Test: Account Type Selection Page
 *
 * Tests the /account-type page where new users configure their account
 * after email verification. Verifies:
 * - Page renders correctly
 * - Individual vs Corporate toggle
 * - Ordinary / Crypto Enterprise sub-toggle appears for Corporate
 * - Country selection
 * - Form validation
 */
test.describe('Account Type Selection', () => {

    test('should render account type options', async ({ page }) => {
        await page.goto('/account-type');

        // Check page title
        await expect(page.locator('h1')).toContainText('Welcome');

        // Check radio options exist
        await expect(page.locator('text=Individual Account')).toBeVisible();
        await expect(page.locator('text=Corporate Account')).toBeVisible();
    });

    test('should show Enterprise Type toggle when Corporate is selected', async ({ page }) => {
        await page.goto('/account-type');

        // Initially, enterprise type should not be visible
        await expect(page.locator('text=Enterprise Type')).not.toBeVisible();

        // Click Corporate
        await page.click('label[for="corporate"]');

        // Now enterprise type should appear
        await expect(page.locator('text=Enterprise Type')).toBeVisible();
        await expect(page.locator('text=Ordinary Enterprise')).toBeVisible();
        await expect(page.locator('text=Crypto Enterprise')).toBeVisible();

        // IAS labels should be visible
        await expect(page.locator('text=IAS 38')).toBeVisible();
        await expect(page.locator('text=IAS 2')).toBeVisible();
    });

    test('should hide Enterprise Type when switching back to Individual', async ({ page }) => {
        await page.goto('/account-type');

        // Select Corporate first
        await page.click('label[for="corporate"]');
        await expect(page.locator('text=Enterprise Type')).toBeVisible();

        // Switch to Individual
        await page.click('label[for="individual"]');

        // Enterprise type should disappear
        await expect(page.locator('text=Enterprise Type')).not.toBeVisible();
    });

    test('should require enterprise type for corporate accounts', async ({ page }) => {
        await page.goto('/account-type');

        // Select Corporate
        await page.click('label[for="corporate"]');

        // Select a country
        await page.click('[data-testid="select-trigger"], button:has-text("Select your country")');
        await page.click('text=Japan');

        // Try to submit without selecting enterprise type
        const submitButton = page.locator('button:has-text("Complete Setup")');

        // Button should be disabled (no enterprise type selected)
        await expect(submitButton).toBeDisabled();
    });

    test('should enable submit when all fields are filled (Crypto Enterprise)', async ({ page }) => {
        await page.goto('/account-type');

        // Select Corporate
        await page.click('label[for="corporate"]');

        // Select Crypto Enterprise
        await page.click('label[for="crypto"]');

        // Select a country
        await page.click('button:has-text("Select your country")');
        await page.click('text=Japan');

        // Button should now be enabled
        const submitButton = page.locator('button:has-text("Complete Setup")');
        await expect(submitButton).not.toBeDisabled();
    });
});
