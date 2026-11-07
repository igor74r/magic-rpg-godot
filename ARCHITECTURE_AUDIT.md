# Архитектурный аудит и план миграции на Godot 4.7 Web

Дата аудита: 07.11.2026  
Исследованная папка: `C:\Users\Igor\Desktop\magic-rpg-main`  
Основа: мастер-промт миграции, фактическое содержимое локальной папки и локальные проверки Node.js.  
Статус: **Фаза 1 — аудит; исходный игровой код не изменялся.**

## 1. Краткий вывод

Проект — автономная браузерная 2D-RPG на ES-модулях, HTML/CSS и Canvas 2D. Текущий запуск — статический сайт через `index.html` → `main.js`; серверная часть не требуется. Сохранения и настройки находятся в `localStorage`.

В исследованной копии:
- 79 runtime JS-файлов: 13 data, 41 systems, 24 ui и `main.js`;
- 361 ребро относительных импортов в runtime-графе;
- три обнаруженных цикла UI-импортов;
- 7 runtime-файлов с прямым Canvas API;
- 3 runtime-файла, непосредственно работающих с localStorage;
- 7 CSS-файлов; статический подсчёт дал 309 вхождений `gradient(`, 11 `blur(` и 48 объявлений `filter:`;
- схема игрового сохранения — v18, схема настроек — v6, три слота;
- Godot-проект, `project.godot`, export preset, PWA manifest и service worker в этой папке пока не обнаружены;
- `.git` и `package.json` в этой локальной папке также не обнаружены. Это локальная рабочая копия файлов, но не Git checkout и не npm-проект.

**Решение:** не начинать перенос геймплея в Godot прямо сейчас. Сначала отделить состояние и правила от браузерных API, зафиксировать JSON-контракт и построить тесты паритета. JS-версия должна оставаться рабочей до фактического покрытия Godot-версией.

## 2. Текущая схема слоёв

```text
index.html
  ├─ DOM-экраны, панели, canvas#overworld-canvas
  ├─ css/*.css
  └─ main.js (entry point / orchestration / GameAPI)
       ├─ data/*                 контент и таблицы
       ├─ systems/state.js       singleton состояния
       ├─ systems/save.js        localStorage + миграции + валидация
       ├─ systems/*              игровые правила и подсистемы
       ├─ systems/overworld/*    логика исследования/боя/генерации
       ├─ systems/overworld.js   сборка и управление overworld runtime
       └─ ui/*                   DOM, Canvas, input, экраны и интерфейсы
```

Слои в исходном коде уже частично разделены по папкам, но архитектурно ещё не полностью независимы: игровые системы импортируют общий singleton `state`, используют глобальные `Math.random()`/время и вызывают `saveGame()`/event bus. Это означает, что переносить их в GDScript «один-в-один» без предварительных портов зависимостей будет рискованно.

## 3. Граф импортов и циклы

Статический проход по runtime-файлам обнаружил 361 относительную импортную связь. Главный вход `main.js` подключает state, world, save, inventory, progression, economy, UI и игровые подсистемы; часть импортов `ui/overworld.js` повторяется в entry point для разных экспортов.

Обнаружены циклы:
1. `ui/header.js → ui/inventory.js → ui/header.js`
2. `ui/header.js → ui/quests.js → ui/header.js`
3. `ui/header.js → ui/passives.js → ui/header.js`

Проверка `scripts/check-imports.mjs` подтверждает разрешение относительных импортов и именованных экспортов, но не устраняет архитектурную связанность этих циклов.

**Рекомендация:** вынести общие команды/селекторы и обновление заголовка в отдельный UI-координатор или узкие интерфейсы событий. Взаимные импорты header ↔ конкретные вкладки не должны переноситься в Godot как есть.

## 4. Canvas, браузерные API и рендер

### Canvas-зависимости

Прямые обращения к Canvas 2D находятся в:
- `main.js` — браузерная точка входа и экранные/вспомогательные операции;
- `ui/passives.js` — рисование дерева пассивных навыков;
- `ui/overworld/render.js` — основной рендер игрового мира;
- `ui/overworld/sprites.js` — спрайтовые фигуры/персонажи и объекты;
- `ui/overworld/effects.js` — погода, частицы, свечения и эффекты;
- `ui/overworld/tile-atlas.js` — отрисовка атласов тайлов;
- `ui/overworld/aurora-art.js` — художественные элементы Авроры.

