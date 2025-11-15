// src/pages/PaymentGateway.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Merchant = {
  id?: string;
  user_id?: string;
  store_name: string | null;
  default_currency: string | null;
  allowed_networks: string[] | null; // e.g., ["Polygon","Ethereum"]
  webhook_secret: string | null;     // for verifying incoming webhooks
  webhook_url: string | null;        // your endpoint on merchant EC
  created_at?: string;
  updated_at?: string;
};

export default function PaymentGateway() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [merchant, setMerchant] = useState<Merchant>({
    store_name: "",
    default_currency: "USD",
    allowed_networks: ["Polygon"],
    webhook_secret: "",
    webhook_url: "",
  });

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const canSave = useMemo(() => {
    return !!merchant.store_name && !!merchant.default_currency;
  }, [merchant]);

  const canCreateLink = useMemo(() => {
    const a = Number(amount);
    return !Number.isNaN(a) && a > 0 && !!description;
  }, [amount, description]);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setMsg(null);
      setErr(null);
      // テーブルが無い場合は try-catch で握りつぶし
      try {
        const { data, error } = await supabase
          .from("payment_merchants")
          .select("*")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setMerchant({
            store_name: data.store_name ?? "",
            default_currency: data.default_currency ?? "USD",
            allowed_networks: data.allowed_networks ?? ["Polygon"],
            webhook_secret: data.webhook_secret ?? "",
            webhook_url: data.webhook_url ?? "",
            id: data.id,
            user_id: data.user_id,
            created_at: data.created_at,
            updated_at: data.updated_at,
          });
        }
      } catch (e: any) {
        // 初回はテーブルが未作成でも UI は表示（②でSQL提供）
        console.warn("[PaymentGateway] load warn:", e?.message ?? e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const payload = {
        user_id: user.id,
        store_name: merchant.store_name || null,
        default_currency: merchant.default_currency || null,
        allowed_networks: merchant.allowed_networks || ["Polygon"],
        webhook_secret: merchant.webhook_secret || null,
        webhook_url: merchant.webhook_url || null,
      };

      const { error } = await supabase
        .from("payment_merchants")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
      setMsg("Saved merchant settings.");
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const onCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setMsg(null);
    setErr(null);
    try {
      // テーブルがない環境でも壊れないように try-catch
      // 実際は Edge Function を呼んで署名付きURL/Checkoutを返す実装を②で入れます
      const payload = {
        title: description,
        amount: Number(amount),
        currency: merchant.default_currency || "USD",
      };
      const { data, error } = await supabase
        .from("payment_links")
        .insert({
          user_id: user.id,
          title: payload.title,
          amount: payload.amount,
          currency: payload.currency,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      setMsg(
        `Created payment link draft (id: ${data.id}). Implement checkout in Edge Function after confirmation.`
      );
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  };

  if (loading) {
    return <div className="p-6">Loading merchant settings...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payment Gateway</h1>
        <Link to="/dashboard" className="text-sm underline text-muted-foreground">
          Back to Dashboard
        </Link>
      </div>

      <form onSubmit={onSave} className="space-y-4 border rounded-xl p-4">
        <h2 className="font-semibold">Merchant settings</h2>

        <div>
          <label className="block text-sm mb-1">Store name</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={merchant.store_name ?? ""}
            onChange={(e) =>
              setMerchant((m) => ({ ...m, store_name: e.target.value }))
            }
            placeholder="My Crypto Shop"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Default currency</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={merchant.default_currency ?? "USD"}
              onChange={(e) =>
                setMerchant((m) => ({ ...m, default_currency: e.target.value }))
              }
            >
              <option>USD</option>
              <option>JPY</option>
              <option>EUR</option>
              <option>PHP</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Allowed networks</label>
            <select
              className="w-full border rounded px-3 py-2"
              multiple
              value={merchant.allowed_networks ?? ["Polygon"]}
              onChange={(e) => {
                const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
                setMerchant((m) => ({ ...m, allowed_networks: vals }));
              }}
            >
              <option>Polygon</option>
              <option>Ethereum</option>
              <option>Arbitrum</option>
              <option>Base</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Hold Ctrl/Cmd to select multiple.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Webhook secret (verify incoming)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={merchant.webhook_secret ?? ""}
              onChange={(e) =>
                setMerchant((m) => ({ ...m, webhook_secret: e.target.value }))
              }
              placeholder="e.g. whsec_***"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Your Webhook URL (on your EC)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={merchant.webhook_url ?? ""}
              onChange={(e) =>
                setMerchant((m) => ({ ...m, webhook_url: e.target.value }))
              }
              placeholder="https://your-ec.example.com/api/crypto-webhook"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSave || saving}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
          {msg && <div className="text-green-700 text-sm">{msg}</div>}
          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
      </form>

      <form onSubmit={onCreateLink} className="space-y-4 border rounded-xl p-4">
        <h2 className="font-semibold">Create test payment link</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Description</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Sample order #1234"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Amount ({merchant.default_currency})</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!canCreateLink}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          Create draft link
        </button>
      </form>
    </div>
  );
}
