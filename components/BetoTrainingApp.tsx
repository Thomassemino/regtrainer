"use client";

import { useBetoApp } from "@/hooks/useBetoApp";
import Header from "@/components/Header";
import ToastBar from "@/components/ToastBar";
import Landing from "@/components/screens/Landing";
import Reservar from "@/components/screens/Reservar";
import Checkout from "@/components/screens/Checkout";
import Confirm from "@/components/screens/Confirm";
import Login from "@/components/screens/Login";
import Cuenta from "@/components/screens/Cuenta";
import Coach from "@/components/screens/Coach";

export default function BetoTrainingApp() {
  const vals = useBetoApp();

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)" }}>
      <Header vals={vals} />

      {vals.isLanding && <Landing vals={vals} />}
      {vals.isReservar && <Reservar vals={vals} />}
      {vals.isCheckout && <Checkout vals={vals} />}
      {vals.isConfirm && <Confirm vals={vals} />}
      {vals.isLogin && <Login vals={vals} />}
      {vals.isCuenta && <Cuenta vals={vals} />}
      {vals.isCoach && <Coach vals={vals} />}

      <ToastBar vals={vals} />
    </div>
  );
}
