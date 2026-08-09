import type { ReactNode } from "react";
import Link from "next/link";
import { AmbientBackground, ThemeToggle } from "@/components/theme";
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

      <div className="auth-page-atmosphere" aria-hidden="true">
        <span className="auth-page-atmosphere__lumen" />
        <span className="auth-page-atmosphere__smoke auth-page-atmosphere__smoke--far" />
        <span className="auth-page-atmosphere__smoke auth-page-atmosphere__smoke--mid" />
        <span className="auth-page-atmosphere__smoke auth-page-atmosphere__smoke--near" />
        <span className="auth-page-atmosphere__texture" />
      </div>

      <header className="auth-navbar">
        <Link className="brand-lockup" href="/" aria-label={brand.name}>
          <span className="brand-mark" aria-hidden="true"><span>{brand.shortName}</span></span>
          <strong>{brand.name}</strong>
        </Link>
        <ThemeToggle />
      </header>

      <main className="auth-layout">
        <section className="auth-story" aria-label="Tentang Kenangin.id">
          <div className="auth-window-scene" aria-hidden="true">
            <div className="auth-window-scene__sky">
              <div className="auth-window-scene__stars" />
              <div className="auth-window-scene__sun-source" />
              <div className="auth-window-scene__horizon" />

              <div className="auth-window-scene__comet-stage">
                {(["a", "b", "c", "d"] as const).map((track) => (
                  <span
                    className={`auth-window-scene__comet auth-window-scene__comet--${track}`}
                    key={track}
                  >
                    <span className="auth-window-scene__comet-tail" />
                    <span className="auth-window-scene__comet-halo" />
                    <span className="auth-window-scene__comet-core" />
                  </span>
                ))}
              </div>

            </div>

            <div className="auth-window-scene__morning-rays" aria-hidden="true">
              <span className="auth-window-scene__morning-ray auth-window-scene__morning-ray--one" />
              <span className="auth-window-scene__morning-ray auth-window-scene__morning-ray--two" />
              <span className="auth-window-scene__morning-ray auth-window-scene__morning-ray--three" />
            </div>

            <div className="auth-window-scene__morning-bird-stage" aria-hidden="true">
              <span className="auth-window-scene__morning-bird-flight">
                <span className="auth-window-scene__morning-bird auth-window-scene__morning-bird--lead" />
                <span className="auth-window-scene__morning-bird auth-window-scene__morning-bird--left" />
                <span className="auth-window-scene__morning-bird auth-window-scene__morning-bird--right" />
              </span>
            </div>

            <div className="auth-window-scene__glass" />

            <div className="auth-window-scene__atmosphere">
              <div className="auth-window-scene__lumen" />
              <span className="auth-window-scene__fog auth-window-scene__fog--one" />
              <span className="auth-window-scene__fog auth-window-scene__fog--two" />
              <span className="auth-window-scene__fog auth-window-scene__fog--three" />
            </div>

            <div className="auth-window-scene__frame">
              <span className="auth-window-scene__bar auth-window-scene__bar--vertical" />
              <span className="auth-window-scene__bar auth-window-scene__bar--horizontal-one" />
              <span className="auth-window-scene__bar auth-window-scene__bar--horizontal-two" />
            </div>
          </div>

          <p className="ui-eyebrow">{eyebrow}</p>
          <div className="auth-story__title-row">
            <h1>{title}</h1>
          </div>
          <p className="auth-story__description">{description}</p>
          <div className="auth-story__steps" aria-label="Alur Kenangin.id">
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
