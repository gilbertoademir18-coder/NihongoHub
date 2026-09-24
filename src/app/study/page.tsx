import { Suspense } from "react";
import { StudyRoute } from "@/components/study-route";

export const metadata = {
  title: "Revisar — NihongoHub",
};

export default function StudyPage() {
  return (
    // `useSearchParams` exige um limite de Suspense para que a página em si
    // continue estática — que é o que a torna utilizável offline.
    <Suspense
      fallback={
        <div className="h-64 animate-pulse rounded-xl border border-border bg-surface-muted" />
      }
    >
      <StudyRoute />
    </Suspense>
  );
}
