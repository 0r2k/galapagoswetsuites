"use client";
import { useState } from "react";

export default function SendTestButton({ templateId }: { templateId: string }) {
  const [to, setTo] = useState("");
  const [varsJson, setVarsJson] = useState("{}");

  const send = async () => {
    const res = await fetch(`/api/studio/templates/${templateId}/send-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, vars: varsJson })
    });
    alert(res.ok ? "Enviado" : await res.text());
  };

  return (
    <div className="border rounded p-3 space-y-2">
      <input className="border w-full px-3 py-2 rounded" placeholder="to@dominio.com"
             value={to} onChange={e => setTo(e.target.value)} />
      <textarea className="border w-full h-32 px-3 py-2 rounded font-mono text-sm"
                value={varsJson} onChange={e => setVarsJson(e.target.value)} />
      <button className="bg-black text-white px-3 py-2 rounded" onClick={send}>Enviar prueba</button>
    </div>
  );
}
