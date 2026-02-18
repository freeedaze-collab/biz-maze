// src/components/tax/FranceTaxForm.tsx
// France Crypto Tax Form with flat tax vs progressive comparison

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, TrendingDown, TrendingUp } from 'lucide-react';

type FranceTaxData = {
    tax_year: number;
    currency: string;
    total_gains: number;
    flat_tax: {
        rate: number;
        amount: number;
        breakdown: {
            income_tax: number;
            social_tax: number;
        };
    };
    progressive_tax: {
        estimated_rate: number;
        income_tax: number;
        social_tax: number;
        total: number;
    };
    recommended_method: 'flat' | 'progressive';
    savings_with_recommended: number;
};

type FranceTaxFormProps = {
    data: FranceTaxData | null;
    loading: boolean;
};

export default function FranceTaxForm({ data, loading }: FranceTaxFormProps) {
    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    Calcul en cours...
                </CardContent>
            </Card>
        );
    }

    if (!data) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    Aucune donnée disponible. Cliquez sur "Calculer".
                </CardContent>
            </Card>
        );
    }

    const recommendedTax = data.recommended_method === 'flat' ? data.flat_tax.amount : data.progressive_tax.total;
    const alternativeTax = data.recommended_method === 'flat' ? data.progressive_tax.total : data.flat_tax.amount;

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="border-2">
                <CardHeader className="bg-muted/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl font-bold">
                                Déclaration des Plus-Values sur Actifs Numériques
                            </CardTitle>
                            <CardDescription className="mt-2 text-base">
                                Année fiscale {data.tax_year} | Impôts sur les Cryptomonnaies
                            </CardDescription>
                        </div>
                        <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Contribuable:</span>
                            <div className="font-mono mt-1 border-b border-dotted pb-1">___________________________</div>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Numéro fiscal:</span>
                            <div className="font-mono mt-1 border-b border-dotted pb-1">_________________</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Total Gains Summary */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
                <CardContent className="pt-6">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">Plus-Values Totales</p>
                        <p className="text-4xl font-bold text-blue-600">€{data.total_gains.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground mt-2">Total des gains en cryptomonnaies</p>
                    </div>
                </CardContent>
            </Card>

            {/* Tax Options Comparison */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Option 1: Flat Tax (PFU) */}
                <Card className={`border-2 ${data.recommended_method === 'flat' ? 'border-green-300 bg-green-50/30' : 'border-gray-200'}`}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Option 1: PFU (Flat Tax)</CardTitle>
                            {data.recommended_method === 'flat' && (
                                <Badge className="bg-green-100 text-green-700 border-green-300">
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                    Recommandé
                                </Badge>
                            )}
                        </div>
                        <CardDescription>
                            Prélèvement Forfaitaire Unique - 30%
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm border-b pb-2">
                            <span className="text-muted-foreground">Plus-values:</span>
                            <span className="font-mono">€{data.total_gains.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b pb-2">
                            <span className="text-muted-foreground">Impôt sur le revenu (12.8%):</span>
                            <span className="font-mono">€{data.flat_tax.breakdown.income_tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b pb-2">
                            <span className="text-muted-foreground">Prélèvements sociaux (17.2%):</span>
                            <span className="font-mono">€{data.flat_tax.breakdown.social_tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg pt-2">
                            <span>Total à payer:</span>
                            <span className="font-mono text-blue-600">€{data.flat_tax.amount.toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Option 2: Progressive Tax */}
                <Card className={`border-2 ${data.recommended_method === 'progressive' ? 'border-green-300 bg-green-50/30' : 'border-gray-200'}`}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Option 2: Barème Progressif</CardTitle>
                            {data.recommended_method === 'progressive' && (
                                <Badge className="bg-green-100 text-green-700 border-green-300">
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                    Recommandé
                                </Badge>
                            )}
                        </div>
                        <CardDescription>
                            Impôt progressif + Prélèvements sociaux
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm border-b pb-2">
                            <span className="text-muted-foreground">Plus-values:</span>
                            <span className="font-mono">€{data.total_gains.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b pb-2">
                            <span className="text-muted-foreground">Impôt progressif (~{(data.progressive_tax.estimated_rate * 100).toFixed(0)}%):</span>
                            <span className="font-mono">€{data.progressive_tax.income_tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b pb-2">
                            <span className="text-muted-foreground">Prélèvements sociaux (17.2%):</span>
                            <span className="font-mono">€{data.progressive_tax.social_tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg pt-2">
                            <span>Total à payer:</span>
                            <span className="font-mono text-blue-600">€{data.progressive_tax.total.toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recommendation Summary */}
            <Card className="border-2 border-green-200 bg-green-50/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-green-600" />
                        Méthode Recommandée
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-lg">
                                {data.recommended_method === 'flat' ? 'PFU (Flat Tax) - 30%' : 'Barème Progressif'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Cette option vous permet d'économiser €{data.savings_with_recommended.toFixed(2)}
                            </p>
                        </div>
                        <div className="text-right">
                            <Badge className="bg-green-100 text-green-700 text-lg px-4 py-2">
                                €{recommendedTax.toFixed(2)}
                            </Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-white rounded-lg border">
                            <p className="text-muted-foreground mb-1">Montant recommandé:</p>
                            <p className="font-mono font-bold text-green-600">€{recommendedTax.toFixed(2)}</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg border">
                            <p className="text-muted-foreground mb-1">Alternative:</p>
                            <p className="font-mono font-bold text-gray-600">€{alternativeTax.toFixed(2)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Declaration Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle>Comment Déclarer</CardTitle>
                </CardHeader>
                <CardContent>
                    <ol className="space-y-2 text-sm">
                        <li className="flex gap-2">
                            <span className="font-semibold">1.</span>
                            <span>Utilisez le formulaire <strong>2086</strong> (Plus-values sur actifs numériques)</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-semibold">2.</span>
                            <span>Reportez le montant total des plus-values: <strong>€{data.total_gains.toFixed(2)}</strong></span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-semibold">3.</span>
                            <span>
                                Choisissez votre option fiscale:
                                <Badge className="ml-2" variant={data.recommended_method === 'flat' ? 'default' : 'outline'}>
                                    PFU 30%
                                </Badge>
                                <span className="mx-1">ou</span>
                                <Badge variant={data.recommended_method === 'progressive' ? 'default' : 'outline'}>
                                    Progressif
                                </Badge>
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-semibold">4.</span>
                            <span>Conservez tous les justificatifs de transaction pendant 6 ans</span>
                        </li>
                    </ol>

                    <div className="mt-4">
                        <Button variant="outline" className="w-full">
                            <Download className="mr-2 h-4 w-4" />
                            Télécharger le récapitulatif
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Disclaimer */}
            <Card className="border-yellow-200 bg-yellow-50/50">
                <CardContent className="pt-6">
                    <p className="text-sm text-yellow-800">
                        <strong>Avertissement:</strong> Cette estimation est fournie à titre indicatif uniquement.
                        Le taux progressif réel dépend de votre tranche marginale d'imposition. Pour une déclaration précise,
                        consultez un expert-comptable ou un conseiller fiscal spécialisé en cryptomonnaies.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