Файл `systems/audio.js` тоже содержит обращения вида `ctx.*`, но это Web Audio `AudioContext`, а не CanvasRenderingContext2D. Его нельзя ошибочно считать частью графического рендера.

Игровая логика overworld уже вынесена в `systems/overworld/*`, однако координаты/модели и визуальные функции местами тесно связаны. `systems/overworld.js` — адаптер-оркестратор между миром, UI и игровыми подсистемами.

### Интерфейсы браузера, которые нужно заменить адаптерами

- DOM: `document`, `window`, `HTMLElement`, события мыши/клавиатуры, pointer/touch, focus и CSS;
- Canvas 2D: контекст, изображения, атласы, текст, эффекты;
- кадры и время: `requestAnimationFrame`, `performance.now()`, `Date.now()`;
- аудио: Web Audio API и HTMLAudioElement;
- голос: браузерный `speechSynthesis` / `SpeechSynthesisUtterance`;
- хранилище: `localStorage`;
- загрузка ресурсов: `Image`, `URL`, `import.meta.url`.

В Godot это должны быть отдельные реализации на GDScript: сцены/Control/Node2D, Texture2D/AtlasTexture, AudioStreamPlayer, таймер/монотонные часы, InputMap и SaveRepository. Бизнес-логика не должна напрямую знать об этих реализациях.

## 5. localStorage и сохранения: фактическое состояние

Рабочие ключи в `systems/save.js`:
- слоты: `magic-rpg-save-1`, `magic-rpg-save-2`, `magic-rpg-save-3`;
- старый одиночный слот: `magic-rpg-save`;
- настройки: `magic-rpg-settings`.

Версии:
- игровой JSON: `SAVE_VERSION = 18`;
- настройки: `SETTINGS_VERSION = 6`;
- допустимые слоты: 1–3.

Основные runtime-точки обращения:
- `systems/save.js` — чтение/запись/удаление слотов, миграция legacy-слота, настройки;
- `ui/menu.js` — UI импорта/экспорта/резервирования и транзакционные операции с данными сохранения;
- `main.js` — безопасные wrapper-функции для отдельных browser-local флагов (в том числе пролога).

Запись игрового сейва уже устроена как snapshot → JSON.stringify → localStorage.setItem; версия и playtime в live-state обновляются только после успешной записи. Загрузка валидирует данные до и после миграции; при неудачной записи мигрированного сейва восстанавливаются предыдущие state и slot. Есть защита от будущей версии схемы.

Миграции v1–v18 сейчас находятся в одном большом файле `systems/save.js`, а не в каталоге `save/migrations/`. Переносить их в Godot напрямую из монолитной функции не следует: сначала выделить чистые последовательные преобразования и зафиксировать вход/выход каждого шага тестами.

### 5.1. Контракт JSON v18 — наблюдаемая структура

Ниже — контракт по текущему конструктору персонажа и валидатору. Неизвестные/необязательные runtime-поля не следует удалять: контракт должен быть расширяемым и сохранять неизвестные совместимые поля при round-trip.

