// src/Privacy.jsx
import React from "react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 bg-neutral-950/60 backdrop-blur-md border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/dh-logo.png" alt="Diesel Hub" className="w-7 h-7 object-contain select-none" draggable="false" />
            <div className="font-bold">Політика конфіденційності</div>
          </div>
          <a href="#/" className="text-sm text-neutral-400 hover:text-white">На головну</a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-neutral-400 text-sm">Чинна редакція від {new Date().toLocaleDateString("uk-UA")}.</p>

        <section className="mt-6 space-y-3 text-neutral-200">
          <h2 className="text-xl font-semibold">1. Контролер даних</h2>
          <p>ФОП Волошин Денис Станіславович (РНОКПП 3728401193). Контакти — у футері сайту.</p>

          <h2 className="text-xl font-semibold mt-6">2. Які дані ми обробляємо</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Ідентифікаційні та контактні дані: ПІБ, телефон, e‑mail, адреса доставки.</li>
            <li>Дані замовлення: склад, суми, спосіб оплати/доставки.</li>
            <li>Технічні журнали: IP, час події, версія оферти/згоди, ідентифікатори сесії.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6">3. Цілі та правові підстави</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Виконання договору (обробка замовлень, доставка, гарантія/повернення).</li>
            <li>Згода (маркетингові розсилки — окремо та добровільно).</li>
            <li>Законний інтерес (захист від шахрайства, ведення журналів подій).</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6">4. Передача третім особам</h2>
          <p>«Нова пошта», платіжні провайдери/банк (для передплати), хостингові/IT‑провайдери (Supabase/Render).</p>

          <h2 className="text-xl font-semibold mt-6">5. Строк зберігання</h2>
          <p>Дані замовлень — не менше строків бухобліку; технічні журнали — до 12 міс. або доки потрібні для цілей обробки.</p>

          <h2 className="text-xl font-semibold mt-6">6. Права суб’єктів даних</h2>
          <p>Доступ, виправлення, видалення, обмеження, заперечення; звернення до Уповноваженого ВРУ з прав людини. Звернення — на e‑mail, вказаний у футері.</p>

          <h2 className="text-xl font-semibold mt-6">7. Cookies/аналітика</h2>
          <p>Використовуємо необхідні cookies та базову аналітику. Ви можете обмежити їх у налаштуваннях браузера.</p>
        </section>
      </main>
    </div>
  );
}
