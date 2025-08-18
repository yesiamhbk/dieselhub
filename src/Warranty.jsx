// src/Warranty.jsx
import React from "react";

export default function Warranty() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Шапка */}
      <header className="sticky top-0 z-10 bg-neutral-950/60 backdrop-blur-md border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/dh-logo.png"
              alt="Diesel Hub"
              className="w-7 h-7 object-contain select-none"
              draggable="false"
            />
            <div className="font-semibold">Diesel Hub</div>
          </div>
          <a
            href="/#/"
            className="text-sm rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-yellow-400"
          >
            ← до магазину
          </a>
        </div>
      </header>

      {/* Контент */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">
          Гарантія Diesel Hub
        </h1>
        <p className="text-neutral-300 mb-6">
          Строк гарантії: <b>6 місяців</b>. Поширюється на: нові, відновлені та
          вживані форсунки Common Rail, паливні насоси високого тиску (ПНВТ/ТНВД) та
          керувальні клапани.
        </p>

        <section className="space-y-6 text-neutral-200 leading-relaxed">
          <div className="rounded-2xl border border-neutral-800 p-5">
            <h2 className="text-xl font-bold mb-3">1. Загальні положення</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Diesel Hub надає гарантію на всі товари строком 6 місяців з моменту
                відвантаження/передачі.
              </li>
              <li>
                Гарантія підтверджує відповідність товару заявленим характеристикам та
                відсутність прихованих дефектів.
              </li>
              <li>
                Початок гарантійного строку: з дати відправлення перевізником (за
                даними ТТН) або з дати видачі зі складу (за накладною/рахунком).
              </li>
              <li>Усі запчастини проходять перевірку перед відправленням, включно з новими.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-neutral-800 p-5">
            <h2 className="text-xl font-bold mb-3">2. Що покриває гарантія</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Виробничі та/або відновлювальні дефекти деталей, що проявилися під час
                нормальної експлуатації.
              </li>
              <li>
                Невідповідність товару заявленим технічним параметрам за умови належного
                монтажу та експлуатації.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-neutral-800 p-5">
            <h2 className="text-xl font-bold mb-3">3. Випадки, які не є гарантійними</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Забруднення паливної системи (стружка/металеві частки, домішки у паливі
                або магістралях).
              </li>
              <li>
                Знос, кавітація, корозія, потрапляння
                води/домішок у пальне.
              </li>
              <li>
                Неналежний монтаж: відсутність промивання системи, відсутність
                адаптації/кодування форсунок (IMA/ISA/QR), порушення моментів затяжки,
                пошкодження розʼємів/джгутів.
              </li>
              <li>
                Низькоякісне пальне, несумісні присадки, чип-тюнінг/прошивки.
              </li>
              <li>Механічні пошкодження, сліди розбирання, порушення пломб, зміни конструкції.</li>
              <li>Зовнішні причини: ЕБУ, проводка, датчики, низький тиск у баці тощо.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-neutral-800 p-5">
            <h2 className="text-xl font-bold mb-3">
              4. Обов’язкові умови монтажу (для збереження гарантії)
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Промивання бака, магістралей, рампи та зворотної лінії; заміна паливного
                фільтра на новий з належною тонкістю фільтрації.
              </li>
              <li>
                Перевірка ПНВТ/ТНВД на відсутність стружки; перевірка регуляторів/клапанів
                тиску, рамп та датчиків.
              </li>
              <li>За потреби — кодування/адаптація форсунок згідно з вимогами виробника.</li>
              <li>
                Акт/замовлення-наряд СТО рекомендується і може бути запитаний під час
                розгляду звернення.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-neutral-800 p-5">
            <h2 className="text-xl font-bold mb-3">5. Порядок звернення за гарантією</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Повідомте нас (телефон/месенджер/ел. пошта) і надайте номер замовлення/ТТН,
                опис симптомів, фото/відео, за наявності — акт діагностики СТО.
              </li>
              <li>
                Надсилайте товар на діагностику/експертизу у чистому, законсервованому
                стані (заглушені штуцери).
              </li>
              <li>Строк розгляду — до 14 робочих днів (може бути скорочено).</li>
              <li>
                Якщо дефект підтверджено як гарантійний — ремонт/заміна/повернення коштів
                згідно законодавства.
              </li>
              <li>
                Логістика: якщо випадок гарантійний — пересилку компенсує Diesel Hub; в
                іншому разі — за рахунок покупця.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-neutral-800 p-5">
            <h2 className="text-xl font-bold mb-3">6. Обмеження відповідальності</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Гарантія не покриває супутні витрати (демонтаж/монтаж, евакуація, простій,
                втрата прибутку тощо).
              </li>
              <li>Діє виключно на сам товар при належній експлуатації за призначенням.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-neutral-800 p-5">
            <h2 className="text-xl font-bold mb-3">7. Заключні положення</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Умови гарантії є частиною публічної інформації продавця і діють для всіх
                поставок Diesel Hub.
              </li>
              <li>
                Гарантія не обмежує інших прав споживача, передбачених законодавством
                України.
              </li>
              <li>Актуальна редакція опублікована на сайті Diesel Hub.</li>
            </ul>
          </div>
        </section>

        <div className="mt-8 text-sm text-neutral-400">
          Питання? Напишіть нам у чат — допоможемо 🙂
        </div>
      </main>
    </div>
  );
}
