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
import Clientes from "@/components/screens/Clientes";
import Ficha from "@/components/screens/Ficha";
import Builder from "@/components/screens/Builder";
import Asignar from "@/components/screens/Asignar";
import ExportPdf from "@/components/screens/ExportPdf";
import ServiciosAdmin from "@/components/screens/ServiciosAdmin";

export default function BetoTrainingApp() {
  const vals = useBetoApp();
  const esAdmin = vals.auth === "ADMIN";

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)" }}>
      <Header vals={vals} />

      {vals.isLanding && <Landing vals={vals} />}
      {vals.isReservar && <Reservar vals={vals} />}
      {vals.isCheckout && <Checkout vals={vals} />}
      {vals.isConfirm && <Confirm vals={vals} />}
      {vals.isLogin && <Login vals={vals} />}
      {vals.isCuenta && <Cuenta vals={vals} />}
      {vals.isCoach && esAdmin && <Coach vals={vals} />}
      {vals.isClientes && esAdmin && <Clientes vals={vals} />}
      {vals.isFicha && esAdmin && <Ficha vals={vals} />}
      {vals.isBuilder && esAdmin && <Builder vals={vals} />}
      {vals.isAsignar && esAdmin && <Asignar vals={vals} />}
      {vals.isPdf && esAdmin && <ExportPdf vals={vals} />}
      {vals.isServiciosAdmin && esAdmin && <ServiciosAdmin vals={vals} />}

      <ToastBar vals={vals} />
    </div>
  );
}