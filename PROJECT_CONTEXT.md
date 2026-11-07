## 2026-11-07 — World status UI

- Added a dedicated Мир и фракции tab to the dashboard.
- Shows all four faction reputation values, rank labels and progress bars.
- Lists active regional events with acceptance state, objective progress, remaining time and rewards.
- Separates completed events with unclaimed rewards from the recent event history.
- Shows exploration progress, current region, unlocked routes, world clock and recent reputation changes.
- Dynamic save data is HTML-escaped before rendering.
- Verification: world status UI unit test, browser smoke on desktop/mobile/small-mobile and visual regression passed locally.

## 2026-11-07 — Open-world foundation v18

- Added a persisted world state with a per-save seed, generator version, world clock, region visit counters, discovered regions and unlocked routes.
- New characters begin in Aurora with only the village discovered. The first connected routes lead to Forest, Briar Hollow and the Ruins.
- Region travel now follows the world graph. Entering a new region reveals its outgoing routes; returning is allowed along routes already opened.
- Story level is now a recommendation for exploration, not a hard lock on entering a connected region. Dragon and endgame progression checks remain separate.
- Map terrain, enemy, chest, NPC and ambient-event placement receive a deterministic per-save region random source. Legacy saves receive a stable per-save generator seed and retain unrestricted legacy fast travel.
- Added persistent regional events: timed appearance, map markers, explicit acceptance, combat objectives, faction reputation outcomes and transactional reward claims.
- Added faction state and independent campaign-branch state to the save schema. NG+ resets regional discoveries and faction standing while preserving the world seed.
- Save schema is now v18. All supported saves v1–v17 migrate to v18; legacy saves retain unrestricted fast travel for compatibility. New characters are created directly as v18 and do not receive legacy fast travel.
- Verification: save migration regression (v1–v17), world foundation, world-map navigation, event runtime wiring, static CI checks, browser smoke (1440×900, 390×844, 320×740) and browser visual regression passed locally.

Next implementation slice: expose faction standing and event history in the UI, then wire independent campaign branches and the six side-story chains into the current quest screens.

