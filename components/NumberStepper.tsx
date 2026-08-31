interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  format?: (value: number) => string;
}

export default function NumberStepper({
  value, onChange, step = 1, min = -Infinity, max = Infinity, disabled, format,
}: NumberStepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const botonEstilo = (habilitado: boolean) => ({
    width: 24,
    height: 24,
    minWidth: 0,
    padding: 0,
    borderRadius: 6,
    border: "1px solid var(--color-divider)",
    background: "var(--color-surface-sunken)",
    color: "var(--color-text)",
    fontSize: 15,
    lineHeight: 1,
    cursor: habilitado ? "pointer" : "not-allowed",
    opacity: habilitado ? 1 : 0.4,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(clamp(value - step))}
        style={botonEstilo(!disabled)}
        aria-label="Disminuir"
      >
        −
      </button>
      <span style={{ minWidth: 40, textAlign: "center", fontSize: 22, fontWeight: 500 }}>
        {format ? format(value) : value}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(clamp(value + step))}
        style={botonEstilo(!disabled)}
        aria-label="Aumentar"
      >
        +
      </button>
    </div>
  );
}
