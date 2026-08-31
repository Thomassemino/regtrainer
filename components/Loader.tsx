export default function Loader({ label = "Cargando…", minHeight = 200 }: { label?: string; minHeight?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, minHeight, padding: 40 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "3px solid rgba(244,244,245,.14)",
          borderTopColor: "var(--color-accent)",
          animation: "beto-spin 0.75s linear infinite",
        }}
      />
      <div style={{ fontSize: 13.5, opacity: 0.6, letterSpacing: "0.01em" }}>{label}</div>
      <style>{`@keyframes beto-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
