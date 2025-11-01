// src/pages/Accounting.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type BuildResult = {
  pl: any;
  bs: any;
  cf: any;
};

export default function Accounting() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<BuildResult | null>(null);

  const run = async () => {
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      // fetch ではなく supabase.functions.invoke を使用
      const { data, error } = await supabase.functions.invoke("build-statements", {
        body: {}, // 必要になれば期間などを渡す
      });

      if (error) {
        // supabase-js 由来のエラー（CORS/401 含む）はここに乗る
        console.error("[build-statements] invoke error:", error);
        setErr(error.message ?? String(error));
        return;
      }

      // 非JSONなどが返った場合も拾う（data は any）
      if (!data || typeof data !== "object") {
        console.error("[build-statements] unexpected payload:", data);
        setErr("Unexpected response (not JSON?)");
        return;
      }

      setData(data as BuildResult);
    } catch (e: any) {
      console.error("[build-statements] exception:", e);
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 初回自動実行
    run();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Accounting / Tax</h1>
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={run}
        disabled={loading}
      >
        {loading ? "Building..." : "Build Statements"}
      </button>

      {err && (
        <div className="mt-4 text-red-600 whitespace-pre-wrap">
          Edge Function error: {err}
        </div>
      )}

      {data && (
        <pre className="mt-4 text-sm bg-muted p-4 rounded">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
