"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { releaseDeskArrival } from "@/lib/dashboard/arrival";
import { useTheme } from "@/components/theme/theme-provider";

const subscribe = (notify: () => void) => {
  document.addEventListener("kenangin:desk-ready", notify);
  return () => document.removeEventListener("kenangin:desk-ready", notify);
};
const ready = () => Boolean(document.querySelector('.dashboard-desk[data-ready="true"]'));
const serverReady = () => false;

const subscribeArrival = (notify: () => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-desk-entry"] });
  return () => observer.disconnect();
};
const arriving = () => Boolean(document.documentElement.dataset.deskEntry);

export function DeskArrivalOverlay() {
  const active = useSyncExternalStore(subscribeArrival, arriving, serverReady);
  if (!active) return null;
  return <div className="desk-arrival-caption">
    <span>KENANGIN / SELAMAT DATANG</span>
    <button type="button" onClick={releaseDeskArrival}>Langsung ke workspace <span aria-hidden="true">↗</span></button>
  </div>;
}

export function DeskExploreButton() {
  const enabled = useSyncExternalStore(subscribe, ready, serverReady);
  return <button className="desk-explore-button" type="button" disabled={!enabled}
    title={enabled ? "Lihat ruang meja Anda" : "Tampilan meja statis"}
    onClick={() => document.dispatchEvent(new Event("kenangin:desk-explore"))}>
    <span className="desk-explore-button__icon" aria-hidden="true">↗</span>
    <span>Jelajahi meja<small>Sebuah ruang untuk ceritamu</small></span>
  </button>;
}

export function DeskTourOverlay() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [lit, setLit] = useState(true);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const update = (event: Event) => {
      setOpen((event as CustomEvent<boolean>).detail);
      setLit(true);
    };
    document.addEventListener("kenangin:desk-tour", update);
    return () => document.removeEventListener("kenangin:desk-tour", update);
  }, []);
  useEffect(() => { if (open) back.current?.focus({ preventScroll: true }); }, [open]);
  if (!open) return null;
  return <div className="desk-tour" role="dialog" aria-modal="true" aria-label="Meja kenangan"
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
      const next = event.shiftKey ? buttons.at(-1) : buttons[0];
      if ((event.shiftKey && document.activeElement === buttons[0]) || (!event.shiftKey && document.activeElement === buttons.at(-1))) {
        event.preventDefault(); next?.focus();
      }
    }}>
    <div className="desk-tour__caption">
      <span className="ui-eyebrow">KENANGIN · {theme === "light" ? "CAHAYA PAGI" : "RUANG PERSONAL"}</span>
      <p>Cerita kecil.<br /><em>Tempat yang berarti.</em></p>
      <span className="desk-tour__hint">Gerakkan kursor untuk melihat sekeliling.</span>
    </div>
    <div className="desk-tour__actions">
    {theme === "dark" ? <button type="button" className="desk-tour__light" aria-pressed={lit} onClick={() => {
      setLit(!lit); document.dispatchEvent(new CustomEvent("kenangin:desk-lamp", { detail: !lit }));
    }}><span aria-hidden="true">☼</span>{lit ? "Redupkan lampu" : "Nyalakan lampu"}</button>
      : <span className="desk-tour__daylight"><span aria-hidden="true">☼</span> Diterangi cahaya pagi</span>}
    <button ref={back} type="button" className="desk-tour__return"
      onClick={() => document.dispatchEvent(new Event("kenangin:desk-return"))}>
      Kembali ke workspace <span aria-hidden="true">↗</span>
    </button>
    </div>
  </div>;
}
