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

# Shards of the Rift — Global Update Roadmap

Дата: 01.11.2026

## Цель

Постепенно привести существующую автономную браузерную 2D RPG к целевому качеству Shards of the Rift: цельный dark-fantasy мир, выразительные персонажи и противники, читаемый бой, сильные локации, аккуратный интерфейс и стабильная работа. Проект остаётся без backend, сетевых функций и обязательных сторонних библиотек; архитектура должна оставаться переносимой на Godot.

## Неприкосновенные ограничения
- Не менять исходную камеру, перспективу, управление, скорость перемещения и коллизии без отдельного согласования.
- Не ломать существующие сохранения и обратную совместимость.
- Сохранять автономную работу без CDN и внешних сервисов.
- Не менять пролог и озвучку без отдельного запроса.
- Канон целевого проекта: ровно 5 актов × 5 миссий; ровно 3 дракона-босса (Пепельный Вестник, Ледяная Хватка, Кровавая Корона); ровно 3 осколка, каждый гарантированно выпадает только со своего дракона; Разлом остаётся закрытым до победы над третьим драконом.
- Не добавлять четвёртого дракона-босса, дополнительные осколки или альтернативные источники осколков.

## Этапы глобального обновления
1. **Базовый аудит и художественное направление.** Зафиксировать исходное состояние, резервную копию, структуру ассетов, подключение атласов и ограничения. Сформировать единые правила визуального стиля.
2. **Мир и окружение.** Улучшить и согласовать terrain/props/dungeon атласы, биомы, декорации и читаемость поверхностей. Подключать новые ассеты только там, где они действительно используются.
3. **Герой, NPC и враги.** Улучшить силуэты и детализацию классов, разнообразие NPC и врагов; сохранить совместимость с текущим рендером.
4. **Анимации и боевые визуальные эффекты.** Удары, попадания, способности, состояния, смерть и телеграфирование атак; не менять баланс и механику без отдельного согласования.
5. **Локации и боссы.** Уникальные арены, визуальные истории регионов и три канонических дракона; проверить соответствие сюжету и спавнам.
6. **Интерфейс и обратная связь.** Инвентарь, экипировка, задания, карта, диалоги, HUD и меню — единая система оформления и адаптивность.
7. **Звук и атмосфера.** Проверить существующее аудио, добавить недостающие локальные звуки только при необходимости; не менять пролог/озвучку.
8. **Стабильность и производительность.** Реальный браузерный прогон, FPS/frame-time, тесты сохранений, регрессии и подготовка архитектуры к Godot.

Каждый этап завершается резервной точкой, проверками, списком изменённых файлов и честным отчётом о том, что проверено визуально, а что — только автоматически. Не переходить к следующему крупному этапу до отчёта по текущему.

## Этап 1 — результат аудита
- Проект — vanilla JS/HTML/CSS, Canvas 2D, без package.json и без обязательного build pipeline.
- Игровое поле Canvas: 800×500; камера и движение находятся в systems/overworld/ai.js, рендер — ui/overworld/render.js.
- Terrain atlas: 5×8 тайлов 96×96, показываются в сетке 48×48; подключён через ui/overworld/tile-atlas.js.
- Props atlas: 8×4; сейчас используется для сундуков и событийных объектов.
- Dungeon atlas: 10×4; в текущем runtime-пути не найдено подключения к игровому рендеру.
- Герои, враги, NPC и часть объектов рисуются Canvas-пиксельными масками в ui/overworld/sprites.js.
- Визуальные слои уже включают погоду, туман, освещение, bloom и CSS art-direction; их нужно развивать согласованно, а не дублировать.
- Автоматические проверки доступны через scripts/; полноценный браузерный визуальный прогон пока ограничен отсутствием Playwright/Chromium в проверенном окружении.

## Важное расхождение, требующее отдельного этапа согласования

Текущие данные и PROJECT_CONTEXT.md всё ещё содержат прежнюю идентичность «Осколки Кристалла Маны» и прежние shard-location связи (лес/руины/тень). Целевой Shards of the Rift задаёт другие названия осколков и драконов. Не выполнять механическую замену названий или лора в рамках визуального этапа: сюжет, награды, боссы и сохранения должны быть согласованы отдельной проверкой, чтобы не испортить кампанию и старые сейвы.

## Состояние рабочей копии на старте этапа 1

Рабочая копия уже содержала многочисленные изменения и удаления до начала этого обновления. Они не сбрасывались и не перезаписывались. Git CLI доступен через GitHub Desktop по пути из PROJECT_CONTEXT.md; текущая ветка — main. Резервная копия создана до изменений этого обновления в magic-rpg_global_update_prechange_2026-11-01 (без .git и node_modules).


## Этап 2 — статус: завершён (2026-11-01)

- В terrain atlas добавлены 8 тематических текстурных слоёв, по одному на каждый биомный ряд.
- В props atlas добавлены 32 деликатных слоя износа и окантовки.
- Координаты, сетки и исходные размеры активных атласов сохранены.
- Добавлены повторяемый скрипт обогащения атласов и автоматический тест результата.
- Проверены SVG XML, визуальные ассеты, импорты, smoke-load и smoke-boot (23/23).
- Dungeon atlas пока не интегрирован в игровой рендер; его подключение требует отдельного описания карты тайлов и проверки соответствия картам подземелий.
- Браузерный визуальный просмотр и FPS-профилирование не выполнены: Playwright/Chromium в проверенном окружении ранее отсутствовали.

Следующий этап: обновление силуэтов и детализации героя, NPC и противников без изменения управления, боевого баланса и AI.
