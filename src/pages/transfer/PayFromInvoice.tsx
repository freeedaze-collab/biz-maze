// src/pages/transfer/PayFromInvoice.tsx
// PDF をアップロード → pdfjs-dist でテキスト抽出 → 受取人・金額・通貨らしき値を推測
// 足りない箇所は手動補完 → /transfer/new と同じレビュー→送金フローを踏ませる
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// ★ 追加パッケージが必要です： npm i pdfjs-dist
// vite 用に workerSrc を設定
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?worker&url";
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorker;

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");
const findAddress = (text: string) => {
  const m = text.match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0] : "";
};
const findAmount = (text: string) => {
  const m = text.match(/([0-9]+(?:\.[0-9]{1,18})?)\s?(ETH)?/i);
  return m ? m[1] : "";
};

export default function PayFromInvoice() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const typedarray = new Uint8Array(reader.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const c = await page.getTextContent();
          text += c.items.map((it: any) => it.str).join(" ") + "\n";
        }
        setPreview(text.slice(0, 1500)); // 簡易プレビュー
        // 推測抽出
        const addr = findAddress(text);
        const amt = findAmount(text);
        if (addr) setTo(addr);
        if (amt) setAmount(amt);
      } catch (e: any) {
        setMsg(e?.message || String(e));
      }
    };
    reader.readAsArrayBuffer(file);
  }, [file]);

  const validAddr = useMemo(() => isEthAddress(to), [to]);
  const validAmt = useMemo(() => !!amount && /^[0-9]+(\.[0-9]{1,18})?$/.test(amount), [amount]);

  const goReview = () => {
    if (!validAddr) { setMsg("Please enter a valid Ethereum address (0x...)."); return; }
    if (!validAmt) { setMsg("Please enter a valid amount (ETH)."); return; }
    nav(`/transfer/new?to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}`);
  };

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Pay From Invoice (PDF)</h1>
      <div className="rounded-xl border p-4 space-y-3">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setMsg(null); setPreview(""); }}
        />
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Detected Recipient (0x...)</label>
            <input
              className={`w-full border rounded px-2 py-1 font-mono ${to && !validAddr ? "border-red-500" : ""}`}
              placeholder="0x..."
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Detected Amount (ETH)</label>
            <input
              className={`w-full border rounded px-2 py-1 ${amount && !validAmt ? "border-red-500" : ""}`}
              placeholder="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
            />
          </div>
        </div>

        <button
          className="bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50"
          onClick={goReview}
          disabled={!validAddr || !validAmt}
        >
          Review & Continue
        </button>

        {preview && (
          <details className="text-xs">
            <summary className="cursor-pointer">Preview extracted text</summary>
            <pre className="whitespace-pre-wrap">{preview}</pre>
          </details>
        )}

        {msg && <div className="text-sm text-red-600">{msg}</div>}
      </div>
    </div>
  );
}
