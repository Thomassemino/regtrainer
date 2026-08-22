import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CoachPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }
  redirect("/?screen=coach");
}