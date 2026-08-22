import { Suspense } from "react";
import BetoTrainingApp from "@/components/BetoTrainingApp";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <BetoTrainingApp />
    </Suspense>
  );
}
