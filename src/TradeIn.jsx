// src/TradeIn.jsx
import React, { useEffect, useRef, useState } from "react";

export default function TradeIn() {
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  useEffect(() => {
    const update = () => setHeaderHeight(headerRef.current ? headerRef.current.offsetHeight : 0);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header ref={headerRef} className="fixed top-0 inset-x-0 z-50 bg-neutral-950/60 backdrop-blur-md border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <a href="#/" className="flex items-center gap-2">
            <img src="/dh-logo.png" alt="Diesel Hub" className="h-8 w-8 object-contain" />
            <div className="font-bold tracking-tight">Diesel Hub</div>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <a href="#/" className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:border-yellow-400">Каталог</a>
          </div>
        </div>
      </header>
      <div aria-hidden className="bg-neutral-950" style={{ height: headerHeight }} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/bg.jpg')] bg-cover bg-center opacity-10" />
        <div className="mx-auto max-w-7xl px-4 pt-10 pb-8 relative">
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
            Обмін (Trade‑in) форсунок і ПНВТ
            <span className="block text-yellow-400">вигідно та з перевіркою на стенді</span>
          </h1>
          <p className="mt-4 text-neutral-300 max-w-3xl">
            Оберіть на сайті нові чи відновлені форсунки/ПНВТ, надішліть нам свої старі — ми протестуємо їх на стенді,
            оцінимо та надамо знижку на покупку в розмірі оцінки. Відправка «Новою поштою», оплата доставки — за Diesel Hub.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="tel:+380995507055" className="rounded-xl border border-yellow-500/60 bg-yellow-400 text-neutral-900 px-4 py-2 font-semibold hover:brightness-95">
              Подзвонити: 099 550 70 55
            </a>
            <a href="#/" className="rounded-xl border border-neutral-700 px-4 py-2 hover:border-yellow-400">
              Підібрати форсунки
            </a>
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-10 space-y-10">
        {/* Steps */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-neutral-800 p-6 bg-neutral-900/40">
            <h2 className="text-xl font-bold mb-4">Як це працює</h2>
            <ol className="space-y-3 text-neutral-300">
              <li><span className="text-neutral-100">1.</span> Обираєте деталь у каталозі або залишаєте заявку телефоном.</li>
              <li><span className="text-neutral-100">2.</span> Надсилаєте нам свої форсунки/ПНВТ «Новою поштою».</li>
              <li><span className="text-neutral-100">3.</span> Ми проводимо стендові тести та діагностику.</li>
              <li><span className="text-neutral-100">4.</span> Повідомляємо чесну оцінку (сума знижки на покупку).</li>
              <li><span className="text-neutral-100">5.</span> Оформлюємо покупку з урахуванням знижки та відправляємо замовлення.</li>
            </ol>
          </div>
          <div className="rounded-2xl border border-neutral-800 p-6 bg-neutral-900/40">
            <h2 className="text-xl font-bold mb-4">Умови</h2>
            <ul className="space-y-3 text-neutral-300 list-disc pl-5">
              <li>Оцінка залежить від стану та результатів стендових тестів.</li>
              <li>Знижка дорівнює сумі оцінки ваших форсунок/ПНВТ.</li>
              <li>Доставка до нас «Новою поштою» — <span className="text-neutral-100">за Diesel Hub</span>.</li>
              <li>Непридатні або неремонтопридатні деталі оцінюються індивідуально.</li>
            </ul>
          </div>
        </section>

        {/* Accept */}
        <section className="rounded-2xl border border-neutral-800 p-6 bg-neutral-900/40">
          <h2 className="text-xl font-bold mb-4">Що ми приймаємо</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-neutral-300">
            <div className="rounded-xl border border-neutral-800 p-4">Common‑Rail форсунки (Bosch, Delphi, Denso, Siemens/VDO)</div>
            <div className="rounded-xl border border-neutral-800 p-4">ПНВТ високого тиску</div>
            <div className="rounded-xl border border-neutral-800 p-4">Форсунки в різному стані: після зняття, з пробігом, після ремонту</div>
          </div>
        </section>

        {/* Contacts */}
        <section className="rounded-2xl border border-neutral-800 p-6 bg-neutral-900/40">
          <h2 className="text-xl font-bold mb-2">Контакти</h2>
          <p className="text-neutral-300">Телефон: <a className="text-yellow-400 hover:underline" href="tel:+380995507055">099 550 70 55</a></p>
          <p className="text-neutral-400 text-sm mt-2">Графік: ПН–ПТ 9:00–17:00</p>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-400 flex items-center justify-between">
          <div>© {new Date().getFullYear()} Diesel Hub</div>
          <div>Ремонт і продаж дизельних форсунок і ПНВТ</div>
        </div>
      </footer>
    </div>
  );
}