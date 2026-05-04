"use client";
import { useState } from "react";

export default function SweetwaterImportPage() {
  const [text, setPastedText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/parse-sweetwater", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <h1>Sweetwater Email Import</h1>
      <p>Paste the plain text of the Sweetwater email below and click Import.</p>
      <textarea
        rows={20}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
        value={text}
        onChange={(e) => setPastedText(e.target.value)}
        placeholder="Paste email text here..."
      />
      <br />
      <button onClick={handleImport} disabled={loading || !text}>
        {loading ? "Importing..." : "Import Events"}
      </button>
      {result && (
        <div style={{ marginTop: 24 }}>
          <strong>{result.inserted} events added to pending queue.</strong>
          {result.errors?.length > 0 && (
            <pre style={{ color: "red" }}>{JSON.stringify(result.errors, null, 2)}</pre>
          )}
          {result.skipped > 0 && (
            <p style={{ color: '#6b7280', fontSize: 13 }}>{result.skipped} skipped (already exist).</p>
          )}
        </div>
      )}
    </div>
  );
}