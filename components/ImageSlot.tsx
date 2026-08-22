import type { CSSProperties } from "react";

type Shape = "rect" | "rounded" | "circle";

interface ImageSlotProps {
  src?: string;
  alt: string;
  credit?: string;
  creditHref?: string;
  shape?: Shape;
  radius?: number;
  initials?: string;
  style?: CSSProperties;
  className?: string;
}

export default function ImageSlot({
  src, alt, credit, creditHref, shape = "rounded", radius = 12, initials, style, className,
}: ImageSlotProps) {
  const borderRadius = shape === "circle" ? "50%" : shape === "rect" ? 0 : radius;

  return (
    <div className={`img-slot ${className || ""}`} style={{ ...style, borderRadius, height: style?.height ?? "100%" }}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        <div className="avatar-fallback" style={{ fontSize: shape === "circle" ? "0.9em" : 14 }}>
          {initials || ""}
        </div>
      )}
      {credit && creditHref && (
        <a className="credit" href={creditHref} target="_blank" rel="noopener noreferrer">
          {credit}
        </a>
      )}
    </div>
  );
}