```json
{
  "version": 18,
  "worldSeed": 123456789,
  "worldGeneratorVersion": 1,
  "player": {
    "name": "Имя",
    "class": "warrior | mage | archer",
    "level": 1,
    "exp": 0,
    "expNext": 100,
    "hp": 100,
    "maxHp": 100,
    "mp": 0,
    "maxMp": 100,
    "str": 0,
    "int": 0,
    "wis": 0,
    "con": 0,
    "dex": 0,
    "luck": 5,
    "statPoints": 0,
    "passivePoints": 0,
    "gold": 0,
    "inventory": [{ "id": "item-id", "qty": 1 }],
    "equipped": {
      "weapon": null,
      "head": null,
      "shoulders": null,
      "chest": null,
      "gloves": null,
      "legs": null,
      "boots": null,
      "shield": null,
      "ring1": null,
      "ring2": null,
      "amulet": null,
      "cloak": null
    },
    "spells": [],
    "stats": { "kills": {}, "deaths": 0, "goldEarned": 0, "chestsOpened": 0 },
    "campaignKills": {},
    "campaignClaimed": {},
    "activeCampaignMission": null,
    "activeCampaignByBranch": {
      "intro": null,
      "ash": null,
      "ice": null,
      "blood": null
    },
    "achievements": [],
    "talents": [],
    "passives": ["start"],
    "effects": [],
    "cooldowns": {},
    "dailyQuests": { "date": 0, "list": [] },
    "buffs": [],
    "ngPlus": 0,
    "riftBest": 0,
    "playtimeSec": 0,
    "createdAt": 0
  },
  "location": "village",
  "world": {
    "schemaVersion": 1,
    "seed": 123456789,
    "generatorVersion": 1,
    "clockMinutes": 0,
    "legacyFastTravel": false,
    "discoveredRegions": [],
    "unlockedRoutes": [],
    "currentRegionId": "village",
    "regionVisits": {},
    "regions": {},
    "factionCampaigns": {},
    "events": {
      "active": [],
      "cooldowns": {},
      "history": [],
      "sequence": 0,
      "nextSpawnAt": 0
    }
  },
  "factions": {
    "reputation": {},
    "changeLog": []
  },
  "storyDragons": {
    "ash-herald": false,
    "ice-grasp": false,
    "blood-crown": false
  },
  "storyShards": {
    "flame": false,
    "ice": false,
    "blood": false
  },
  "shards": {
    "forest": false,
    "ruins": false,
    "shadow": false
  },
  "quests": {}
}
```

**Важно:** это схема формы/типов и пример нового персонажа, а не эталонное сохранение с реальными игровыми значениями. Для строгой JSON Schema нужно дополнительно закрепить диапазоны, обязательность и поля каждого предмета, а также структуры `world.regions`, активных событий, фракций, кампаний и экипировки. Валидатор v18 в `validateCurrentSaveShape()` уже задаёт обязательные ограничения:
- `worldSeed` — целое 1…2³²−1; `worldGeneratorVersion === 1`;
- основные характеристики игрока — конечные числа; HP/MP и max HP/MP имеют положительные/неотрицательные границы;
- level — целое 1…100; exp, statPoints, passivePoints, gold и ngPlus — безопасные неотрицательные целые;
- luck — 0…100;
- class — warrior/mage/archer/priest (Priest допустим для legacy);
- inventory — массив объектов с непустым string `id` и положительным целым `qty`, если qty задан;
- spells — массив строк; equipped/stats/campaignKills/campaignClaimed/activeCampaignByBranch — объекты;
- storyShards/storyDragons — объекты; world содержит seed, generatorVersion, discoveredRegions и unlockedRoutes;
- factions содержит reputation-объект и changeLog-массив.

Отдельные настройки — не часть игрового сейва: `magic-rpg-settings`, версия 6. Текущий код использует отдельные поля звука, сложности, autosave, графики, доступности и движения.

### 5.2. Обязательные правила совместимости

1. Godot читает v18 JSON без изменения смысла полей и записывает совместимый JSON.
2. Сначала импортируется исходный JSON, затем выполняется та же последовательность миграций v1→…→v18; старые версии нельзя «угадывать» по неполным полям.
3. Неизвестные поля не отбрасывать при загрузке/сохранении, если это не нарушает валидатор.
4. До успешной записи новой версии исходный сейв остаётся доступным для восстановления.
5. Экспорт/импорт — UTF-8 JSON; импорт сначала валидируется во временном объекте и только потом заменяет слот.
6. `worldSeed`, `world.generatorVersion`, посещения, открытые сундуки, события, боссовый прогресс, фракции и кампании — часть прогресса, не transient runtime.
7. `legacyFastTravel` сохраняет поведение старых сохранений; не отключать его автоматически для мигрированных legacy-персонажей.

## 6. Классификация модулей для переноса

Классификация — архитектурная, по назначению и фактическим зависимостям. «Переносить почти 1:1» не означает копировать код без тестов: зависимости от singleton, случайности, времени, сохранений и event bus должны быть вынесены в интерфейсы.

### 6.1. Данные — переносить в Godot Resources/JSON

`data/achievements.js`, `data/chronicles.js`, `data/classes.js`, `data/enemies.js`, `data/items.js`, `data/locations.js`, `data/npcs.js`, `data/passives.js`, `data/shop.js`, `data/spells.js`, `data/story.js`, `data/talents.js`, `data/world.js`.

