import React from "react";
import { InfoHero, PageFooter, PageHeader, PolicySection } from "./InfoShell.jsx";

export default function Privacy() {
  return (
    <div className="info-page">
      <PageHeader />
      <main>
        <InfoHero
          eyebrow="Захист персональних даних"
          title="Політика"
          accent="конфіденційності"
          lead="Пояснюємо, які дані потрібні для замовлення, як ми їх використовуємо та кому можемо передавати для доставки й оплати."
          meta={`Чинна редакція від ${new Date().toLocaleDateString("uk-UA")}`}
        />

        <section className="policy-layout-section legal-layout-section">
          <div className="info-container policy-layout">
            <aside className="policy-aside">
              <div className="info-eyebrow info-eyebrow-dark">Ваші права</div>
              <h2>Ви можете звернутися щодо</h2>
              <ul>
                <li>Доступу до своїх даних</li>
                <li>Виправлення інформації</li>
                <li>Видалення або обмеження</li>
                <li>Заперечення проти обробки</li>
              </ul>
            </aside>

            <div className="policy-sections">
              <PolicySection number="01" title="Контролер даних">
                <p>ФОП Волошин Денис Станіславович, РНОКПП 3728401193. Контактні дані для звернень зазначені на сайті.</p>
              </PolicySection>
              <PolicySection number="02" title="Які дані ми обробляємо">
                <ul>
                  <li>Ім’я, номер телефону, електронну пошту та адресу доставки.</li>
                  <li>Склад замовлення, суму, спосіб оплати й доставки.</li>
                  <li>Технічні журнали: IP-адресу, час події, версію згоди та ідентифікатори сесії.</li>
                </ul>
              </PolicySection>
              <PolicySection number="03" title="Навіщо потрібні дані">
                <ul>
                  <li>Для оформлення, оплати й доставки замовлення.</li>
                  <li>Для гарантійного обслуговування та повернення.</li>
                  <li>Для захисту від шахрайства й ведення журналів подій.</li>
                  <li>Для маркетингових повідомлень — лише за окремою добровільною згодою.</li>
                </ul>
              </PolicySection>
              <PolicySection number="04" title="Кому можуть передаватися дані">
                <p>Новій пошті, банку або платіжному провайдеру, а також хостинговим та IT-постачальникам, зокрема Supabase і Render, лише в обсязі, необхідному для роботи відповідної послуги.</p>
              </PolicySection>
              <PolicySection number="05" title="Строк зберігання">
                <p>Дані замовлень зберігаються не менше строків, передбачених для бухгалтерського обліку. Технічні журнали — до 12 місяців або доки вони потрібні для визначеної мети обробки.</p>
              </PolicySection>
              <PolicySection number="06" title="Права користувача">
                <p>Ви маєте право запросити доступ, виправлення, видалення чи обмеження обробки даних, а також подати заперечення або звернутися до Уповноваженого Верховної Ради України з прав людини.</p>
              </PolicySection>
              <PolicySection number="07" title="Cookies та аналітика">
                <p>Сайт використовує необхідні cookies і базову аналітику. Обмежити їх можна у налаштуваннях браузера, але це може вплинути на роботу окремих функцій.</p>
              </PolicySection>
            </div>
          </div>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
