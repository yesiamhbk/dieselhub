// src/PartnersSTO.jsx
import React from "react";

export default function PartnersSTO() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-6 flex items-center justify-between">
          <a href="#/" className="font-extrabold text-lg hover:text-yellow-400">Diesel Hub</a>
          <nav className="flex items-center gap-3">
            <a href="#/" className="rounded-xl border border-neutral-800 px-3 py-1.5 hover:border-yellow-400">Каталог</a>
            <a href="#/trade-in" className="rounded-xl border border-neutral-800 px-3 py-1.5 hover:border-yellow-400">Trade‑In</a>
            <a href="#/warranty" className="rounded-xl border border-neutral-800 px-3 py-1.5 hover:border-yellow-400">Гарантія</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10">
        <section className="grid md:grid-cols-2 gap-8 items-start">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight text-white">
              Партнерство для СТО
            </h1>
            <p className="mt-3 text-neutral-300">
              Ми співпрацюємо з сервісними станціями технічного обслуговування (СТО) і надаємо
              партнерські <span className="text-yellow-400 font-semibold">знижки</span> на
              <span className="font-semibold"> ремонт та відновлення</span> компонентів дизельних систем.
            </p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="text-neutral-400 text-xs uppercase tracking-wide">Принцип</div>
                <div className="mt-1 text-sm text-neutral-200">
                  Розмір знижки залежить від типу робіт і конкретного кейсу. Точний відсоток погоджується
                  з менеджером при оформленні замовлення.
                </div>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="text-neutral-400 text-xs uppercase tracking-wide">Що входить</div>
                <ul className="mt-1 text-sm text-neutral-200 list-disc pl-5 space-y-1">
                  <li>Діагностика та перевірка на стенді</li>
                  <li>Відновлення / ремонт форсунок і ТНВД</li>
                  <li>Підбір та консультація по запчастинах</li>
                  <li>Гарантія на виконані роботи</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <a
                href="#/"
                className="rounded-2xl border border-yellow-500/60 bg-yellow-400 text-neutral-950 px-4 py-2 font-semibold hover:brightness-95"
              >
                До каталогу
              </a>
              <a
                href="#/warranty"
                className="rounded-2xl border border-neutral-700 px-4 py-2 font-semibold hover:border-yellow-400"
              >
                Умови гарантії
              </a>
            </div>

            <p className="mt-4 text-xs text-neutral-400">
              Для узгодження знижки зверніться до менеджера перед оформленням робіт.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-4">
            <div className="text-sm text-neutral-300">
              <div className="font-semibold text-neutral-200">Як працюємо з партнерами:</div>
              <ol className="list-decimal pl-5 space-y-1 mt-2">
                <li>Ви залишаєте запит або контактуєте менеджера.</li>
                <li>Уточнюємо тип робіт та погоджуємо розмір знижки.</li>
                <li>Виконуємо діагностику/ремонт та повідомляємо про готовність.</li>
                <li>Надаємо гарантійні умови на виконані роботи.</li>
              </ol>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="rounded-xl border border-neutral-800 p-3">
                <div className="text-neutral-400 text-xs">Для кого</div>
                <div className="text-neutral-200">СТО та майстерні, що працюють із дизельними системами</div>
              </div>
              <div className="rounded-xl border border-neutral-800 p-3">
                <div className="text-neutral-400 text-xs">Оплата</div>
                <div className="text-neutral-200">Безготівково/готівкою. Для Нової пошти — накладений платіж або передплата.</div>
              </div>
              <div className="rounded-xl border border-neutral-800 p-3">
                <div className="text-neutral-400 text-xs">Відправлення</div>
                <div className="text-neutral-200">Нова пошта по Україні, самовивіз у Кропивницькому.</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
