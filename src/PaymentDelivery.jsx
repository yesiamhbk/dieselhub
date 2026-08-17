import React from "react";
import { InfoHero, PageFooter, PageHeader, SITE_PHONE_HREF } from "./InfoShell.jsx";

export default function PaymentDelivery() {
  return (
    <div className="info-page">
      <PageHeader action="Уточнити доставку" />
      <main>
        <InfoHero
          eyebrow="Оплата та доставка"
          title="Отримайте замовлення"
          accent="зручним способом"
          lead="Відправляємо форсунки, ПНВТ і комплектуючі Новою поштою по всій Україні. Менеджер підтвердить наявність і деталі перед відправленням."
          meta="Щоденне відправлення · Нова пошта · Перевірка перед пакуванням"
        />

        <section className="service-section">
          <div className="info-container">
            <div className="service-heading">
              <div className="info-eyebrow info-eyebrow-dark">Оберіть варіант</div>
              <h2>Оплата без зайвих складнощів</h2>
            </div>
            <div className="service-card-grid service-card-grid-two">
              <article className="service-card">
                <span className="service-card-number">01</span>
                <h3>Накладений платіж</h3>
                <p>Оплата під час отримання у відділенні або поштоматі Нової пошти.</p>
                <div className="service-card-note">Доставку та комісію перевізника сплачує покупець за тарифами Нової пошти.</div>
              </article>
              <article className="service-card service-card-accent">
                <span className="service-card-number">02</span>
                <h3>Передплата за реквізитами</h3>
                <p>Менеджер надає реквізити після підтвердження товару та замовлення.</p>
                <div className="service-card-note">За умовами поточної пропозиції доставку оплачує Diesel Hub.</div>
              </article>
            </div>
          </div>
        </section>

        <section className="service-process-section">
          <div className="info-container service-process-grid">
            <div>
              <div className="info-eyebrow info-eyebrow-dark">Як відправляємо</div>
              <h2>Від підтвердження до отримання</h2>
            </div>
            <ol className="service-process-list">
              <li><span>01</span><div><strong>Підтверджуємо</strong><p>Уточнюємо номер деталі, сумісність, стан і наявність.</p></div></li>
              <li><span>02</span><div><strong>Перевіряємо</strong><p>Оглядаємо товар та готуємо його до безпечного транспортування.</p></div></li>
              <li><span>03</span><div><strong>Відправляємо</strong><p>Передаємо замовлення Новій пошті, як правило, у робочий день після підтвердження або оплати.</p></div></li>
              <li><span>04</span><div><strong>Повідомляємо</strong><p>Надаємо дані відправлення для відстеження посилки.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="service-callout-section">
          <div className="info-container">
            <div className="service-callout">
              <div>
                <div className="info-eyebrow">Повернення та обмін</div>
                <h2>Потрібно повернути товар?</h2>
                <p>Спочатку погодьте звернення з менеджером. Повернення оформлюється через Нову пошту відповідно до гарантійних умов.</p>
              </div>
              <div className="service-callout-actions">
                <a href="#/warranty" className="info-button info-button-primary">Умови гарантії</a>
                <a href={SITE_PHONE_HREF} className="info-button info-button-dark">Зателефонувати</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
