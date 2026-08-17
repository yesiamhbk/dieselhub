import React from "react";

export const SITE_PHONE = "066 550 70 55";
export const SITE_PHONE_HREF = "tel:+380665507055";

export function PageHeader({ action = "Допомога з підбором" }) {
  return (
    <header className="info-header">
      <div className="info-container info-header-inner">
        <a href="#/" className="info-brand" aria-label="Diesel Hub — головна">
          <img src="/dh-logo-brand.png" alt="" />
          <strong>Diesel Hub</strong>
        </a>
        <nav className="info-nav" aria-label="Основна навігація">
          <a href="#/">Каталог</a>
          <a href="#/trade-in">Trade-In</a>
          <a href="#/warranty">Гарантія</a>
          <a href="#/partners-sto">Для СТО</a>
        </nav>
        <div className="info-header-actions">
          <a className="info-header-phone" href={SITE_PHONE_HREF}>{SITE_PHONE}</a>
          <a className="info-header-cta" href={SITE_PHONE_HREF}>{action}</a>
        </div>
      </div>
    </header>
  );
}

export function InfoHero({ eyebrow, title, accent, lead, meta }) {
  return (
    <section className="info-hero">
      <div className="info-container info-hero-inner">
        <div className="info-eyebrow">{eyebrow}</div>
        <h1>{title} {accent && <span>{accent}</span>}</h1>
        {lead && <p>{lead}</p>}
        {meta && <div className="info-hero-meta">{meta}</div>}
      </div>
    </section>
  );
}

export function PolicySection({ number, title, children }) {
  return (
    <section className="policy-section">
      <div className="policy-section-number">{number}</div>
      <div className="policy-section-body">
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function PageFooter() {
  return (
    <footer className="info-footer">
      <div className="info-container info-footer-inner">
        <div>
          <strong>Diesel Hub</strong>
          <span>Форсунки та ПНВТ з перевіркою і гарантією</span>
        </div>
        <nav aria-label="Юридична інформація">
          <a href="#/offer">Оферта</a>
          <a href="#/privacy">Конфіденційність</a>
          <a href="#/payment">Оплата і доставка</a>
        </nav>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
