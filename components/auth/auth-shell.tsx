import type { ReactNode } from "react";
import Link from "next/link";
import { AmbientBackground, ThemeToggle } from "@/components/theme";
import { SparklesIcon } from "@/components/ui";
import { brand } from "@/config/brand";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="auth-page">
      <AmbientBackground />
      <header className="auth-navbar">
        <Link className="brand-lockup" href="/" aria-label={brand.name}>
          <span className="brand-mark" aria-hidden="true"><span>{brand.shortName}</span></span>
          <strong>{brand.name}</strong>
        </Link>
        <ThemeToggle />
      </header>

      <main className="auth-layout">
        <section className="auth-story" aria-label="Tentang Kenangin">
          <div className="auth-story__halo" aria-hidden="true" />
          <p className="ui-eyebrow">{eyebrow}</p>
          <div className="auth-story__title-row">
            <h1>{title}</h1>
            <span><SparklesIcon size={22} /></span>
          </div>
          <p className="auth-story__description">{description}</p>
          <div className="auth-story__steps" aria-label="Alur Kenangin">
            <div><strong>01</strong><span>Buat Room</span></div>
            <div><strong>02</strong><span>Kumpulkan momen</span></div>
            <div><strong>03</strong><span>Susun kejutan</span></div>
          </div>
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card">
            {children}
            <div className="auth-card__footer">{footer}</div>
          </div>
        </section>
      </main>
    </div>
  );
}
