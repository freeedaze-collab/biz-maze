// src/pages/checkout/Checkout.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  Copy,
  Clock,
  ChevronRight,
  CreditCard,
  ArrowLeft,
  Loader2,
  QrCode
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Invoice = {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  total: number;
  currency: string;
  status: string;
  notes: string | null;
  user_id: string;
};

type Intent = {
  id: number;
  status: string;
  requested_amount: number;
  requested_currency: string;
  pay_asset: string | null;
  pay_network: string | null;
  pay_address: string | null;
  received_amount: number | null;
  tx_hash: string | null;
  expires_at: string | null;
  amount_crypto?: number;
  rate_fiat?: number;
};

const SUPPORTED_ASSETS = [
  { symbol: "BTC", name: "Bitcoin", network: "Bitcoin", color: "#F7931A" },
  { symbol: "ETH", name: "Ethereum", network: "Ethereum", color: "#627EEA" },
  { symbol: "USDC", name: "USD Coin", network: "Polygon", color: "#2775CA" },
  { symbol: "JPYC", name: "JPY Coin", network: "Polygon", color: "#00A0E9" },
];

export default function Checkout() {
  const { id } = useParams();
  const [step, setStep] = useState<"select" | "pay" | "success">("select");
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [timer, setTimer] = useState<string>("");

  // 1. Load Invoice
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from("invoices")
          .select("*")
          .eq("id", id)
          .single();
        if (error) throw error;
        setInvoice(data);

        // Check if there's already a pending intent
        const { data: intentData } = await supabase
          .from("payment_intents")
          .select("*")
          .eq("invoice_id", id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (intentData) {
          setIntent(intentData);
          setStep("pay");
        }
      } catch (e: any) {
        toast.error("Invoice not found or error loading.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // 2. Select Asset & Create Intent
  const handleSelectAsset = async (asset: typeof SUPPORTED_ASSETS[0]) => {
    if (!invoice || !id || !invoice.user_id) return;
    setLoading(true);
    try {
      // Create Intent via Edge Function
      const { data, error } = await supabase.functions.invoke("create-invoice-intent", {
        body: {
          invoiceId: id,
          payAsset: asset.symbol,
          payNetwork: asset.network,
        },
      });

      if (error) throw error;

      setIntent({
        ...data.intent,
        amount_crypto: data.amount_crypto,
        rate_fiat: data.rate
      });
      setStep("pay");
    } catch (e: any) {
      toast.error("Failed to start payment: " + (e.message || "Function error"));
    } finally {
      setLoading(false);
    }
  };

  // 3. Polling & Timer
  useEffect(() => {
    if (step !== "pay" || !intent) return;

    const interval = setInterval(async () => {
      // Check status
      const { data } = await supabase
        .from("payment_intents")
        .select("status, received_amount, tx_hash")
        .eq("id", intent.id)
        .single();

      if (data?.status === "paid") {
        setStep("success");
      }

      // Expiry check removed as per user request
    }, 2000);

    return () => clearInterval(interval);
  }, [step, intent]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  if (loading && !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!invoice) return <div className="p-12 text-center text-red-500 font-bold">Invoice Not Found</div>;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 selection:bg-primary/10">
      <div className="max-w-md mx-auto">
        {/* Header Area */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm border mb-2">
            <CreditCard className="text-primary" size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">{invoice.customer_name || "Checkout"}</h1>
          <p className="text-sm text-slate-500">Invoice {invoice.invoice_number}</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">

          {/* Amount Display */}
          <div className="p-8 text-center bg-slate-50/50 border-b border-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Amount</p>
            <div className="text-3xl font-bold text-slate-900 font-mono">
              {invoice.total.toLocaleString()} <span className="text-lg font-medium text-slate-500">{invoice.currency}</span>
            </div>
          </div>

          {/* Step Sections */}
          <div className="p-6">

            {step === "select" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-600 mb-4 px-2">Select your payment currency</h3>
                <div className="grid gap-3">
                  {SUPPORTED_ASSETS.map((asset) => (
                    <button
                      key={asset.symbol}
                      onClick={() => handleSelectAsset(asset)}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:border-primary/50 hover:bg-slate-50 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: asset.color }}
                        >
                          {asset.symbol[0]}
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-slate-900">{asset.symbol}</div>
                          <div className="text-xs text-slate-500 font-medium">{asset.name} on {asset.network}</div>
                        </div>
                      </div>
                      <ChevronRight className="text-slate-300 group-hover:text-primary transition-colors" size={20} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === "pay" && intent && (
              <div className="space-y-6">
                {/* Back Button */}
                <button
                  onClick={() => setStep("select")}
                  className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft size={14} /> Change currency
                </button>

                {/* QR Code Placeholder (Using Google Chart for now) */}
                <div className="relative group">
                  <div className="aspect-square w-full max-self-auto max-w-[200px] mx-auto bg-white border-4 border-slate-50 rounded-2xl overflow-hidden p-2 flex items-center justify-center shadow-inner">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${intent.pay_address}`}
                      alt="QR Code"
                      className="w-full h-full"
                    />
                  </div>
                </div>

                {/* Details Card */}
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-slate-500">Send Exactly</span>
                      <button
                        onClick={() => copyToClipboard((intent as any).amount_crypto?.toFixed(8) || "0", "Amount")}
                        className="text-2xl font-bold text-slate-900 hover:text-primary transition-colors flex items-center gap-2"
                      >
                        {(intent as any).amount_crypto?.toFixed(8)} {intent.pay_asset} <Copy size={16} />
                      </button>
                      {intent.rate_fiat && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          1 {intent.pay_asset} ≈ {intent.rate_fiat.toLocaleString()} {intent.requested_currency}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-500">Recipient Address ({intent.pay_network})</span>
                      <button
                        onClick={() => copyToClipboard(intent.pay_address || "", "Address")}
                        className="flex items-center justify-between w-full p-2 bg-white rounded-lg border border-slate-200 text-[10px] font-mono break-all hover:bg-slate-50 transition-colors group"
                      >
                        <span className="truncate pr-4">{intent.pay_address}</span>
                        <Copy size={14} className="flex-shrink-0 text-slate-400 group-hover:text-primary" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  ⚡ Awaiting payment confirmation...
                </div>
              </div>
            )}

            {step === "success" && (
              <div className="py-8 text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 text-green-600 rounded-full mb-4 animate-bounce">
                  <CheckCircle2 size={40} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Payment Confirmed!</h2>
                  <p className="text-sm text-slate-500 mt-2">Your payment of {invoice.total} {invoice.currency} has been successfully processed.</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-tighter mb-1">Receipt Number</p>
                  <p className="font-mono text-sm break-all">{intent?.tx_hash || "SEC-PAY-" + Math.random().toString(36).slice(2, 10).toUpperCase()}</p>
                </div>
                <button
                  onClick={() => window.close()}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-colors shadow-lg"
                >
                  Back to Merchant
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-[11px] text-slate-400">Powered by <strong>BizMaze Pay</strong> & BitPay Protocols</p>
          <div className="flex items-center justify-center gap-4 filter grayscale opacity-30">
            <div className="text-[10px] font-black italic">VISA</div>
            <div className="text-[10px] font-black italic">MASTERCARD</div>
            <div className="text-[10px] font-black italic">BITCOIN</div>
          </div>
        </div>
      </div>
    </div >
  );
}
