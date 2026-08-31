"use client";

import { signIn } from "next-auth/react";

export default function GoogleButton({ label = "Continuar con Google" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/" })}
      className="btn btn-secondary btn-block"
      style={{ height: 44, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}
    >
      <i className="ph ph-google-logo" style={{ fontSize: 18 }} />
      {label}
    </button>
  );
}