Тип: контентные таблицы, описания, рецепты, баланс, карты/граф регионов.  
Путь: JSON как нейтральный контракт или Godot `.tres` для данных, которым нужны ресурсы/ссылки. Не менять ID, порядок миссий, числа и баланс. Функции генерации/roll внутри data-файлов отделить от статических таблиц.

### 6.2. Core-кандидаты — сначала отделить зависимости, затем переносить в GDScript

- `systems/progression.js` — формулы опыта и уровней.
- `systems/stats.js`, `systems/status.js` — расчёт характеристик и статусов.
- `systems/economy.js`, `systems/loot.js`, `systems/inventory.js` — правила экономики, добычи и предметов.
- `systems/crafting.js`, `systems/shop.js` — крафт и торговые операции.
- `systems/campaign.js`, `systems/campaign-branches.js`, `systems/story-dragons.js`, `systems/story-mini-bosses.js`, `systems/talents.js`, `systems/achievements.js`, `systems/dailyQuests.js` — прогрессия/правила контента.
- `systems/factions.js`, `systems/world-state.js`, `systems/world-events.js`, `systems/region-state.js` — состояние мира и последствия.
- `systems/rift.js`, `systems/tower.js`, `systems/ngplus.js` — эндгейм и циклы прогрессии.
- `systems/overworld/collisions.js`, `movement.js`, `ai.js`, `enemy-ai.js`, `hazards.js`, `map.js`, `spawn.js`, `secrets.js`, `combat.js` — игровая симуляция мира.

Перед портированием этим модулям нужны явные аргументы вместо скрытого чтения `state`, внедряемый RNG, источник времени и интерфейс сохранения/событий. Для боевой логики особенно важны тесты паритета на фиксированных входах.

### 6.3. Смешанные модули — сначала разделить на core и адаптер

- `systems/character.js` — создание персонажа смешано с инициализацией state, выдачей стартовых предметов и записью.
- `systems/save.js` — JSON-схема/валидация/миграции смешаны с localStorage; разделить на SaveContract + миграции + LocalStorageAdapter/IndexedDBAdapter.
- `systems/state.js` — singleton; оставить временным JS-адаптером, постепенно заменить передачей зависимостей.
- `systems/events.js` — event bus можно сохранить как абстрактный интерфейс, но не связывать с DOM.
- `systems/overworld.js` — оркестрация runtime, UI и симуляции; разделить на WorldSession и browser adapter.
- `systems/overworld/particles.js`, `systems/overworld/log.js` — определить, являются ли они симуляционными данными или визуальным/текстовым представлением, затем разнести.
- `systems/audio.js` — переписать под Godot AudioStreamPlayer; Web Audio не переносится 1:1.
- `systems/voice.js` — переписать через Godot/JavaScriptBridge; проверить наличие SpeechSynthesis в Web.
- `systems/overworld/world-event-markers.js` — отделить описание маркеров от отрисовки.

### 6.4. Веб-специфичные — переписать, не переносить код

Все модули `ui/*` и `main.js` являются веб-слоем либо UI-координаторами:
- `ui/character.js`, `chronicles.js`, `dashboard.js`, `game.js`, `header.js`, `inventory.js`, `menu.js`, `npcs.js`, `overworld.js`, `passives.js`, `quests.js`, `screens.js`, `shop.js`, `spells.js`, `village.js`, `world.js`;
- `ui/overworld/aurora-art.js`, `combat-panel.js`, `depth-order.js`, `effects.js`, `models.js`, `render.js`, `sprites.js`, `tile-atlas.js`;
- `main.js`.

В Godot это сцены, Control-ноды, сигналы, InputMap, Node2D/TileMapLayer/Sprite2D/AnimatedSprite2D, Texture2D и ресурсы. `depth-order.js` и `models.js` могут сохранить чистые алгоритмы сортировки/описания, но визуальные узлы должны быть Godot-native.

### 6.5. Не переносить в runtime Godot

- `scripts/*.mjs` — Node.js проверки, тестовые harness, Playwright/CDP и CI-скрипты; оставить в JS-репозитории как тестовую инфраструктуру.
- `.github/workflows/*` — CI/deploy workflow; не игровой runtime.
- `test-artifacts/*` — снимки и отчёты тестирования; не игровые данные.
- `docs/*`, Markdown-журналы — документация; сохранять и обновлять.
- CSS и HTML — не копировать как игровой UI Godot; сохранить web-классическую версию как fallback.

