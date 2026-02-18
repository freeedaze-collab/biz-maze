@echo off
REM Deploy new Supabase Edge Functions for tax calculators and wallet sync

echo ========================================
echo Deploying Supabase Edge Functions
echo ========================================

REM Tax Calculator Functions
echo.
echo [1/5] Deploying US Tax Calculator...
supabase functions deploy calculate-crypto-tax-us --project-ref kkrtrdoyzodqhuzaswuk

echo.
echo [2/5] Deploying Germany Tax Calculator...
supabase functions deploy calculate-crypto-tax-germany --project-ref kkrtrdoyzodqhuzaswuk

echo.
echo [3/5] Deploying France Tax Calculator...
supabase functions deploy calculate-crypto-tax-france --project-ref kkrtrdoyzodqhuzaswuk

REM Wallet Sync Functions
echo.
echo [4/5] Deploying Bitcoin Transaction Sync...
supabase functions deploy sync-bitcoin-transactions --project-ref kkrtrdoyzodqhuzaswuk

echo.
echo [5/5] Deploying Solana Transaction Sync...
supabase functions deploy sync-solana-transactions --project-ref kkrtrdoyzodqhuzaswuk

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Set environment variables in Supabase Dashboard
echo 2. Test functions via Dashboard or API
echo.
pause
