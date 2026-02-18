// src/lib/taxCalculation.ts
// Shared tax calculation utilities for crypto tax reporting

export type Purchase = {
    date: Date;
    currency: string;
    amount: number;
    price_usd: number;
    fee_usd?: number;
};

export type Sale = {
    date: Date;
    currency: string;
    amount: number;
    proceeds_usd: number;
    fee_usd?: number;
};

export type CostBasisResult = {
    sale: Sale;
    cost_basis: number;
    gain_loss: number;
    holding_period_days: number;
    is_long_term: boolean;
    matched_purchases: Array<{
        purchase: Purchase;
        amount_used: number;
        cost_basis: number;
    }>;
};

/**
 * Calculate cost basis using FIFO (First In, First Out) method
 */
export function calculateFIFOBasis(
    purchases: Purchase[],
    sales: Sale[]
): CostBasisResult[] {
    // Sort purchases and sales by date
    const sortedPurchases = [...purchases].sort((a, b) => a.date.getTime() - b.date.getTime());
    const sortedSales = [...sales].sort((a, b) => a.date.getTime() - b.date.getTime());

    const results: CostBasisResult[] = [];
    const remainingPurchases: Array<Purchase & { remaining: number }> = sortedPurchases.map(p => ({
        ...p,
        remaining: p.amount
    }));

    for (const sale of sortedSales) {
        let saleRemaining = sale.amount;
        const matchedPurchases: Array<{
            purchase: Purchase;
            amount_used: number;
            cost_basis: number;
        }> = [];
        let totalCostBasis = 0;
        let earliestPurchaseDate: Date | null = null;

        // Match sale with purchases using FIFO
        for (const purchase of remainingPurchases) {
            if (saleRemaining <= 0) break;
            if (purchase.remaining <= 0) continue;
            if (purchase.currency !== sale.currency) continue;

            const amountToUse = Math.min(saleRemaining, purchase.remaining);
            const costBasis = (purchase.price_usd * amountToUse) + ((purchase.fee_usd || 0) * (amountToUse / purchase.amount));

            matchedPurchases.push({
                purchase: {
                    date: purchase.date,
                    currency: purchase.currency,
                    amount: purchase.amount,
                    price_usd: purchase.price_usd,
                    fee_usd: purchase.fee_usd
                },
                amount_used: amountToUse,
                cost_basis: costBasis
            });

            totalCostBasis += costBasis;
            purchase.remaining -= amountToUse;
            saleRemaining -= amountToUse;

            if (!earliestPurchaseDate) {
                earliestPurchaseDate = purchase.date;
            }
        }

        // Calculate holding period from earliest matched purchase
        const holdingPeriodDays = earliestPurchaseDate
            ? Math.floor((sale.date.getTime() - earliestPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        // Subtract sale fees from proceeds
        const netProceeds = sale.proceeds_usd - (sale.fee_usd || 0);

        results.push({
            sale,
            cost_basis: totalCostBasis,
            gain_loss: netProceeds - totalCostBasis,
            holding_period_days: holdingPeriodDays,
            is_long_term: holdingPeriodDays > 365,
            matched_purchases: matchedPurchases
        });
    }

    return results;
}

/**
 * Calculate holding period between two dates
 */
export function calculateHoldingPeriod(
    buyDate: Date,
    sellDate: Date
): { days: number; isLongTerm: boolean } {
    const days = Math.floor((sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
        days,
        isLongTerm: days > 365
    };
}

/**
 * Convert amount to target currency using historical exchange rate
 * This is a simplified version - in production, use actual historical rates API
 */
export async function convertToCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date: Date
): Promise<number> {
    // TODO: Implement actual historical exchange rate lookup
    // For now, return mock conversion
    if (fromCurrency === toCurrency) {
        return amount;
    }

    // Mock rates (in production, fetch from database or API)
    const mockRates: Record<string, number> = {
        'USD_EUR': 0.85,
        'USD_GBP': 0.73,
        'EUR_USD': 1.18,
        'GBP_USD': 1.37
    };

    const rateKey = `${fromCurrency}_${toCurrency}`;
    const rate = mockRates[rateKey] || 1;

    return amount * rate;
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Format date for tax forms
 */
export function formatTaxDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    });
}

/**
 * Aggregate results by short-term and long-term
 */
export function aggregateCapitalGains(results: CostBasisResult[]): {
    shortTermGain: number;
    longTermGain: number;
    totalGain: number;
    shortTermTransactions: number;
    longTermTransactions: number;
} {
    let shortTermGain = 0;
    let longTermGain = 0;
    let shortTermTransactions = 0;
    let longTermTransactions = 0;

    for (const result of results) {
        if (result.is_long_term) {
            longTermGain += result.gain_loss;
            longTermTransactions++;
        } else {
            shortTermGain += result.gain_loss;
            shortTermTransactions++;
        }
    }

    return {
        shortTermGain,
        longTermGain,
        totalGain: shortTermGain + longTermGain,
        shortTermTransactions,
        longTermTransactions
    };
}