Ничего из перечисленного не предлагается удалять из репозитория: «не переносить» не означает «удалить».

## 7. Проверка известных проблем из мастер-промта

- **Неатомарный крафт:** в текущей локальной копии `systems/crafting.js` уже есть snapshot инвентаря/заказов, rollback при неудачном списании, создании результата или сохранении. `scripts/check-crafting-jobs.mjs` прошёл. Поэтому формулировка мастер-промта о неатомарном крафте для этой копии устарела или описывает более раннее состояние. Не переписывать крафт без нового воспроизводимого дефекта.
- **Нормализация экипировки:** `systems/save.js` содержит `normalizeEquipped()` и миграции старых слотов v12/v13/v16; `systems/inventory.js` содержит runtime `normalizeEquipment()`. Ответственность пересекается в нормализации legacy-слотов и формата экипировки. Нужен единый core-нормализатор с тестами миграции, но миграции должны оставаться версионированными и не вызывать потери предметов.
- **m-cryomancer:** точное упоминание ID `m-cryomancer` в проверенном runtime-коде/тестах не найдено. Это не доказывает отсутствия рассинхронизации в описаниях других умений; требуется отдельная сверка каждого класса/умения по данным и фактическому обработчику.
- **CSS-производительность:** в локальной копии фактические счётчики выше указанных в мастер-промте (309 gradient, 11 blur, 48 filter declarations). Это статический счётчик, не доказательство FPS-проблемы. Оптимизацию делать после профилирования и визуального сравнения.

## 8. Швы и безопасный порядок развязки

1. **Save contract:** зафиксировать JSON v18 и настройки v6 как независимые контракты; добавить fixture сейва для каждого v1–v18.
2. **Pure migration pipeline:** извлечь v1→v2…v17→v18 в отдельные последовательные функции, сохранив текущий результат и rollback.
3. **Core primitives:** вынести RNG, Clock, ItemCatalog, EventSink и SavePort интерфейсы; не менять баланс.
4. **Inventory/equipment:** единая нормализация предметов/слотов, инварианты 12 слотов, паритетные тесты.
5. **Progression/economy/status:** перенос формул и расчётов, фиксированные входы/выходы.
6. **Crafting/loot/shop:** транзакции, таблицы дропа, торговые правила и RNG injection.
7. **Campaign/factions/world:** квесты, ветви кампаний, фракции, региональные последствия, события и world seed.
8. **Combat:** пошаговый бой, статусы, боссы, ИИ и награды — только после паритета предыдущих слоёв.
9. **Overworld simulation:** движение, коллизии, генерация карт, спавн, тайники, hazards, persistence.
10. **Render seam:** интерфейс Renderer нужен для JS-подготовки, но не следует делать абстракцию, которая копирует весь Canvas API. Сначала выделить команды сцены/модели: terrain, actor, object, effect, HUD.
11. **Godot shell:** отдельный проект Godot 4.7.x, минимальный экран и загрузчик JSON; пока без игровой логики.
12. **Parallel runtime:** JS и Godot живут параллельно; переключение по URL/папке, JS остаётся fallback.

## 9. Приоритезированный бэклог фаз 2–12

| Приоритет | Фаза | Результат | Условие перехода |
|---|---|---|---|
| P0 | 2. Renderer seam | Выделены команды рендера; Canvas остался в browser adapter | core/systems не импортируют Canvas/DOM; browser smoke и визуальный diff |
| P0 | 3. Save contract | JSON v18, миграции, атомарное хранилище, IndexedDB adapter, импорт/экспорт | все v1–v18 fixtures round-trip без потерь |
| P0 | 4. JS stabilization | JSDoc/ts-check, сборка, unit/integration/browser tests | CI зелёный, воспроизводимая сборка |
| P1 | 5. Godot shell | Godot 4.7 GDScript-only проект и web export skeleton | Web сборка открывается в браузере и читает v18 JSON |
| P1 | 6. Data + core utilities | данные и формулы в Godot | JS↔Godot parity fixtures зелёные |
| P1 | 7. Combat/inventory/crafting | бой, экипировка, инвентарь, крафт | паритет игровых сценариев и rollback |
| P1 | 8. UI/render | Godot Control и 2D сцены/атласы | функциональное и визуальное покрытие JS |
| P1 | 9. Story/progression | 5 актов, 25 миссий, 3 дракона, осколки, финал | старый сейв продолжает игру без потерь |
| P1 | 10. Web/PWA/deploy | WebAssembly/WebGL2, offline cache, fallback | браузер, офлайн и мобильный smoke пройдены |
| P2 | 11. Parity / classic | полное сравнение JS/Godot, ADR о судьбе JS | полный playthrough обеих версий |
| P3 | 12. Cloud sync | только по отдельному запросу | не входит в обязательную миграцию |