Карта проекта для последующих задач. Снимок ветки GitHub `main` повторно сверён 05.11.2026: Git tree содержит 202 файла (71 `.js`, 76 `.mjs`, 70 проверок `scripts/check-*.mjs`, 6 `.css`, 30 `.png`, 4 `.mp3` и прочие ресурсы). Последний проверенный функциональный SHA: `67446057282c0e6c91462078dc364bf9cc28c65d`. GitHub Actions CI [41932133797](https://github.com/igor74r/magic-rpg/actions/runs/41932133797) завершился `completed / success` (82/82 шагов, включая desktop/mobile browser smoke и gameplay visual regression); GitHub Pages deployment [41932133939](https://github.com/igor74r/magic-rpg/actions/runs/41932133939) завершился `completed / success` на том же SHA. Все 70 файлов `scripts/check-*.mjs` подключены к CI. Последние исправления: строгая проверка и транзакционная нормализация ежедневных заданий, защита прогресса кампании, достижений и боевых счётчиков, корректная обработка осколков и Разлома, а также начальная ARIA-навигация. Это не заменяет построчный ручной аудит: он продолжается. Художественная переработка всех игровых областей также ещё не завершена.

Карта проекта для последующих задач. Снимок ветки GitHub `main` повторно сверён 05.11.2026: Git tree содержит 202 файла (71 `.js`, 76 `.mjs`, 70 проверок `scripts/check-*.mjs`, 6 `.css`, 30 `.png`, 4 `.mp3` и прочие ресурсы). Текущий HEAD: `c72a22ef0b0e2f75c277ed06ba76c3fea8a98250`. GitHub Actions CI [41911693603](https://github.com/igor74r/magic-rpg/actions/runs/41911693603) завершился `success` (82/82), GitHub Pages deployment [41911693597](https://github.com/igor74r/magic-rpg/actions/runs/41911693597) также завершился `success` на том же SHA. Все 70 файлов `scripts/check-*.mjs` подключены к CI. В последнем цикле исправлены прогрессия legacy-класса Жрец, безопасная выдача ежедневных заданий при повреждённом списке и валидация рекорда Разлома. Это не заменяет построчный ручной аудит: он продолжается. Художественная переработка всех игровых областей также ещё не завершена.

> **Текущая база:** автономная браузерная 2D-RPG в жанре тёмного фэнтези, без backend и сетевых игровых функций. Игровые классы: Воин, Маг, Лучник. Главная кампания строго состоит из 5 актов × 5 миссий = 25 миссий. В сюжете ровно три дракона: Пепельный Вестник (акт III), Ледяная Хватка (акт IV), Кровавая Корона (акт V); каждый гарантированно выдаёт свой единственный сюжетный осколок. Разлом открывается только после гибели Кровавой Короны. Эндгейм: 30 областей Разлома (10 требуют уровень 50), Башня на 40 этажей, максимальный уровень 100, два варианта финала и NG+.

> **Системы и данные:** 12 слотов экипировки (оружие, голова, плечи, грудь, перчатки/наручи, поножи, сапоги, щит, два кольца, амулет, плащ); сумка — 30 ячеек (6×5), отдельные вкладки экипировки/материалов/квестов/осколков; грузоподъёмность = Сила ×5. Лут T1–T6 с базовыми весами 60 / 25 / 10 / 4 / 0.9 / 0.1, диапазонами базовых характеристик 1–5 / 6–15 / 16–30 / 31–55 / 56–90 / 91–150 и 0–5 аффиксами. T6 — только боссовый, не создаётся и не продаётся обычному торговцу. Удача растёт с 5 на 0.5 за уровень (предел 100); шанс добычи учитывает Luck и подключаемый модификатор репутации; в Разломе вес T4+ повышается до +30% за очищенные области.

> **Ремесло и торговля:** крафт в городе мгновенный, в лагере — заказ на 1–3 часа; не более одного созданного T4+ за акт; три рецепта T5 доступны только в кузнице пятого акта. Улучшение экипировки даёт +5% характеристик за уровень; перековка тратит материалы/эссенции. Магазин имеет пять пресетов, продажа требует повторного подтверждения для T4+ или сумм свыше 500 золота; обратный выкуп доступен в тот же календарный день с наценкой 20%.

> **Сохранения и проверки:** текущая схема сохранений — v17; старый квестовый предмет «Осколок маны» переименован в «Печать старого архива», в активном каноне осталось ровно три осколка Разлома. Последний прогон локально: синтаксис PASS (87 JS/MJS-файлов); 17 `check-*.mjs` PASS; `check-campaign-playthrough` PASS (138/138); `smoke-load` PASS; `smoke-boot` PASS (40 проверок); `browser-smoke-cdp` PASS (Chrome: 1440×900 / 390×844 / 320×740); `check-imports` PASS (64 файла); `check-gameapi` PASS (101 метод / 147 вызовов); миграции сохранений v1–v16 PASS. Chrome-визуальный проход завершён: пролог, выбор класса, инвентарь, дерево талантов, Башня, Разлом, карта мира и реальные сцены пяти биомов проверены скриншотами. Автоматическая симуляция кампании 25/25 и интеграционный сценарий 138/138 пройдены. Ручной playthrough с человеком и проверка реальных пользовательских localStorage-сохранений на отдельных копиях остаются отдельными проверками; реальные сохранения не изменялись. Пролог переписан под новый канон; озвучка использует русскую системную TTS браузера/ОС, профессиональная запись не создавалась.

> **Последняя проверенная функциональная версия (05.11.2026):** SHA `67446057282c0e6c91462078dc364bf9cc28c65d`. CI [41932133797](https://github.com/igor74r/magic-rpg/actions/runs/41932133797) завершился `success` (82/82), GitHub Pages deployment [41932133939](https://github.com/igor74r/magic-rpg/actions/runs/41932133939) также завершился `success` на том же SHA. В CI подключены все 70 проверок `scripts/check-*.mjs`, синтаксис JS/MJS, импорты, smoke-тесты, Playwright desktop/mobile и gameplay visual regression. Ежедневные задания теперь отвергают строковые/дробные/отрицательные счётчики и не позволяют использовать detached fallback для изменения прогресса или получения награды, если нормализация не сохранилась. Кампания, достижения, HUD, статистика, бой, сюжетные осколки и Разлом используют безопасные счётчики и строгие флаги. Ручной аудит всех 202 файлов и полная художественная переработка игры не завершены. CSS-аудит выявил около 232 gradient-деклараций, 11 blur-функций, 8 backdrop-filter и 40 filter-деклараций в общих UI-слоях; это остаётся отдельной визуальной задачей, массовая замена без визуальной регрессии не выполнялась.

## 1. Назначение

Текущая игра «Осколки Разлома / Shards of the Rift» — браузерная top-down 2D-RPG в тёмном фэнтези. Игрок проходит пять актов и 25 миссий, побеждает ровно трёх драконов-хранителей и получает от каждого один гарантированный осколок. После гибели Кровавой Короны открывается Разлом с 30 эндгейм-областями; дополнительно доступны Башня на 40 этажей, два варианта финала и NG+.

Продукт — самостоятельная статическая веб-страница без сервера и сборки. Сетевых игровых функций нет. Поддерживаются desktop и мобильный браузер (D-Pad, адаптивные media queries).

## 2. Стек

| Слой | Технология |
|---|---|
| Язык | JavaScript (ES2022+, ES-модули), HTML5, CSS3 |
| Фреймворки | **нет** (vanilla JS, без React/Vue и без зависимостей) |
| Рендер | HTML + CSS; игровая карта — `<canvas>` 800×500 (Canvas 2D API) |
| Звук | Web Audio API + локальные MP3 (`audio/`) |
| Озвучка пролога | Web Speech API (русская системная TTS браузера/ОС) |
| Хранение | `localStorage` (сейвы v17, настройки, флаг пролога) |
| Сборка | **нет**: ни bundler, ни transpiler, ни `package.json` |
| Пакетный менеджер | **нет** (npm/pnpm не используются; Node нужен только для скриптов проверки) |
| CI | GitHub Actions, Node 24: синтаксис, импорты/экспорты, контракт GameAPI, 2 smoke-прогона; локально дополнительно проверяется Chrome CDP на трёх размерах экрана |
| Тесты / lint / types | smoke-скрипты (`check-imports`, `check-gameapi`, `smoke-load`, `smoke-boot`); unit-тестов, линтера и типов нет |

Доступное окружение (проверено): Node.js v24.22.1, Python 3.15.0, git CLI отсутствует в `PATH`, но найдена встроенная версия из GitHub Desktop: `%LOCALAPPDATA%\GitHubDesktop\app-3.6.10\resources\app\git\cmd\git.exe`.

## 3. Структура

```
magic-rpg/
├── index.html                 # все экраны (11), inline onclick → window.GameAPI
├── main.js                    # entrypoint: wiring, boot, GameAPI, глобальные ошибки, пролог
├── css/style.css              # каркас UI (~526 строк, 3 media query, 7 keyframes)
├── css/theme.css              # слой «Витраж»: палитра, форма, типографика (перекрывает style.css)
├── audio/                     # village / explore / combat / prologue .mp3 (~14.7 МБ)
├── data/                      # статические данные (10 модулей, без логики)
│   ├── classes.js             # 3 класса, стартовые статы/заклинания/предметы, способности
│   ├── items.js               # 25 предметов + редкости, цены, бонусы
│   ├── spells.js              # 8 заклинаний
│   ├── enemies.js             # 25 врагов (включая боссов)
│   ├── locations.js           # 11 локаций: тема, враги, размеры карты, safe-флаг
│   ├── npcs.js                # 12 NPC + FORGE_BONUS
│   ├── shop.js                # 13 позиций ассортимента
│   ├── achievements.js        # 19 достижений
│   ├── talents.js             # деревья талантов по классам (тиры 5/10/15/20)
│   └── story.js               # тексты/пролог
├── systems/                   # игровая логика (18 модулей)
│   ├── state.js               # единственный синглтон состояния
│   ├── events.js              # event bus: on / off / emit
│   ├── save.js                # localStorage, миграции сейвов v1→v9, настройки v3
│   ├── inventory.js, shop.js, crafting.js, character.js
│   ├── progression.js, stats.js, status.js, talents.js, achievements.js
│   ├── dailyQuests.js, ngplus.js, rift.js, audio.js, voice.js
│   ├── overworld.js           # фасад: enterOverworld/exitOverworld + реэкспорты
│   └── overworld/
│       ├── map.js             # генерация карт, TILE=48, seededRandom
│       ├── ai.js              # камера, движение, updateOverworld(dt)
│       ├── combat.js          # пошаговый бой, дроп, награды (крупнейший модуль, ~609 строк)
│       ├── spawn.js           # враги/сундуки/NPC/статика/события, элитники, модификаторы
│       ├── particles.js, log.js
├── ui/                        # DOM/Canvas-слой (13 модулей)
│   ├── game.js                # ФАСАД: re-export доменных UI-модулей (7 строк)
│   ├── header.js, locations.js, inventory.js, spells.js, quests.js, npcs.js, shop.js
│   ├── menu.js, screens.js, character.js, village.js
│   ├── overworld.js           # оркестратор overworld: ввод, секреты, NPC-панель, pause
│   └── overworld/
│       ├── models.js          # фасад отрисовки + EFFECTS_DATA/MODIFIERS_LABEL
│       ├── sprites.js         # пиксельные спрайты: маски, палитры, кэш, герои/враги/NPC/объекты
│       ├── combat-panel.js     # под-панели боя (заклинания/предметы/способности)
│       ├── effects.js         # темы, погода, туман, молнии, частицы
│       └── render.js          # canvas-цикл, рендер, HUD, миникарта, pause, автосейв, тултипы
├── scripts/                   # node-проверки для CI
│   ├── check-imports.mjs      # резолвинг модулей + именованные экспорты
│   ├── check-gameapi.mjs      # контракт GameAPI между разметкой и фасадом
│   ├── smoke-load.mjs         # 12 проверок данных и чистой логики
│   └── smoke-boot.mjs         # boot main.js, overworld и бой в Node
├── .github/workflows/ci.yml   # CI: 5 шагов проверки
├── .nojekyll                  # для GitHub Pages
├── .gitignore
├── README.md                  # запуск, проверки, структура, ссылки на CI/Pages
├── CHANGELOG.md               # v0.1 … v0.12
└── PROJECT_CONTEXT.md         # этот файл
```

Объём: 52 JS-модуля, ≈5.7 тыс. строк JS; `index.html` ~214 строк; `css/style.css` ~526 строк. Самые крупные модули: `systems/overworld/combat.js`, `ui/overworld/render.js`, `ui/overworld/models.js`, `ui/inventory.js`, `ui/menu.js`.

## 4. Ключевые entrypoints

- `index.html` → `<script type="module" src="main.js">` — единственная точка входа. Все кнопки в разметке вызывают `window.GameAPI.*`.
- `main.js`:
  - подписка на события (`toast`, `log`, `game:started`, `overworld:*`, `combat:*`, `victory`);
  - `window.GameAPI` — фасад на ~47 методов для inline-обработчиков (единый «контракт» между HTML и модулями);
  - boot-решение о прологе (`ALWAYS_SHOW_PROLOGUE`, `magic-rpg-prologue-seen`, наличие сейвов);
  - глобальные `error` / `unhandledrejection` → toast;
  - `beforeunload` → `saveGame()`.
- `systems/state.js` — `state = { game, settings, selectedClass, currentTab, overworld }` (мутабельный синглтон, импортируется всеми слоями).
- `systems/events.js` — единственная шина: `on`, `off`, `emit`; ошибки listener'ов ловятся и логируются.
- `ui/game.js` — тонкий фасад над `header/locations/inventory/spells/quests/npcs/shop` (сохранён, чтобы не менять импорты в `main.js`).

## 5. Архитектура и потоки данных

Слои и направление зависимостей:

```
data/*  ←  systems/*  ←  ui/*  ←  main.js
(данные)   (логика)      (DOM/Canvas)   (wiring)
```

`systems/*` не должен трогать DOM (на практике есть исключения: `confirm` в `systems/overworld.js`, `Audio`/`localStorage`); `ui/*` читает `state` и вызывает системы; связь между слоями — через `state` и event bus.

Основные потоки:

1. **Boot:** `main.js` → `migrateLegacySave()` / `loadSettings()` → пролог или главное меню (`showScreen`, `updateMainMenu`).
2. **Новая игра:** выбор класса (`ui/character.js`) → `createCharacter` (`systems/character.js`) → `state.game` → `saveGame()` в слот.
3. **Вход в локацию:** `enterOverworldFromUI` → `enterOverworld(locId, opts)` (`systems/overworld.js`) → генерация карты/спавн → `emit('overworld:start')` → `initOverworld()` → `start()` (rAF).
4. **Игровой цикл:** `requestAnimationFrame` → `updateOverworld(dt)` (`systems/overworld/ai.js`) → движение/ИИ/эффекты → `tick`/`render` (`ui/overworld/render.js`) → canvas.
5. **Бой:** столкновение с врагом → `enterCombat` → пошаговые действия (`combatAttack`, `combatCastSpell`, `combatUseAbility`, `combatUseItem`, `combatBlock`, `combatFlee`) → события `combat:start/end`, `victory`, `rift:*`.
6. **Смерть/победа:** `overworld:defeat` → экран смерти; `victory` → сохранение флага → экран победы → NG+ (`systems/ngplus.js`) или Разлом (`systems/rift.js`).
7. **Сохранение:** `saveGame()` при переходах/выходе и в `beforeunload`; сейв — JSON целиком в `localStorage`, текущая версия схемы v16. Новые поля должны получать миграцию в `systems/save.js`.

Модель данных сейва (схема v16): верхний уровень содержит `version`, `location`, `storyDragons`, `storyShards`, `riftEnding` и `quests`; `player` содержит характеристики, `luck`, `inventory[]`, 12 слотов `equipped`, `campaignClaimed`, прогресс Разлома/Башни, `craftingJobs`, `craftedHighTierByAct`, `buyback`, `stats`, таланты, эффекты и NG+. Ключи сохранений и настроек остаются в `localStorage`; при добавлении полей требуется миграция в `systems/save.js`.

## 6. Внешние зависимости

- БД, backend, API, очереди, внешние сервисы — **нет**. Сетевых вызовов (`fetch`, XHR, WebSocket, EventSource) в коде **нет** — проверено поиском.
- Сторонние CDN, шрифты, аналитика — **нет**.
- Нативные браузерные API: Canvas 2D, Web Audio API, Web Speech API (`speechSynthesis`), `localStorage`, `requestAnimationFrame`, `matchMedia`.
- Ассеты: 4 MP3 в `audio/` (~14.7 МБ суммарно) — основной вес проекта.
- Переменные окружения и секреты не используются; `.env`-файлов в репозитории нет.

## 7. Команды

Запуск (единственный поддерживаемый способ — статическая раздача, файл `file://` не подойдёт из-за ES-модулей и CORS):

```bash
python -m http.server 8000     # из корня репозитория
# открыть http://localhost:8000
```

Проверки (то же, что делает CI):

```bash
node --check <file.js>              # синтаксис; CI прогоняет по всем *.js
node scripts/check-imports.mjs      # резолвинг модулей + именованные экспорты
node scripts/check-gameapi.mjs      # все GameAPI.* из разметки есть в фасаде
node scripts/smoke-load.mjs         # 12 проверок данных и чистой логики
node scripts/smoke-boot.mjs         # boot main.js, overworld, бой (12 проверок)
```

Чего нет: `install`, `build`, `dev`-скриптов, `test`, `lint`, `typecheck`, `format`. Нет `package.json` и lock-файлов, поэтому `npm install` неприменим.

CI (`.github/workflows/ci.yml`, job `verify`, ubuntu-latest + Node 24): `find … node --check`, затем `check-imports`, `check-gameapi`, `smoke-load`, `smoke-boot`. Workflow в `main`; прогон #1 (`d3f1ba1`) — success.

Ручная проверка: `python -m http.server 8000` → создать героя → войти в локацию → бой. Автоматического браузерного прогона нет: `smoke-boot` эмулирует DOM/Canvas в Node, реальный рендер проверяется вручную.

## 8. Тесты и покрытие

- Unit-тестов игры нет: ни `tests/`, ни `*.test.js`, ни test-runner'а.
- `scripts/smoke-load.mjs` — 12 проверок: загрузка 10 модулей данных + `state/events/progression/status/stats`, `addExp`, `getEffStats`, `applyEffect`. Покрытие — «модули импортируются, данные непустые».
- `scripts/smoke-boot.mjs` — 12 проверок: boot `main.js` в Node с заглушками DOM/Canvas/Audio, создание героя, вход в деревню, WASD, все вкладки, `invSlotClick`, NPC-диалоги, бой в лесу до победы, сохранение в слот. Ловит `ReferenceError` и потерю контрактов, которые не видит `node --check`.
- `scripts/check-imports.mjs` проверяет резолвинг модулей и именованные экспорты (ловит разрывы вида «импортируется несуществующий `startAutosave`»).
- `scripts/check-gameapi.mjs` сверяет все `GameAPI.*` из `index.html` и генерируемого HTML с фасадом `main.js` (80 методов, 109 вызовов).
- Не покрыто: ИИ, генерация карт, сейвы/миграции, экономика, прогрессия, canvas-рендер. Качественно проверены загрузка и основные сценарии, а не баланс/расчёты; unit-тестов нет.
- Аудит данных (разово) нарушений не нашёл: `startingSpells/startingItems`, `locations.enemies`, `shop`, ссылки предметов на заклинания валидны, дублей id нет.

## 9. Соглашения

- **Модули:** ES-модули, только именованные экспорты (`export function`, `export const`), default-экспортов нет. Относительные пути с явным `.js`.
- **Стиль:** 2 пробела, одинарные кавычки, точки с запятой, `const`/`let`, ранние `return`, короткие функции. Строгого линтера нет, стиль поддерживается вручную.
- **Нейминг:** функции/переменные — `camelCase`; константы и объекты данных — `UPPER_SNAKE` (`CLASSES`, `ITEMS`, `TILE`); id в данных — `kebab-case` (`health-potion`, `ice-bolt`); DOM-id — `kebab-case` (`screen-game`, `combat-panel`); UI-действия overworld — префикс `ow` (`owAttack`, `owCast`).
- **Структура:** `data/` — только данные; `systems/` — логика; `ui/` — рендер и DOM; `main.js` — склейка. Новые экраны/вкладки принято выносить в отдельный `ui/*.js` и реэкспортировать через фасад `ui/game.js`.
- **Связь с HTML:** только через `window.GameAPI.<method>`; обработчики в разметке — inline `onclick`.
- **Ошибки:** глобальные `window.onerror`/`unhandledrejection` в `main.js` → красный toast; `emit` изолирует падения listener'ов; деструктивные действия подтверждаются `confirm()`.
- **Логирование:** `console.log/warn/error` с тегом в квадратных скобках (`[boot]`, `[events]`, `[prologue]`, `[global error]`, `[secrets]`); игровые сообщения — через `emit('log', { channel, msg, cls })` и `emit('toast', msg)`, а не напрямую в DOM.
- **Сохранения:** обратная совместимость через `migrateGame` (version 1→9) и `migrateSettings` (version 3); при добавлении полей в сейв — новая ветка миграции и инкремент `SAVE_VERSION`.
- **CSS:** два слоя: `style.css` — каркас и layout, `theme.css` — палитра, форма и типографика (подключается после и перекрывает); плоские семантические классы (`.dashboard-*`, `.mm-btn`, `.settings-*`), без CSS-модулей и препроцессоров; палитра «витраж» — индиго/циан, золото только для лута и акцентов.
- **Язык:** интерфейс, комментарии, логи и коммиты — русские.

## 10. Состояние репозитория (git)

- Ветка `main`, remote `origin` = `https://github.com/igor74r/magic-rpg.git` (публичный).
- Коммиты 30.10.2026: `e74416d` — CI и скрипты, `8bcb534` — рефакторинг UI + починка, `d3f1ba1` — документация, `91f3760` — boot-smoke, `d041e13` — контракт GameAPI, `f51e080` — `.gitignore` и чистка импортов, последний — синхронизация доков.
- Push выполняется через GitHub Desktop: у CLI-git в окружении агента нет credentials (`SEC_E_NO_CREDENTIALS`).
- CI: прогон #1 на `d3f1ba1` — success. GitHub Pages публикуется из `main` (deployment #18 — success): https://igor74r.github.io/magic-rpg/
- Хронология: 13:16 — базовый `60e3ff8` «патч»; 14:26–14:53 — скрипты, CI, распил `ui/overworld.js`; 15:15–15:26 — распил `ui/game.js`; 15:39 — неудачное слияние `effects.js`/`render.js` (проект перестал грузиться); 16:20 — `render.js` восстановлен, импорты и `invSlotClick` починены; далее — CI, smoke-boot, контракт GameAPI, доки.
- `core.autocrlf=true`: git предупреждает, что LF в рабочей копии будет заменён на CRLF при следующем касании.
- `.gitignore` есть: `node_modules/`, `*.log`, `.DS_Store`, `Thumbs.db`, `.vscode/`, `.idea/`, `*.tmp`.
- Stash пуст.

## 11. Известные риски и пробелы

1. **CI запускается только после push:** локальные коммиты до отправки в `origin` не проверяются; workflow триггерится на push/PR в `main`.
2. **Нет unit-тестов и линтера.** `smoke-*` проверяют загрузку и сценарии, но не баланс, формулы урона и миграции; `package.json` нет, версии инструментов не зафиксированы.
3. **Версия не централизована:** `v0.12` живёт строкой в `index.html` и вручную дублируется в CHANGELOG; при релизе нужно править оба места.
4. **Крупные модули и связанность:** `ui/overworld/render.js` (~800 строк), `systems/overworld/combat.js` (~609 строк — расчёты, дроп, награды, достижения, звук), `ui/overworld/models.js` (~515 строк); правки рискованны без unit-тестов.
5. **Остаточный мёртвый код:** `EFFECTS_DATA`/`MODIFIERS_LABEL` из `models.js` нужны только `combat-panel.js`; дублирующих импортов в `menu.js`/`overworld.js` больше нет.
6. **Побочные эффекты в «логике»:** `confirm()` внутри `systems/overworld.js`, обращение к `localStorage`/`Audio` из системных модулей — мешает тестируемости.
7. **XSS/ломающая разметка:** 38 присваиваний `innerHTML` с интерполяцией; имя героя из `<input>` не экранируется (внешнего ввода нет, риск ограничен).
8. **Производительность:** в `render()` каждый кадр создаётся offscreen-canvas для тумана и применяется `ctx.filter: blur(8px)`; `getEffStats()` вызывается каждый кадр.
9. **Звук:** 14.7 МБ MP3 грузятся статически; автовоспроизведение ограничено политикой браузера (разблокировка по первому клику в `main.js`).
10. **Автосейв-интервал не сбрасывается при выходе** из overworld: `setInterval` живёт до перезагрузки (дублей нет из-за гварда `autosaveTimer`), унаследовано из `HEAD`.
11. **Настройка `showFps` мертва:** переключатель есть в настройках, счётчика FPS в коде нет.
12. **Ручная проверка в браузере не выполнена** (браузера в окружении нет): canvas проверен только на отсутствие исключений через DOM-заглушку.

## 12. Что пока неясно

- Кто делает push в `origin/main` и когда (CI проверяет только отправленные коммиты)?
- Целевые браузеры и приоритет мобильной версии (D-Pad и 3 breakpoint'а есть, но тестировались ли на реальных устройствах?).
- Какой инструментарий unit-тестов допустим: встроенный `node:test` без зависимостей или Playwright для DOM/canvas?
- Нужен ли `package.json` (только для `scripts`/devDependencies) или проект должен остаться полностью без npm?
- Нужен ли счётчик FPS (настройка `showFps` уже есть) или удалить её из настроек?
- Правила коммитов: сообщения по-русски («патч», «рефакторинг»), нужен ли более строгий формат?

## 13. Правила безопасной работы с этим репозиторием

- Не делать `git reset --hard`/`git clean -fd` без необходимости: история — единственная копия работы.
- Перед правками в `ui/overworld/*` сверяться с историей: `render.js` восстановлен из `60e3ff8:ui/overworld.js`.
- Минимальные проверки после любой правки: `node --check` по изменённым файлам, `check-imports`, `check-gameapi`, `smoke-load`, `smoke-boot`, затем ручной прогон в браузере через `python -m http.server`.
- Не коммитить `audio/*.mp3` повторно и не добавлять секреты; `.env` в проекте нет и не требуется.

## 14. История изменений (30.10.2026, починка после распила)

Что было сделано:

- `ui/overworld/render.js` восстановлен из `HEAD` (монолитный `ui/overworld.js`) и адаптирован под новый `effects.js`: импортируются `VIEW_W/VIEW_H/getTheme/MOD_LABEL` и погодные функции; `lightning.flash` заменён на `getLightningFlash()`; `updateFireflies(dt, worldTime)` и `drawFireflies(ctx, worldTime)` приведены к сигнатурам `effects.js`; наружу экспортированы `renderNpcPanel`, `onCanvasMouseMove`, `hideMapTooltip`, `openPauseMenu`, `closePauseMenu`, `startAutosave`; в `initWeather` возвращён сброс визуального состояния (следы, кровь, трупы, тайлы).
- `ui/overworld/effects.js`: добавлен `getLightningFlash()`.
- `ui/overworld.js`: импортируется `isPaused` и `onCanvasMouseMove` (были потеряны при распиле), локальный дубль тултипа удалён (переехал в `render.js`), `MOD_LABEL` больше не нужен.
- `main.js`: `GameAPI.invSlotClick` подключён (импорт + фасад) — клики по слотам инвентаря снова работают.
- Временный дамп `HEAD` (`.head-overworld.tmp.js`) использовался только локально и удалён.
- `scripts/check-imports.mjs` дополнен проверкой именованных экспортов (на временном пробном файле проверено, что ловит и `UNRESOLVED MODULE`, и `MISSING EXPORT`).

Дополнительно (30.10.2026):

- `scripts/smoke-boot.mjs` — boot-smoke в Node с заглушками DOM/Canvas/Audio (12 проверок), шаг в CI.
- `scripts/check-gameapi.mjs` — сверка всех `GameAPI.*` из разметки с фасадом (80 методов, 109 вызовов), шаг в CI.
- `README.md` переписан (запуск, проверки, структура, ссылки на CI/Pages), `CHANGELOG.md` получил запись `v0.12`, версии сведены.
- Добавлен `.gitignore`; объединён двойной импорт `systems/save.js` в `ui/menu.js`, убран неиспользуемый `getEffStats` из `ui/overworld.js`.

Зафиксировано коммитами: `e74416d` — CI и скрипты, `8bcb534` — рефакторинг UI и починка, `d3f1ba1` — документация, затем `91f3760` — boot-smoke, `d041e13` — контракт GameAPI, `f51e080` — `.gitignore` и чистка, последний — синхронизация доков. Push — через GitHub Desktop (CLI без credentials).

Проверено: `node --check` — 52/52, `check-imports` — OK, `check-gameapi` — OK, `smoke-load` — 12/12, `smoke-boot` — 12/12; CI прогон #1 (`d3f1ba1`) — success; Pages deployment #18 — success.

Не проверено: реальный браузер и canvas, мобильный D-Pad, звук/озвучка.

## 15. Редизайн «Витраж» (30.10.2026)

- `ui/overworld/sprites.js` — новый пиксельный рендер: маски (герой 12×16, волк 14×10, дракон 16×12 и др.), палитры ролей, кэш offscreen-canvas, аксессуары классов (меч/посох), тени и покачивание.
- `ui/overworld/models.js` — стал фасадом (556 → 43 строки), сохранил `EFFECTS_DATA`/`MODIFIERS_LABEL` для `combat-panel.js`.
- `ui/overworld/effects.js` — все 12 `THEMES` перекрашены в холодный «мана-спектр» (индиго/циан вместо коричнево-золотого).
- `ui/overworld/render.js` — `imageSmoothingEnabled = false`, новый `drawHud` (срезанная панель, пипсы трёх осколков, погодная строка), события карты рисуются спрайтами вместо emoji.
- `css/theme.css` — слой темы: панели, кнопки со срезанными углами, типографика, бой/NPC/тултипы/пауза; подключён после `style.css`.
- `index.html` — версия `v0.13 · Витраж`, подключён `theme.css`.
- Проверки: `node --check` 53/53, `check-imports`, `check-gameapi`, `smoke-load`, `smoke-boot` — зелёные. Визуально в браузере не проверялось (браузера в окружении нет).

## 16. Карта локаций (v0.14)

- `ui/locations.js` переписан: вкладка «Локации» — карта мира с деревней Аврора в центре; 10 локаций по эллиптической орбите, SVG-линии от центра.
- Ходьба: WASD/стрелки (26/20 % карты в секунду), аватар-ромб, подсветка ближайшего узла; `E`/`Enter` — перейти и войти; клик по узлу — выбрать, кнопка в панели — перейти.
- Новые методы фасада: `mapSelect`, `mapTravel`, `mapEnter` (всего 83 метода).
- Панель под картой: описание локации, «Исследовать», магазин, ежедневный сундук, Разлом с рекордом.
- Клавиши карты активны только при `#screen-game.active` и вне overworld; цикл ходьбы останавливается при уходе с вкладки/входе в бой.
- CSS карты — блок «карта локаций» в `css/theme.css`.
- Не проверено в браузере: позиции подписей на узких экранах, реальные клики и ходьба (`smoke-boot` использует заглушку DOM, где `classList.contains` всегда `false`).

## 17. Глобальное обновление: UI, карта, прогрессия и классы (v0.15)

- **UI/Дизайн:** Полностью переписан `style.css` и `theme.css`. Стиль изменен с неонового «Витража» на классическое тёмное фэнтези (дерево, кожа, золото). Убраны срезанные углы (clip-path) в пользу классических рамок и свечений.
- **HUD (Интерфейс в бою):** Перерисован `drawHud` в `ui/overworld/render.js` (фэнтези-панель с двойной золотой рамкой). Исправлен баг с наложением текста (Уровень, Атака, Защита теперь в одну аккуратную строку).
- **Карта мира (Локации):** Переписана `ui/locations.js`. Добавлены RPG-иконки, фоновые текстуры биомов, анимированные торговые пути. Исправлен баг с перекрытием кликов (виньетка блокировала нажатия). Клик по узлу теперь сразу переносит в локацию. Удален дублирующий заголовок над картой.
- **Размер окна:** В `index.html` контейнер `screen-overworld` расширен до 1000px (без появления скроллов) для более комфортной игры.
- **Диалоги NPC:** В `index.html` добавлено модальное окно `#npc-dialog-modal`. Логика в `ui/npcs.js` и `ui/quests.js` переписана так, чтобы диалоги (кузнец, торговец, доска объявлений и т.д.) открывались прямо поверх карты, не уводя игрока в главное меню дашборда.
- **Классы:** Полностью переделаны в `data/classes.js`. Теперь доступны: Воин (Ярость/Ближний бой), Маг (Мана/Заклинания) и Лучник (Яд/Криты). Обновлен баланс стартовых статов и способностей.
- **Прогрессия:** `systems/progression.js` переписан под максимальный 100-й уровень. Введена формула кривой опыта `100 * level^1.6`. За каждый уровень дается 1 очко характеристик и 1 очко пассивных навыков.
- **Древо талантов (PoE-style):** Добавлен `data/passives.js` и `ui/passives.js`. Древо с перекрестками и иконками (Ветки Силы, Интеллекта и Телосложения). Подключено к вкладке «Таланты».
- **Баланс:** В `systems/stats.js` убран двойной штраф физического урона у магов, скорректированы формулы урона и защиты.
- **Фиксы:** Устранены синтаксические ошибки импорта `spendStat` в `main.js` и дублирование функции `drawHud` в `render.js`.

## 18. Локальное обновление v0.16 (31.10.2026)

- Рабочая папка: `[локальный путь скрыт]`. Перед восстановлением создана полная резервная копия: `[локальный путь скрыт]`.
- Локальные изменения остаются незакоммиченными; `HEAD` совпадает с `origin/main` на `00ecdd3`. Ничего не отправлялось в GitHub.
- В `data/passives.js` завершён оборванный генератор дерева и экспортирован `getPassiveTree(classId)`. Для Warrior/Mage/Archer строятся по 21 узлу: стартовый узел плюс 5 веток × 4 узла; есть требования уровня и перекрёстные соединения.
- Сюжетная кампания `data/story.js`: 5 актов, 25 миссий. Все mission.enemyId существуют в `data/enemies.js`; все act.locationId существуют в `data/locations.js`.
- В `css/rpg-overhaul.css` завершён оборванный CSS-файл; стили подключены в `index.html` с id `rpg-overhaul-css`.
- Добавлена вкладка «Хроники» (`data/chronicles.js`, `ui/chronicles.js`, `ui/header.js`): 4 главы, 3 фракции, 5 побочных сюжетных нитей.
- Добавлены 12 предметов и 5 заклинаний из `magic-rpg-global-overhaul.zip`; scroll-use преобразован из строковых кодов в функции, свитки сделаны складываемыми, все эффекты (`stun`, `bleed`, `defBuff`) поддержаны существующей системой. В `SHOP_ITEMS` добавлены все 12 новых предложений.
- Добавлены локальные SVG-атласы: `assets/tiles/{terrain,dungeons,props}/atlas.svg`, манифест и README. `ui/overworld/tile-atlas.js` подключён к `ui/overworld/render.js`: terrain atlas рисует поверхности, props atlas — сундуки, при ошибках действует процедурный fallback. Atlas подземелий подготовлен для будущих интерьерных карт.
- `systems/overworld/hazards.js` изолирует опасности тайлов: lava для `obsidian-fields`, poison для `briar-hollow`, подводные spike traps для `sunken-necropolis`. Тип 3 остаётся препятствием по умолчанию и проходим только при `getTileDanger(tile, locationId)`; типы 2/4 всегда непроходимы. Игрок передаёт ID региона при проверке движения; враги и `findFreeCell` не выбирают hazard-поверхности.
- Все пять новых локаций получили отдельные темы в `ui/overworld/effects.js`: палитры, погодные профили, туман и освещение. Theme lookup использует `ow.theme`; в `briar-hollow` включены дождь и светлячки. Атласные и процедурные опасные тайлы подсвечиваются до получения урона.
- `systems/overworld/spawn.js` получил `createSpawnRoster`: каждый уникальный враг акта и босс появляются прежде, чем начнутся повторения типов в дополнительных слотах.
- Сохранения имеют схему v11: миграция ловкости/пассивок из v9→v10 и отдельный счётчик прогресса кампании из v10→v11. Старые убийства остаются в бестиарии/статистике, но не засчитываются в новой сюжетной кампании; NG+ сбрасывает campaignKills. Задания учитывают убийства только своего типа врага в регионе соответствующего акта.
- Защитные характеристики классов проверены через `getEffStats()`: Воин — блок 16%/сила 66%, Маг — уклонение 10%/блок 3%, Лучник — уклонение 20%/крит 18% (плюс влияние ловкости).
- Проверки 31.10.2026: `node --check` 59/59; `scripts/check-imports.mjs` OK; `scripts/check-gameapi.mjs` OK; `scripts/smoke-load.mjs` OK (30 проверок); `scripts/smoke-boot.mjs` OK (17 проверок). Три SVG-файла успешно разобраны XML-парсером. Баланс и реальный браузерный рендер ещё требуют ручного теста.
- Пролог/его HTML-блок, `audio/`, MP3 и логика озвучки не изменялись. Онлайн/сетевые функции не добавлялись.


## 19. Локальное обновление v0.17 — биомы и гарантированный спавн (31.10.2026)

- Рабочая копия: `[локальный путь скрыт]`; резервная копия из предыдущего обновления сохранена. `HEAD`/`origin/main` остаются `00ecdd3`; commit/push не делались.
- Пять новых регионов используют собственные `THEMES` в `ui/overworld/effects.js`: отдельные палитры, туман и погода. Глухая чаща получила собственную тему, а не общий лесной пресет. Светлячки поддерживают чащу.
- `systems/overworld/hazards.js`: лава для обсидианового региона, яд для Глухой чащи, подводные шипы для некрополя; опасная поверхность типа 3 проходима только там, где определён соответствующий hazard. `isBlocked`/`isWalkable` карты учитывают регион; типы 2 и 4 остаются препятствиями. Игроку и AI передаётся ID региона для проверки перемещения.
- `systems/stats.js` экспортирует `resolveCriticalChance`; `combatAttack` больше не добавляет talent.critChance повторно поверх `getEffStats()`.
- `systems/overworld/spawn.js` содержит `createSpawnRoster`: перемешивает полный список уникальных врагов акта, гарантирует появление каждого и только затем добавляет повторные слоты. Босс не может быть случайно исключён из карты акта.
- Добавлены проверки smoke-load для тем, hazard walkability, лимита крита и полного roster, smoke-boot проверяет появление всех врагов акта включая босса.
- Проверки 31.10.2026: `node --check` 60/60; `scripts/check-imports.mjs` OK; `scripts/check-gameapi.mjs` OK; `scripts/smoke-load.mjs` OK (44 проверки); `scripts/smoke-boot.mjs` OK (18 проверок; дополнительно выполнен 3 раза подряд без сбоев).
- Реальная браузерная проверка Canvas в этой среде недоступна; smoke-boot использует DOM/Canvas-заглушки. Следующий этап — ручной запуск `python -m http.server 8000` и визуальная проверка в браузере. Пролог/его HTML-блок и `audio/` не менялись; онлайн-функции отсутствуют.


## 20. Локальное обновление v0.18 — инвентарь, таланты и пять печатей (31.10.2026)

- Версия в меню: `v0.18 · Глобальное издание`. Изменения находятся локально в `[локальный путь скрыт]`; `HEAD` и `origin/main` не менялись, commit/push не выполнялись.
- `systems/inventory.js`: экипировка поддерживает 8 слотов (weapon, armor, helmet, gloves, boots, amulet, ring1, ring2); оба кольца независимы. Редкость учитывает дробные проценты, предметы экипировки — отдельные экземпляры, расходники/свитки/материалы/руны — стеки.
- `data/items.js`: добавлено 10 предметов экипировки, 5 типов рун, 5 материалов и восстанавливающее зелье. Снаряжение имеет сокеты; руны устанавливаются в свободный сокет и дают боевые бонусы. `systems/stats.js` суммирует бонусы всех слотов и рун.
- `ui/inventory.js`: бумажная кукла, фильтры оружие/броня/аксессуары/расходники/материалы/руны/свитки/квесты, сортировка, сравнение характеристик, снятие вещей, экипировка лучшего доступного, продажа слабых обычных вещей, окно выбора гнезда для руны.
- `data/npcs.js` расширяет торговца новыми вещами. В `data/enemies.js` тематические материалы, руны и новые элементы снаряжения назначены в drop-листы региональных существ и боссов.
- `ui/passives.js`: игровое дерево помещено в `passive-tree-viewport`; Pointer Events позволяют захватить пустое поле и перемещать его мышью или касанием. Кнопки узлов сохраняют самостоятельное нажатие для изучения.
- `data/story.js`: написана сквозная история о пяти печатях, пяти орденах-хранителях и сущности Немого. Сюжет раскрывается за 5 актов × 5 миссий. Индивидуальные `mission.locationId` распределяют задания по всем 15 приключенческим локациям; все ID врагов сверены со списками спавна локаций.
- `systems/campaign.js`: миссию нужно принять у Эдвина; убийства учитываются только для активной миссии, требуемого врага и локации. После достижения цели нужно вернуться и сдать её за золото, EXP и материал; только после сдачи появляется следующее поручение. Состояние кампании сохраняется.
- `ui/npcs.js` показывает у Старейшины Эдвина лор, цель, регион, прогресс и награду. `ui/quests.js` отображает статусы «Выдаёт Эдвин», «Принято», «Вернуться к Эдвину», «Сдано Эдвину».
- Схема сохранений `v12`: добавление шести новых слотов без потери weapon/armor, подготовка rune sockets, миграция уже завершённых/частично начатых миссий. `systems/ngplus.js` сбрасывает campaignKills, campaignClaimed и activeCampaignMission; экипировка остаётся с героем.
- Последняя проверка: все 60 JS-файлов прошли `node --check`; `check-imports` и `check-gameapi` успешны; `smoke-load` успешен (в том числе 15 регионов/25 миссий, принятие и сдача, экипировка и руны); `smoke-boot` успешно (23 проверки).
- Ограничение проверки: браузерная отрисовка/drag-жесты визуально на настоящем браузере отдельно не проверены; smoke-boot использует заглушки DOM/Canvas/Audio. Перед выпуском стоит визуально проверить инвентарь на широком и узком экране и панорамирование дерева.
- Пролог, `audio/`, голосовые файлы и озвучка не изменялись. Онлайн-функциональность не добавлялась.


## 21. Актуальная база v0.19 — состояние проекта на 31.10.2026

- Данные: `data/items.js` — 68 предметов; `data/spells.js` — 14 заклинаний; `data/enemies.js` — 38 врагов; `data/locations.js` — 16 локаций. В `data/story.js` 5 актов и 25 миссий; все миссии ссылаются на существующих врагов, а список миссий использует все 15 приключенческих регионов. Вторая миссия первого блока акта II проходит в `swamp` против `ghost`.
- Классы: `warrior`, `mage`, `archer`. Для каждого пассивное дерево содержит 21 узел: стартовый + пять ветвей по четыре узла.
- Экипировка: 12 слотов — `weapon`, `head`, `shoulders`, `chest`, `back`, `wrists`, `hands`, `legs`, `ring1`, `ring2`, `amulet`, `seal`. Руны хранятся в гнёздах предметов и участвуют в расчёте характеристик. Схема сохранений — v13; миграция переводит старые helmet/armor/gloves/boots в анатомические слоты.
- Тайловые ресурсы: `assets/tiles/terrain/atlas.svg`, `assets/tiles/props/atlas.svg`, `assets/tiles/dungeons/atlas.svg` и `manifest.json`. Поверхности и часть объектов используют атласы; для ошибок загрузки предусмотрен fallback. Атлас подземелий подготовлен для интерьерных карт.
- Система кампании: `systems/campaign.js` требует принять поручение у Эдвина, убивать нужного врага только в указанной локации и затем сдавать миссию. Порядок разблокировки миссий сохраняется; NG+ сбрасывает прогресс кампании, оставляя добычу.
- Инвентарь и экономика: `systems/inventory.js`, `ui/inventory.js`, `data/items.js`, `data/shop.js`. Отображаемые суммы мимика (+12), кристалла (+8) и ежедневного сундука (+8) синхронизированы с начислением золота.
- Автоматические проверки на локальной машине: `node --check` — 60/60; `check-imports` сканирует 60 файлов и проходит; `check-gameapi` проверяет 88 методов / 118 вызовов и проходит; `smoke-load` проходит (54 проверки); `smoke-boot` проходит (23 проверки). Повторный прогон завершён после документальных и игровых правок.
- Сетевые игровые функции отсутствуют: поиск по JS не обнаружил `fetch`, XHR, WebSocket, EventSource или `sendBeacon`. Backend не используется.
- Пролог, блок его HTML, `audio/`, MP3 и логика озвучки не изменялись; `git diff` не показывает изменений в `audio/` и в строках пролога `main.js`.
- Изменения остаются локальными и незакоммиченными. Не делать `git reset --hard` или `git clean -fd`; исходная резервная копия находится в `[локальный путь скрыт]`. Реальный запуск и визуальная проверка браузера остаются следующей ручной задачей.

## 22. Браузерная проверка v0.20 — 31.10.2026

- Добавлен `scripts/browser-smoke.mjs` с настоящим Chromium через Playwright. Локальная статическая раздача запускается через Python HTTP server; приложение остаётся без runtime-зависимостей и backend.
- Проверены три viewport: desktop 1440×900, mobile 390×844 и small mobile 320×740.
- Во всех трёх размерах успешно проверены boot в главное меню, открытие настроек, переход по вкладкам «Звук», «Игра», «Доступность», «Данные», изменение параметров и сохранение в `localStorage`.
- Проверки подтвердили отсутствие горизонтального переполнения документа, экрана настроек и содержимого настроек; необработанных pageerror не обнаружено.
- Скрипт подключён в `.github/workflows/ci.yml`; Playwright и Chromium устанавливаются только в CI, production-проект по-прежнему не требует npm-пакетов.
- GitHub Actions run `41158193873` завершился `success`; все 17 шагов workflow успешны. Лог браузерного теста: 3/3 viewport прошли.
- README и CHANGELOG обновлены до состояния v0.20.
- Ограничение: это автоматическая браузерная проверка меню и настроек, а не полная визуальная оценка всех игровых сцен, Canvas-боёв, жестов дерева талантов и реального звука на физических устройствах.
- Пролог и его HTML-блок, `audio/prologue.mp3`, остальные аудиофайлы и логика озвучки не изменялись. Схема сохранений и игровые ID не менялись. Сетевые/онлайн-функции не добавлялись.