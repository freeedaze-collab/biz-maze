-- supabase/migrations/20251205_create_cash_flow_view.sql
-- PURPOSE: Creates the view for the Cash Flow Statement.

CREATE OR REPLACE VIEW public.v_cash_flow_statement AS
SELECT
    t.user_id,
    -- Operating Activities
    SUM(CASE WHEN t.usage = 'trading_acquisition_ias2' THEN -t.value_in_usd ELSE 0 END) AS cash_out_for_inventory,
    SUM(CASE WHEN t.usage = 'sale_ias2' THEN t.value_in_usd ELSE 0 END) AS cash_in_from_inventory_sales,
    SUM(CASE WHEN t.usage = 'revenue_ifrs15' THEN t.value_in_usd ELSE 0 END) AS cash_in_from_revenue,
    SUM(CASE WHEN t.usage = 'gas_fees' THEN -t.value_in_usd ELSE 0 END) AS cash_out_for_gas_fees,

    -- Investing Activities
    SUM(CASE WHEN t.usage = 'investment_acquisition_ias38' THEN -t.value_in_usd ELSE 0 END) AS cash_out_for_intangibles,
    SUM(CASE WHEN t.usage = 'sale_ias38' THEN t.value_in_usd ELSE 0 END) AS cash_in_from_intangibles,

    -- Financing Activities (Note: No direct financing activities modeled yet)
    SUM(CASE WHEN t.usage = 'capital_contribution' THEN t.value_in_usd ELSE 0 END) AS cash_in_from_financing,
    SUM(CASE WHEN t.usage = 'distribution_to_owners' THEN -t.value_in_usd ELSE 0 END) AS cash_out_to_owners

FROM public.all_transactions t
WHERE t.usage IS NOT NULL
GROUP BY t.user_id;
