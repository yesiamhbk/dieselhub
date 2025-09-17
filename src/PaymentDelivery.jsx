// src/PaymentDelivery.jsx
import React from "react";

export default function PaymentDelivery() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 bg-neutral-950/60 backdrop-blur-md border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/dh-logo.png" alt="Diesel Hub" className="w-7 h-7 object-contain select-none" draggable="false" />
            <div className="font-bold">Оплата і доставка</div>
          </div>
          <a href="#/" className="text-sm text-neutral-400 hover:text-white">На головну</a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="space-y-4 text-neutral-200">
          <h2 className="text-xl font-semibold">Варіанти оплати</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><b>Накладений платіж (Нова пошта):</b> доставку і комісію перевізника сплачує Покупець згідно тарифів НП.</li>
            <li><b>Передплата за реквізитами:</b> доставку оплачує Продавець. Реквізити надає менеджер після підтвердження замовлення.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6">Доставка</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Перевізник: «Нова пошта» (відділення/поштомат/адресна).</li>
            <li>Термін відправки: як правило, у день підтвердження/оплати (робочі дні).</li>
            <li>Вартість і строки — за тарифами перевізника.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6">Повернення/обмін</h2>
          <p>Повернення протягом 14 днів згідно <a className="text-yellow-400 hover:text-yellow-300" href="#/warranty">Політики повернення та гарантії</a>. Повернення оформлюється через «Нову пошту» після погодження з менеджером.</p>
        </section>
      </main>
    </div>
  );
}
