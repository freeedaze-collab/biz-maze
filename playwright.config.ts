import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for biz-maze E2E tests.
 *
 * Tests run against localhost:5173 (Vite dev server).
 * Auth credentials are read from environment variables:
 *   - TEST_USER_EMAIL
 *   - TEST_USER_PASSWORD
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,       // Run tests sequentially (shared auth state)
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,                  // Single worker for Supabase state consistency
    reporter: 'html',
    timeout: 60_000,             // 60s per test (network calls to Supabase)

    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        // Setup project: login and save auth state
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
        },
        // Main tests that depend on auth state
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
    ],

    // Start dev server before tests (if not already running)
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,   // Don't start if already running
        timeout: 30_000,
    },
});
