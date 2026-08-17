import React from "react";

const PHONE_HREF = "tel:+380665507055";

const assessmentPoints = [
  ["Маркування", "Виробник і номер деталі"],
  ["Комплектність", "Наявність усіх основних елементів"],
  ["Зовнішній стан", "Корпус, роз’єми та сліди втручання"],
  ["Результат перевірки", "Фактичний технічний стан деталі"],
];

export default function TradeIn() {
  return (
    <div className="trade-page">
      <header className="trade-header">
        <div className="trade-container trade-header-inner">
          <a href="#/" className="trade-brand" aria-label="Diesel Hub — головна">
            <img src="/dh-logo-brand.png" alt="" />
            <strong>Diesel Hub</strong>
          </a>

          <nav className="trade-nav" aria-label="Навігація сторінки Trade-In">
            <a href="#/">Каталог</a>
            <a href="#/warranty">Гарантія</a>
            <a href="#/partners-sto">Для СТО</a>
          </nav>

          <div className="trade-header-actions">
            <a className="trade-header-phone" href={PHONE_HREF}>066 550 70 55</a>
            <a className="trade-header-cta" href={PHONE_HREF}>Узгодити відправлення</a>
          </div>
        </div>
      </header>

      <main>
        <section className="trade-hero">
          <div className="trade-container trade-hero-grid">
            <div className="trade-hero-copy">
              <div className="trade-eyebrow">Trade-In та викуп форсунок</div>
              <h1>Старі форсунки можуть стати <span>вигідною пропозицією</span></h1>
              <p>
                Обміняйте форсунки чи ПНВТ з доплатою або продайте непотрібні деталі
                Diesel Hub. Після отримання перевіримо їх і запропонуємо суму викупу або знижку на покупку.
              </p>

              <div className="trade-hero-actions">
                <a className="trade-button trade-button-primary" href={PHONE_HREF}>Узгодити відправлення</a>
                <a className="trade-button trade-button-ghost" href="#/">Обрати деталь у каталозі</a>
              </div>

              <div className="trade-hero-notes" aria-label="Основні переваги">
                <span>Оцінка за реальним станом</span>
                <span>Відправлення Новою поштою</span>
                <span>Працюємо по всій Україні</span>
              </div>
            </div>

            <aside className="trade-choice-card" aria-label="Варіанти співпраці">
              <div className="trade-choice-label">Оберіть свій варіант</div>
              <div className="trade-choice-row">
                <b>01</b>
                <div>
                  <strong>Trade-In</strong>
                  <span>Вартість старих деталей зарахуємо у вашу наступну покупку.</span>
                </div>
              </div>
              <div className="trade-choice-row">
                <b>02</b>
                <div>
                  <strong>Викуп</strong>
                  <span>Ви отримуєте гроші за форсунки, які вам більше не потрібні.</span>
                </div>
              </div>
              <div className="trade-choice-footer">
                Спочатку узгоджуємо відправлення. Остаточну пропозицію надаємо після отримання та перевірки деталей.
              </div>
            </aside>
          </div>
        </section>

        <section className="trade-options-section">
          <div className="trade-container">
            <div className="trade-section-heading">
              <div className="trade-eyebrow trade-eyebrow-dark">Два способи отримати вигоду</div>
              <h2>Не залишайте старі деталі лежати без діла</h2>
              <p>Менеджер допоможе обрати формат, який буде вигіднішим у вашій ситуації.</p>
            </div>

            <div className="trade-options-grid">
              <article className="trade-option-card">
                <div className="trade-option-topline">
                  <span>01</span>
                  <small>Якщо потрібна інша деталь</small>
                </div>
                <h3>Обмін з доплатою</h3>
                <p>
                  Передайте нам старі форсунки або ПНВТ. Після оцінки їхня вартість
                  стане знижкою на нові чи відновлені деталі з нашого каталогу.
                </p>
                <ul>
                  <li>Менше витрат на наступну покупку</li>
                  <li>Підбір сумісної деталі за номером</li>
                  <li>Гарантія 6 місяців на придбаний товар</li>
                </ul>
                <a href="#/" className="trade-text-link">Перейти до каталогу <span>→</span></a>
              </article>

              <article className="trade-option-card trade-option-card-accent">
                <div className="trade-option-topline">
                  <span>02</span>
                  <small>Якщо деталі більше не потрібні</small>
                </div>
                <h3>Викуп форсунок</h3>
                <p>
                  Викупимо непотрібні форсунки за вигідною ціною. Розглядаємо деталі
                  у різному стані — остаточна сума залежить від комплектності та перевірки.
                </p>
                <ul>
                  <li>Оцінка після отримання та перевірки</li>
                  <li>Зрозуміле погодження фінальної суми</li>
                  <li>Жодного продажу без вашої згоди</li>
                </ul>
                <a href={PHONE_HREF} className="trade-text-link">Запропонувати форсунки <span>→</span></a>
              </article>
            </div>
          </div>
        </section>

        <section className="trade-process-section">
          <div className="trade-container">
            <div className="trade-process-intro">
              <div className="trade-eyebrow trade-eyebrow-dark">Як усе відбувається</div>
              <h2>Від відправлення до пропозиції — чотири прості кроки</h2>
            </div>

            <ol className="trade-steps">
              <li>
                <span>01</span>
                <h3>Узгодьте відправлення</h3>
                <p>Зателефонуйте менеджеру та повідомте, які деталі хочете передати.</p>
              </li>
              <li>
                <span>02</span>
                <h3>Надішліть запчастини</h3>
                <p>Після погодження відправте форсунки або ПНВТ Новою поштою.</p>
              </li>
              <li>
                <span>03</span>
                <h3>Перевіримо деталі</h3>
                <p>Оглянемо комплектність і технічний стан після отримання.</p>
              </li>
              <li>
                <span>04</span>
                <h3>Отримайте пропозицію</h3>
                <p>Запропонуємо суму викупу або знижку на іншу деталь — вибір за вами.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="trade-assessment-section">
          <div className="trade-container trade-assessment-grid">
            <div className="trade-assessment-copy">
              <div className="trade-eyebrow">Чесна оцінка</div>
              <h2>Ціна залежить не лише від зовнішнього вигляду</h2>
              <p>
                Дві однакові форсунки можуть мати різний технічний стан, тому точну
                пропозицію формуємо лише після отримання, огляду та перевірки запчастин.
              </p>
              <div className="trade-accept-note">
                <span>Приймаємо</span>
                <strong>Common Rail форсунки Bosch, Denso, Delphi, Siemens/VDO та ПНВТ</strong>
              </div>
            </div>

            <div className="trade-assessment-list">
              {assessmentPoints.map(([title, text], index) => (
                <div className="trade-assessment-row" key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="trade-faq-section">
          <div className="trade-container trade-faq-grid">
            <div>
              <div className="trade-eyebrow trade-eyebrow-dark">Коротко про важливе</div>
              <h2>Перед відправленням</h2>
            </div>
            <div className="trade-faq-list">
              <details>
                <summary>Коли я дізнаюся точну ціну?</summary>
                <p>Суму викупу або розмір знижки повідомимо після того, як отримаємо та перевіримо запчастини.</p>
              </details>
              <details>
                <summary>Що буде, якщо фінальна сума мене не влаштує?</summary>
                <p>Без вашого підтвердження ми не оформлюємо ані обмін, ані викуп. Подальші дії та повернення деталей погоджуємо окремо.</p>
              </details>
              <details>
                <summary>Чи можна надіслати деталі з іншого міста?</summary>
                <p>Так, працюємо по Україні через Нову пошту. Перед відправленням обов’язково узгодьте дані з менеджером.</p>
              </details>
            </div>
          </div>
        </section>

        <section className="trade-final-section">
          <div className="trade-container">
            <div className="trade-final-card">
              <div>
                <div className="trade-eyebrow">Почніть з відправлення</div>
                <h2>Передайте запчастини на перевірку Diesel Hub</h2>
                <p>Зателефонуйте менеджеру — він погодить дані для відправлення Новою поштою.</p>
              </div>
              <a href={PHONE_HREF} className="trade-final-contact">
                <span>Зателефонувати менеджеру</span>
                <strong>066 550 70 55</strong>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="trade-footer">
        <div className="trade-container">
          <span>© {new Date().getFullYear()} Diesel Hub</span>
          <span>Форсунки та ПНВТ з перевіркою і гарантією</span>
        </div>
      </footer>
    </div>
  );
}
