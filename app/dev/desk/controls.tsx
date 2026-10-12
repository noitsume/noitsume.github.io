"use client";
import { prepareDeskArrival } from "@/lib/dashboard/arrival";

export function DeskLabControls() {
  return <button className="ui-button ui-button--secondary" type="button" onClick={() => {
    prepareDeskArrival("/dashboard");
    location.reload();
  }}>Ulangi kedatangan</button>;
}