Godot Web: использовать GDScript, Compatibility renderer и single-threaded export для GitHub Pages, пока не доказана доступность COOP/COEP. Не использовать C# для Web-цели. Проверить фактическую стабильную версию 4.7.x перед созданием проекта; не полагаться на старые API/паттерны до 4.6.

## 10. ADR, которые нужно оформить до соответствующих фаз

- ADR-001: нейтральный JSON Save Contract v18 и политика неизвестных полей.
- ADR-002: SaveRepository/SavePort и IndexedDB в браузере.
- ADR-003: стратегия миграций и обратимой записи сейвов.
- ADR-004: RNG/Clock/EventSink как внедряемые зависимости.
- ADR-005: Renderer seam и граница между simulation/model/render.
- ADR-006: Godot 4.7 Web export (Compatibility, single-threaded).
- ADR-007: Godot Web save bridge и импорт старого localStorage.
- ADR-008: PWA/service worker, MIME, cache invalidation и fallback.
- ADR-009: TTS bridge и fallback.
- ADR-010: критерии паритета и момент возможного вывода JS-версии.

## 11. Выполненные проверки в этой локальной копии

Запущены на локальном Node.js:
- `node scripts/check-imports.mjs` — PASS, 160 JS/MJS-файлов, все относительные импорты и именованные экспорты разрешены;
- `node scripts/check-save-migrations.mjs` — PASS, миграции v1–v17 → v18, idempotence, legacy slot, future-version guards, rollback при ошибке записи;
- `node scripts/check-crafting-jobs.mjs` — PASS, rollback материалов/инвентаря и повторное получение заказа при ошибке записи;
- `node scripts/smoke-load.mjs` — PASS, данные/контент/основные игровые контракты загружаются.

Эти проверки не являются полным CI, не заменяют браузерный smoke и не подтверждают Godot Web export. В рамках аудита полный набор тестов не запускался.

## 12. Риски и откат

- **Риск сейвов:** любое изменение нормализации или миграций может потерять предметы, миссии, фракции или региональный прогресс. Нужны копии реальных сейвов, фикстуры и тесты round-trip; оригиналы не трогать.
- **Риск паритета:** разные RNG/порядок операций могут менять лут, генерацию, бой и награды. Нужен детерминированный RNG и одинаковые тестовые входы.
- **Риск рендера:** преждевременный общий Renderer способен стать абстракцией ради абстракции. Сначала определить минимальные игровые draw commands.
- **Риск Web:** Godot bundle тяжелее JS; PWA кэш и fallback обязательны для плавного перехода.
- **Риск аудио/TTS:** browser API не эквивалентны Godot audio/voice.
- **Риск структуры:** текущая локальная папка не содержит .git; нельзя делать локальный commit/rollback средствами git в этой папке. Перед любыми локальными изменениями нужна отдельная резервная копия или получение полноценного checkout.

Откат каждой будущей фазы: отдельная ветка/коммит в Git-репозитории, JS runtime остаётся доступен, новый Godot runtime включается только отдельным URL/путём. Никаких удалений старой версии до завершения паритета.

## 13. Статус и следующий шаг

- Фаза 1: **аудит выполнен на уровне статического графа, ключевых модулей, хранилища и проверок**.
- Игровой код не изменялся.
- GitHub не обновлялся.
- Файлы игры/сохранения не изменялись.
- Следующий безопасный шаг после отдельного разрешения: Фаза 2 — ADR-005 и минимальный Renderer seam, начиная с одного вертикального среза overworld; но до кода нужно сохранить эту карту как исходную точку и согласовать способ вести ветки, так как локальная папка не является Git checkout.
