import React from "react";
import { InfoHero, PageFooter, PageHeader, SITE_PHONE, SITE_PHONE_HREF } from "./InfoShell.jsx";

export default function PartnersSTO() {
  return (
    <div className="info-page">
      <PageHeader action="Стати партнером" />
      <main>
        <InfoHero
          eyebrow="Diesel Hub для СТО"
          title="Надійний партнер"
          accent="для дизельного сервісу"
          lead="Допомагаємо СТО швидше закривати складні ремонти: підбираємо форсунки та ПНВТ, перевіряємо компоненти й погоджуємо партнерські умови під конкретне замовлення."
          meta="Підбір за номером · Перевірка на стенді · Гарантія на роботи"
        />

        <section className="service-section">
          <div className="info-container">
            <div className="service-heading">
              <div className="info-eyebrow info-eyebrow-dark">Партнерські можливості</div>
              <h2>Менше часу на пошук — більше завершених ремонтів</h2>
              <p>Умови та розмір знижки погоджуються індивідуально залежно від деталей, робіт і обсягу співпраці.</p>
            </div>
            <div className="service-card-grid service-card-grid-three">
              <article className="service-card">
                <span className="service-card-number">01</span>
                <h3>Точний підбір</h3>
                <p>Звіряємо OEM і крос-номери, допомагаємо знайти сумісну деталь без зайвих замовлень.</p>
              </article>
              <article className="service-card service-card-accent">
                <span className="service-card-number">02</span>
                <h3>Діагностика та ремонт</h3>
                <p>Перевіряємо компоненти дизельної системи та погоджуємо необхідний обсяг робіт.</p>
              </article>
              <article className="service-card">
                <span className="service-card-number">03</span>
                <h3>Партнерські умови</h3>
                <p>Формуємо пропозицію для СТО з урахуванням типу замовлення та регулярності звернень.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="service-process-section">
          <div className="info-container service-process-grid">
            <div>
              <div className="info-eyebrow info-eyebrow-dark">Початок співпраці</div>
              <h2>Простий робочий процес</h2>
              <p className="service-process-lead">Без складних форм і довгого погодження. Зв’язуємося, уточнюємо задачу та пропонуємо рішення.</p>
            </div>
            <ol className="service-process-list">
              <li><span>01</span><div><strong>Залишаєте запит</strong><p>Повідомляєте номер деталі, автомобіль або описуєте необхідні роботи.</p></div></li>
              <li><span>02</span><div><strong>Уточнюємо задачу</strong><p>Перевіряємо доступні варіанти й погоджуємо партнерські умови.</p></div></li>
              <li><span>03</span><div><strong>Виконуємо замовлення</strong><p>Проводимо діагностику, ремонт або готуємо потрібні запчастини.</p></div></li>
              <li><span>04</span><div><strong>Надаємо гарантію</strong><p>Фіксуємо погоджені умови та залишаємося на зв’язку після отримання.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="sto-details-section">
          <div className="info-container sto-details-grid">
            <div className="sto-details-main">
              <div className="info-eyebrow">Для кого</div>
              <h2>СТО та майстерні, які працюють з дизельними системами</h2>
              <p>Підходимо як для разових складних запитів, так і для постійної співпраці.</p>
            </div>
            <div className="sto-detail-list">
              <div><span>Асортимент</span><strong>Форсунки, ПНВТ і комплектуючі</strong></div>
              <div><span>Логістика</span><strong>Нова пошта по всій Україні</strong></div>
              <div><span>Оплата</span><strong>Готівкова або безготівкова</strong></div>
              <div><span>Підтримка</span><strong>Прямий зв’язок з менеджером</strong></div>
            </div>
          </div>
        </section>

        <section className="service-callout-section">
          <div className="info-container">
            <div className="service-callout">
              <div>
                <div className="info-eyebrow">Обговоримо ваші задачі</div>
                <h2>Потрібен надійний постачальник для СТО?</h2>
                <p>Зателефонуйте менеджеру — узгодимо формат співпраці та умови для вашого сервісу.</p>
              </div>
              <a href={SITE_PHONE_HREF} className="service-phone-card">
                <span>Партнерський відділ</span>
                <strong>{SITE_PHONE}</strong>
              </a>
            </div>
          </div>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
