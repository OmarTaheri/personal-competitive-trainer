"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, refreshHeader } from "@/lib/ui";

export function SolvedToggle({ id, solved }: { id: number; solved: boolean }) {
  const [s, setS] = useState(solved);
  return (
    <button title={s ? "Marked solved — click to unmark" : "Mark as solved"}
      onClick={async () => { await api(`/api/problems/${id}`, { solved: !s }); setS(!s); }}
      className={`grid h-6 w-6 place-items-center rounded-md border text-xs ${s ? "border-green bg-green text-white" : "border-line text-transparent hover:border-green/60"}`}>
      ✓
    </button>
  );
}

export function TrainThis({ id, url }: { id: number; url: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn !px-2.5 !py-1 !text-xs" disabled={busy} title="Start a timed attempt on this problem now"
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/train", { action: "start", problemId: id });
          refreshHeader();
          router.push("/train");
        } catch (e) {
          alertFallback((e as Error).message);
        } finally { setBusy(false); }
      }}>
      ▶ Train
    </button>
  );
}

function alertFallback(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-panel2 px-4 py-2 text-sm text-red shadow-xl border border-red/40 z-50";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
