import type { BetoVals } from "@/hooks/useBetoApp";

export default function ToastBar({ vals }: { vals: BetoVals }) {
  return (
    <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 28, display: vals.toastShow as "block" | "none", zIndex: 90 }}>
      <div style={{ animation: "betoIn .25s ease both", padding: "12px 18px", borderRadius: 10, background: "var(--color-neutral-900)", boxShadow: "var(--shadow-md)", fontSize: 13.5, display: "flex", gap: 9, alignItems: "center" }}>
        <i className="ph ph-check-circle" style={{ color: "var(--color-accent)" }} />
        {vals.toast}
      </div>
    </div>
  );
}
