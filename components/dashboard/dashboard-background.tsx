import { Suspense } from "react";
import { DashboardDesk } from "./dashboard-desk";
import { DeskFallback } from "./desk-fallback";

/** Keep the server-rendered workspace available while its visual island loads. */
export function DashboardBackground() {
  return <Suspense fallback={<div className="dashboard-desk" aria-hidden="true">
    <DeskFallback /><div className="dashboard-desk__vignette" />
  </div>}><DashboardDesk /></Suspense>;
}
