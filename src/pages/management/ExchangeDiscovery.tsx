// src/pages/management/ExchangeDiscovery.tsx
// Searchable Exchange Connection Page — 200+ exchanges via CCXT
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppPageLayout from "@/components/layout/AppPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Search, Link2, ExternalLink, Trash2, Building2, Shield, Star, ChevronDown, ChevronUp } from "lucide-react";
import {
    UNIQUE_EXCHANGES,
    FEATURED_EXCHANGES,
    searchExchanges,
    EXCHANGE_COUNT,
    type ExchangeEntry,
} from "@/config/exchangeCatalog";

type ConnectionRow = {
    id: number;
    exchange: string;
    connection_name: string;
    status: string;
    entity_id?: string | null;
    created_at: string;
};

type Entity = { id: string; name: string };

export default function ExchangeDiscovery() {
    const { user } = useAuth();
    const { toast } = useToast();

    // State
    const [selectedExchange, setSelectedExchange] = useState<ExchangeEntry | null>(null);

    // API credential form
    const [apiKey, setApiKey] = useState("");
    const [apiSecret, setApiSecret] = useState("");
    const [passphrase, setPassphrase] = useState("");
    const [connectionName, setConnectionName] = useState("");
    const [selectedEntityId, setSelectedEntityId] = useState("");
    const [connecting, setConnecting] = useState(false);

    // Existing connections
    const [connections, setConnections] = useState<ConnectionRow[]>([]);
    const [entities, setEntities] = useState<Entity[]>([]);
    const [loadingConns, setLoadingConns] = useState(true);


    // Load existing connections & entities
    const loadConnections = async () => {
        if (!user?.id) return;
        setLoadingConns(true);
        const { data } = await supabase
            .from("exchange_connections")
            .select("id, exchange, connection_name, status, entity_id, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
        setConnections(data ?? []);

        const { data: entData } = await supabase
            .from("entities")
            .select("id, name")
            .eq("user_id", user.id)
            .order("is_head_office", { ascending: false });
        if (entData) {
            setEntities(entData);
            if (!selectedEntityId && entData.length > 0) setSelectedEntityId(entData[0].id);
        }
        setLoadingConns(false);
    };

    useEffect(() => { loadConnections(); }, [user?.id]);

    // Handle exchange selection
    const handleSelect = (ex: ExchangeEntry) => {
        setSelectedExchange(ex);
        setConnectionName(`${ex.name} API`);
        setApiKey("");
        setApiSecret("");
        setPassphrase("");
    };

    // Handle connection
    const handleConnect = async () => {
        if (!user?.id || !selectedExchange) return;
        if (!apiKey.trim() || !apiSecret.trim()) {
            toast({ variant: "destructive", title: "API Key and Secret are required" });
            return;
        }
        if (selectedExchange.extraFields?.includes("passphrase") && !passphrase.trim()) {
            toast({ variant: "destructive", title: "Passphrase is required for this exchange" });
            return;
        }
        if (!selectedEntityId) {
            toast({ variant: "destructive", title: "Please select an entity" });
            return;
        }

        setConnecting(true);
        try {
            // Obtain session token
            const { data: { session }, error: sessErr } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (sessErr || !token) throw new Error("Authentication failed. Please log in again.");

            // Call the Edge Function for secure encryption and storage
            const response = await fetch("https://yelkjimxejmrkfzeumos.supabase.co/functions/v1/exchange-save-keys", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    exchange: selectedExchange.slug,
                    connection_name: connectionName.trim() || `${selectedExchange.name} API`,
                    api_key: apiKey.trim(),
                    api_secret: apiSecret.trim(),
                    api_passphrase: passphrase.trim() || undefined,
                    entity_id: selectedEntityId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || "Failed to secure credentials");
            }

            toast({ title: "✅ Connected!", description: `${selectedExchange.name} has been linked successfully and credentials secured.` });
            setSelectedExchange(null);
            setApiKey("");
            setApiSecret("");
            setPassphrase("");
            await loadConnections();
        } catch (e: any) {
            toast({ variant: "destructive", title: "Connection failed", description: e?.message });
        } finally {
            setConnecting(false);
        }
    };

    // Handle delete
    const handleDelete = async (connId: number) => {
        if (!confirm("Are you sure you want to remove this exchange connection?")) return;
        const { error } = await supabase.from("exchange_connections").delete().eq("id", connId);
        if (error) toast({ variant: "destructive", title: "Delete failed", description: error.message });
        else {
            toast({ title: "Connection removed" });
            await loadConnections();
        }
    };

    return (
        <AppPageLayout title="Exchange Connections" description={`Connect any of ${EXCHANGE_COUNT}+ supported exchanges via API keys.`}>
            <div className="max-w-4xl mx-auto space-y-8">

                {/* ── Add New Connection Form ── */}
                <Card className="shadow-lg border-primary/20 overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Add New Connection
                        </CardTitle>
                        <CardDescription>
                            Enter your API credentials. Read-only permissions are highly recommended for security.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left Column: Core Identity */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">1. Select Exchange <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                                        <select
                                            className="flex h-10 w-full rounded-md border bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                                            value={selectedExchange?.slug || ""}
                                            onChange={e => {
                                                const ex = UNIQUE_EXCHANGES.find(x => x.slug === e.target.value);
                                                if (ex) handleSelect(ex);
                                            }}
                                        >
                                            <option value="" disabled>Search or Select Exchange...</option>
                                            {UNIQUE_EXCHANGES.map(ex => (
                                                <option key={ex.slug} value={ex.slug}>{ex.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1 px-1">
                                        Over {EXCHANGE_COUNT} exchanges supported. Start typing above to find yours.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">2. Owner Company <span className="text-red-500">*</span></Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring transition-all"
                                        value={selectedEntityId}
                                        onChange={e => setSelectedEntityId(e.target.value)}
                                    >
                                        <option value="" disabled>Select Owner Company</option>
                                        {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">3. Connection Name</Label>
                                    <Input
                                        placeholder="e.g. My Trading Account"
                                        value={connectionName}
                                        onChange={e => setConnectionName(e.target.value)}
                                        className="h-10"
                                    />
                                </div>
                            </div>

                            {/* Right Column: Credentials */}
                            <div className="space-y-4 bg-muted/30 p-5 rounded-2xl border border-dashed border-muted-foreground/30 relative">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">API Key <span className="text-red-500">*</span></Label>
                                    <Input
                                        placeholder="Paste your API Key"
                                        value={apiKey}
                                        onChange={e => setApiKey(e.target.value)}
                                        className="font-mono h-10"
                                        type="password"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">API Secret <span className="text-red-500">*</span></Label>
                                    <Input
                                        placeholder="Paste your API Secret"
                                        value={apiSecret}
                                        onChange={e => setApiSecret(e.target.value)}
                                        className="font-mono h-10"
                                        type="password"
                                    />
                                </div>

                                {selectedExchange?.extraFields?.includes("passphrase") && (
                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-amber-600">Passphrase <span className="text-red-500">*</span></Label>
                                        <Input
                                            placeholder="Trading Passphrase"
                                            value={passphrase}
                                            onChange={e => setPassphrase(e.target.value)}
                                            className="border-amber-200 bg-amber-50/50 h-10"
                                            type="password"
                                        />
                                    </div>
                                )}

                                <div className="pt-4">
                                    <Button
                                        onClick={handleConnect}
                                        disabled={connecting || !selectedExchange}
                                        className="w-full h-11 shadow-lg bg-primary hover:bg-primary/90 transition-all active:scale-[0.98]"
                                    >
                                        {connecting ? "Connecting..." : (selectedExchange ? `Link ${selectedExchange.name}` : "Select Exchange First")}
                                    </Button>
                                    {selectedExchange?.url && (
                                        <div className="mt-3 flex justify-center">
                                            <a href={selectedExchange.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary/80 hover:text-primary hover:underline flex items-center gap-1 transition-colors">
                                                <ExternalLink className="h-3 w-3" /> Visit {selectedExchange.name} Website
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Existing Connections ── */}
                <Card className="border-none bg-transparent shadow-none">
                    <CardHeader className="px-0 pb-4">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-muted-foreground" />
                            Your Connections
                            <Badge variant="outline" className="ml-2 font-mono text-muted-foreground">
                                {connections.length}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-0">
                        {loadingConns ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
                            </div>
                        ) : connections.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground bg-card rounded-3xl border border-dashed flex flex-col items-center justify-center gap-2">
                                <Link2 className="h-8 w-8 opacity-20 mb-2" />
                                <p>No exchanges connected yet.</p>
                                <p className="text-xs">Select an exchange above to link your account.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {connections.map(conn => {
                                    const entityName = entities.find(e => e.id === conn.entity_id)?.name;
                                    return (
                                        <div key={conn.id} className="p-5 rounded-2xl border bg-card flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                                                        {conn.connection_name || conn.exchange}
                                                    </span>
                                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 uppercase tracking-wider h-4">
                                                        {conn.exchange}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                    {entityName && <span className="flex items-center gap-1 font-medium"><Building2 className="h-3.5 w-3.5" /> {entityName}</span>}
                                                    <span className="opacity-30">•</span>
                                                    <span className={conn.status === "linked" ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
                                                        {conn.status.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(conn.id)}
                                                className="p-2.5 rounded-full hover:bg-red-50 text-muted-foreground/40 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                                title="Remove connection"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppPageLayout>
    );
}
