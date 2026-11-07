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

# Changelog

## v0.27 — карта мира и визуальная проверка биомов (01.11.2026; исходная запись локального этапа)

- Исправлено наложение названий локаций: подписи показываются для текущей, выбранной или наведённой точки; подпись деревни перенесена над центральной меткой, точки карты разнесены по большей площади.
- Browser smoke дополнен реальным входом в 2D-мир из деревни на desktop, mobile и small-mobile; на desktop автоматически проверяются все пять сюжетных биомов и сохраняются отдельные скриншоты.
- Добавлен check-campaign-full.mjs: полное прохождение 25 миссий в каноническом порядке, проверка неправильных целей/локаций, ограничения счётчиков, трёх драконьих наград, закрытого Разлома до Кровавой Короны и финального условия.
- Визуально проверены карта мира и реальные сцены пяти биомов; скриншоты лежат в test-artifacts/visual-review.
- Регрессия после этапов: синтаксис PASS (87 JS/MJS-файлов); 17 check-*.mjs PASS; campaign-playthrough PASS (138/138); smoke-load PASS; smoke-boot PASS (40); browser-smoke-cdp PASS на трёх размерах экрана, включая запуск 2D-сцены и пять биомов.
- Изменения локальные; GitHub не изменялся.


## v0.26 — расширенная проверка игрового цикла (01.11.2026, локальная рабочая копия)

- Добавлены отдельные регрессионные сценарии полного прохождения 25 миссий, миграции всех сохранений v1–v16 и боевых действий Воина, Мага и Лучника.
- Добавлен автоматический контракт offline-only: игровые runtime-файлы не используют fetch/XHR/WebSocket/EventSource/beacon и удалённые URL.
- Браузерная проверка расширена: пролог и TTS-кнопка, ровно три игровых класса, перетаскивание поля талантов, 40 этажей Башни, 30 областей Разлома, блокировка Разлома до трёх драконов, обе концовки и реальный запуск 2D-локации с возвратом в дашборд.
- Исправлено размещение кнопки озвучивания пролога: теперь она находится перед кнопкой начала игры. Повышен контраст вступительного текста.
- Визуально просмотрены снимки пролога, выбора класса, дерева талантов, Башни и карты Разлома. Проверены desktop 1440×900, mobile 390×844 и small-mobile 320×740.
- Финальная регрессия: синтаксис PASS (94 JS/MJS-файла); 16 check-*.mjs PASS; smoke-load PASS; smoke-boot PASS (40); browser-smoke-cdp PASS на трёх размерах.
- Изменения локальные; GitHub не изменялся.


## v0.25 — чистый канон трёх осколков (01.11.2026, локальная рабочая копия)

- Удалён устаревший предмет «Осколок маны», который мог выглядеть как четвёртый сюжетный осколок. Он заменён нейтральной квестовой «Печатью старого архива».
- SAVE_VERSION повышена до v17. Миграция v16 → v17 переименовывает старый предмет в существующих сохранениях, не теряя его количество и не добавляя новый осколок.
- Награда за сюжетного дракона централизована в claimStoryDragonReward: только три назначенных дракона в своих финальных миссиях выдают соответствующий осколок, повторная выдача невозможна.
- Добавлены тесты: ровно три предмета storyShard; ни один enemy drop и локация не выдаёт осколок; три драконьих награды соответствуют своим ID и выдаются один раз; старый квестовый предмет мигрирует без потери.
- Финальная регрессия: синтаксис PASS (82 JS/MJS-файла); все 12 check-*.mjs PASS; smoke-load PASS; smoke-boot PASS (40); browser-smoke-cdp PASS (3 размера экрана).
- Изменения локальные; GitHub не изменялся.


## v0.24 — баланс и торговый ассортимент (01.11.2026, локальная рабочая копия)

- Усилена защита торговых сервисов: T6 boss-only и сюжетные осколки не могут быть куплены или проданы даже при прямом вызове экономического API.
- Ассортимент торговца и магазина расширен: добавлены оружие, нагрудник, наплечье, перчатки/наручи, поножи, сапоги, щит, плащ, амулеты и кольца; каждая категория экипировки имеет доступный товар.
- Исправлена реплика лекаря: цена полного исцеления в диалоге совпадает с реальной стоимостью 8 золота.
- Проверки экономики подтверждают цены T1–T6, запрет торговли T6/осколками и прогрессию цен по актам. Browser smoke повторно прошёл в Chrome на 1440×900, 390×844 и 320×740.
- Изменения локальные; GitHub не изменялся.


## v0.23 — инвентарь, экипировка и T1–T6 (01.11.2026, локальная рабочая копия)

- Приведены к единой схеме 12 слотов экипировки: оружие, голова, плечи, грудь, перчатки/наручи, поножи, сапоги, щит, два кольца, амулет и плащ.
- Разделены типы щита, перчаток, поножей, сапог, плаща и амулета; миграция сейвов v15 → v16 переносит предметы из старых слотов без потери экипировки.
- Кузнец теперь предлагает улучшение любого надетого предмета, а не только оружия и нагрудника.
- Обновлены таблицы аффиксов: каждый из 11 типов экипировки имеет пул минимум из пяти модификаторов для T6.
- Устаревшие проверки редкости, аффиксов и пролога обновлены под T1–T6 и «Осколки Разлома».
- Добавлен автономный браузерный smoke-тест через Chrome DevTools Protocol без Playwright; реальный Chrome прошёл desktop 1440×900, mobile 390×844 и small-mobile 320×740: настройки, инвентарь, продажа, магазин, кузнец, отсутствие горизонтального переполнения и JS-ошибок.
- Проверки: smoke-load PASS; smoke-boot PASS (40); check-imports PASS (64 файла); check-gameapi PASS (101/147); все check-*.mjs из набора class/economy/inventory/map/passives/rarity/settings/story/visual-assets/world-atlas PASS.
- Изменения локальные; GitHub не изменялся.


## v0.22 — «Осколки Разлома» (01.11.2026, локальная рабочая копия)

- Канон кампании обновлён: ровно 5 актов × 5 миссий, три сюжетных дракона и три гарантированных осколка. Разлом открывается после Кровавой Короны; добавлены 30 областей Разлома, две концовки и Башня на 40 этажей.
- Пролог переписан под Shards of the Rift; русская озвучка работает через системную TTS браузера/ОС.
- Добавлены тиры T1–T6, базовые диапазоны характеристик, аффиксы, Luck/репутационный модификатор добычи и бонус редкости T4+ в Разломе. T6 оставлен только для боссовых наград.
- Добавлены ограничения крафта по актам, три финальных рецепта T5, лагерные заказы на 1–3 часа, перековка за эссенции и улучшение экипировки на +5%.
- Инвентарь получил сетку 6×5, весовой лимит от Силы и отдельные вкладки. Добавлены окно продажи с подтверждениями, пресеты магазина и обратный выкуп в тот же день с наценкой 20%.
- Схема сохранений обновлена до v15. NG+ сбрасывает прогресс высокоуровневого крафта и обратный выкуп.
- Локальные проверки: smoke-load PASS; smoke-boot PASS (40 проверок); check-imports PASS (64 файла); check-gameapi PASS (101 метод / 147 вызовов).
- Изменения не отправлялись в GitHub; ручное прохождение кампании и браузерная визуальная проверка ещё требуются.


## v0.21 — «Высокодетальная 2D-графика» (01.11.2026)
- Переработан основной terrain atlas: 480×768, исходные тайлы 96×96, 8 биомов и 5 типов поверхности/объектов.
- Добавлены детализированные текстуры травы, каменных дорог, биомных объектов, воды и скал с градиентами, бликами и тематическими палитрами.
- Игровая сетка и отображаемый размер тайла сохранены 48×48; рендер использует высококачественное сглаживание исходного атласа.
- Добавлен отдельный CSS-слой 2D art direction для сцены, рамки игрового поля, боевой/NPC-панелей, главного меню и HUD.
- Обновлены manifest и проверки визуальных ресурсов; smoke-load проверяет новые координаты атласа.
- Существующие правила перемещения, коллизии, бой, сохранения, пролог, озвучка и сетевые ограничения не менялись.


## v0.20 — «Настоящая браузерная проверка»
- Добавлен `scripts/browser-smoke.mjs`: реальный запуск Chromium через Playwright.
- Проверяются загрузка игры, открытие настроек, вкладки «Звук», «Игра», «Доступность» и «Данные».
- Проверяется сохранение параметров сложности, автосохранения и доступности после изменения в интерфейсе.
- Проверяется отсутствие горизонтального переполнения на размерах 1440×900, 390×844 и 320×740.
- Проверяется отсутствие необработанных JavaScript-ошибок.
- Браузерный прогон добавлен в GitHub Actions; Chromium устанавливается только в CI.
- Пролог, озвучка, игровые ID и схема сохранений не менялись. Онлайн-функции не добавлялись.

## v0.19 — Глобальное издание: восстановление, экипировка и кампания (31.10.2026)

- Восстановлены каталог предметов и ежедневные задания после повреждения текстовой заменой; сохранены все новые предметы, руны, материалы, свитки и сюжетные осколки.
- Инвентарь расширен до 12 анатомических слотов, включая плечи, спину, запястья, печать и два независимых кольца. Добавлена миграция старых сохранений до схемы v13.
- Кампания содержит 5 актов и 25 миссий и охватывает все 15 приключенческих регионов; болотный регион задействован в задании второго акта.
- Синхронизированы отображаемые награды мимика, кристалла маны и ежедневного сундука с фактически начисляемым золотом.
- Проверки: синтаксис двух восстановленных файлов, импорты, GameAPI, smoke-load и smoke-boot проходят; smoke-boot — 23 проверки. Проверка сетевых API-вызовов не нашла fetch/XHR/WebSocket/EventSource/sendBeacon.
- Пролог, озвучка и файлы audio/ не менялись; онлайн-функции не добавлялись. Визуальная проверка в реальном браузере ещё требуется.

## v0.18 — Инвентарь, панорамируемое древо и пять печатей (31.10.2026)

- Перестроен инвентарь: восемь слотов экипировки (оружие, доспех, шлем, перчатки, сапоги, амулет и два кольца), сравнение характеристик, фильтры, сортировка, продажа слабых обычных вещей.
- Добавлены 10 элементов экипировки, 5 рун, 5 ремесленных материалов и восстанавливающее зелье. Руны вставляются в свободные гнёзда экипировки и влияют на характеристики.
- Обновлены магазин и добыча: новые предметы доступны у торговца и выпадают из тематических врагов/боссов.
- Древо пассивных навыков можно перемещать мышью или касанием, перетаскивая поле; узлы остаются отдельными кнопками для изучения.
- Переделан сюжетный цикл: Эдвин выдаёт одно поручение, убийства учитываются только после принятия и в требуемой локации, готовую миссию нужно сдать за награду.
- Переписан лор пяти актов и 25 миссий. Цепочка проходит через все 15 приключенческих регионов, содержит главы, сюжетные переходы и материальные награды.
- Save schema v12: миграция дополнительных слотов экипировки, гнёзд рун и прогресса миссий; NG+ сбрасывает и принятые, и сданные миссии, сохраняя экипировку и добычу.
- Проверки: node --check 60/60; check-imports OK; check-gameapi OK; smoke-load OK; smoke-boot 23/23. Реальная браузерная визуальная проверка отдельно не выполнялась.
- Пролог, озвучка и файлы audio/ не изменялись; онлайн-функции не добавлялись.


## v0.17 — Биомы, опасности и гарантированный спавн (31.10.2026)

- Пять новых регионов получили самостоятельные палитры, погодные эффекты и цвет тумана: Глухая чаща, Затонувший некрополь, Обсидиановые поля, Крепость вечного льда и Кратер Бездны.
- Опасные поверхности теперь проходимы только в соответствующих регионах: лава, ядовитая жижа и подводные шипы. Обычные камни и стены остаются непроходимыми.
- Исправлен расчёт критического шанса: бонус дерева талантов применяется один раз, временный бонус удачи добавляется отдельно, итог ограничен 75%.
- Спавн пяти актов перемешивает полный список противников до добавления повторов; каждый тип врага и босс акта гарантированно попадают на карту.
- Проверки: `node --check` — 60/60; `check-imports` — OK; `check-gameapi` — OK; `smoke-load` — 44 проверки; `smoke-boot` — 18/18 (3 последовательных запуска).
- Пролог, озвучка и `audio/` не изменялись. Сетевые функции не добавлялись. Реальный браузерный визуальный прогон ещё не выполнен.

## v0.16 — Глобальное издание (31.10.2026)

- Завершено локальное дерево пассивных навыков: 5 ветвей и 20 узлов для каждого из трёх игровых классов; добавлены уровневые требования и перекрёстные связи.
- Кампания расширена до 5 актов и 25 миссий. Все идентификаторы врагов и локаций проверены на соответствие данным игры.
- Расширены классы Воина, Мага и Лучника: уклонение, блок, сила блока, критический шанс и пробитие брони.
- Добавлены 12 предметов (экипировка, зелья, свитки) и 5 заклинаний; свитки корректно изучают новые заклинания и складываются в инвентаре.
- Подключены оригинальные SVG-атласы тайлов 48×48: поверхности и сундуки реально рисуются из атласов, предусмотрен процедурный fallback. Атласы подземелий и декораций подготовлены для следующих интерьерных карт.
- Пять новых регионов получили собственные палитры и погодные профили: дождь/светлячки в Глухой чаще, пепел в Некрополе и Кратере, искры в Обсидиановых полях, снег в Крепости.
- Опасности тайлов разделены по регионам: лава в Обсидиановых полях, ядовитая жижа в Глухой чаще, подводные шипы в Некрополе. Тип 3 остаётся каменным препятствием по умолчанию и проходим только в регионах, где это опасная поверхность; стены и скалы по-прежнему блокируют путь.
- Спавн актов сначала размещает каждого уникального врага, включая босса, и только после этого повторяет типы для дополнительных слотов.
- Добавлена вкладка «Хроники»: 4 главы лора, 3 фракции и 5 нитей побочных историй.
- Добавлены автоматические проверки для кампании, деревьев пассивок, всех 16 локаций и хроник.
- Сохранения обновлены до схемы v11: прогресс сюжетной кампании отделён от общего бестиария; старые убийства остаются в статистике, но не засчитываются как пройденные сюжетные миссии. NG+ начинает кампанию заново.
- Финальная победа теперь требует собрать три осколка и завершить все 25 сюжетных миссий; задания считают убийства только в регионе своего акта.
- Проверки: `node --check`, `check-imports`, `check-gameapi`, `smoke-load` и `smoke-boot` проходят.
- Пролог, MP3 и озвучка не менялись. Сетевых функций не добавлено.

## v0.14 — «Карта» (30.10.2026)
- Вкладка «Локации» стала картой мира: деревня Аврора — в центре, 10 локаций — по орбите
- По карте можно ходить (WASD/стрелки), точка под курсором/рядом подсвечивается
- Клик по точке выбирает локацию, `E`/`Enter` — перейти и войти; панель снизу показывает описание и действия
- Быстрые действия деревни (магазин, ежедневный сундук, Разлом) перенесены в панель локации
- Карта не перехватывает клавиши вне экрана игры и останавливается при входе в overworld

## v0.13 — «Витраж» (30.10.2026)
- Пиксельные 2D-спрайты: герои по классам, 25 врагов по архетипам, NPC и объекты (`ui/overworld/sprites.js`)
- Новая палитра мира: все 12 тем переведены на холодный «мана-спектр» (индиго/циан вместо коричнево-золотого)
- HUD перерисован: панель со срезанными углами, тонкие бары, пипсы трёх осколков, погодная строка
- Слой UI-темы `css/theme.css`: острые панели, срезанные кнопки, новая типографика, стили боя/NPC/тултипов
- События на карте (алтарь, кристалл, мимик, странник) рисуются спрайтами вместо emoji
- Версия интерфейса: v0.13

## v0.12 — «Стабильность» (30.10.2026)
- UI разбит на модули: `ui/game.js` — фасад, `ui/overworld.js` — оркестратор; рендер и погода вынесены в `ui/overworld/`
- Восстановлен цикл overworld после распила: рендер, HUD, миникарта, пауза, тултипы, автосейв
- Починен клик по слотам инвентаря (`GameAPI.invSlotClick`), убраны мёртвые импорты
- CI на GitHub Actions: синтаксис, импорты/экспорты, контракт GameAPI, smoke-загрузка и boot-smoke
- Публикация на GitHub Pages: https://igor74r.github.io/magic-rpg/
- Добавлены `.gitignore` и карта проекта `PROJECT_CONTEXT.md`

> Записи для v0.11 в CHANGELOG не было — версия не документировалась.

## v0.10 — «Финальный штрих»
- Добавлены 2 локации: 📚 Забытая библиотека, 🐉 Логово дракона
- Добавлены 8 новых врагов + 2 босса (Архимаг, Древний дракон)
- Добавлены 3 заклинания через свитки: ⚡ Молния, ☠️ Ядовитый туман, 🛡️ Щит
- Добавлены 3 модификатора врагов: 🧛 Вампирский, 💚 Регенерирующий, 💢 Берсерк
- Добавлены 3 достижения для Разлома (этаж 10/25/50) + «Убийца драконов»
- Добавлен favicon (SVG 💎)
- Добавлены README.md и CHANGELOG.md

## v0.9 — «QoL 3»
- Тултипы на эффектах в шапке
- Зелья с эффектами: антидот, эликсир силы, эликсир маны
- Кнопка «Экипировать лучшее»
- «До следующего уровня: X EXP» в шапке

## v0.8 — «Статистика»
- Вкладка «📊 Статистика» (убийства, смерти, золото, время в игре)
- Сравнение в магазине (тултип с бонусами)
- Подсказка про эндгейм в шапке

## v0.7 — «Рефакторинг»
- systems/overworld.js разбит на 6 модулей (map, log, particles, spawn, combat, ai)

## v0.6 — «Разлом»
- Бесконечный Разлом (эскалация сложности, рекорд по этажам)
- 2 новые локации: ❄️ Ледяные пики, 🏜️ Пустошь

## v0.5 — «Слоты + NG+»
- 3 слота сохранений
- NG+ (сохранение экипировки, враги +50% HP)

## v0.4 — «Бой»
- Способности классов (3 на класс)
- Статус-эффекты (яд, ожог, кровотечение, оглушение)
- Фазы боссов

## v0.3 — «Экономика»
- Кузнец (ковка до +3)
- Лекарь (полное лечение за золото)
- Алхимик (крафт зелий из трав)

## v0.2 — «Петля»
- Реиграбельные локации (рандом врагов, сундуки)
- Редкие дропы (1% легендарка с обычного врага)
- Ежедневный сундук
- 15 достижений

## v0.1 — MVP
- Меню → выбор класса → игра
- Overworld с боем на карте
- Редкость предметов, элитники
- Звук (Web Audio API)


## Графическая оптимизация — 2026-11-01
- Убраны повторные `save/restore` и переключения сглаживания для каждого тайла terrain atlas; сглаживание включается один раз на проход карты.
- После прохода terrain atlas pixel-art персонажи и эффекты снова рисуются без сглаживания.
- Bloom/свечение перенесено на пол-разрешения (400×250 вместо 800×500) и масштабируется при композитинге; затраты на пиксельную обработку слоя свечения снижены примерно на 75% без изменения размера игрового canvas.
- Сглаживание props atlas локально восстанавливает исходное состояние Canvas.
- Камера, управление, игровые механики, карта и сохранения не менялись.
- Проверки: `smoke-boot` (23), `check-imports` (61 файл), `check-visual-assets` — успешно.


## Этап 1 — глубокая оптимизация графического движка (2026-11-01)
- Туман: радиальные градиенты трёх слоёв теперь предварительно рендерятся в небольшие offscreen-текстуры при инициализации локации; в кадре выполняется повторное использование готовых изображений вместо пересоздания градиентов.
- Погодные частицы снега, пепла и угольков объединены в один Canvas path/fill на тип погоды вместо отдельного beginPath/fill на каждую частицу.
- Сохранены прежние оптимизации атласа тайлов и уменьшенного bloom-буфера.
- Игровая логика, карта, камера, управление и баланс не изменялись.
- Проверки: syntax check, smoke-boot (23), smoke-load, check-imports (61 файл), check-visual-assets, check-overworld-map — успешно.
- Браузерный FPS-профиль не снимался: Playwright в проекте не установлен; численный прирост FPS не заявляется.

## Этап 3 — анимации героя и врагов (2026-11-01)
- Герой получил отдельные циклы шага и покоя: чередование ног, встречное движение рук и небольшое изменение высоты корпуса при ходьбе.
- Анимация шага героя включается только при нажатых клавишах движения и вне боя; исходные WASD/стрелки и скорость перемещения не менялись.
- Для гуманоидных врагов добавлено определение фактического смещения между кадрами и синхронизация шага с движением; неподвижные существа сохраняют спокойную idle-анимацию.
- Анимация реализована средствами Canvas поверх существующих пиксельных спрайтов; новые изображения, внешние библиотеки и сетевые ресурсы не добавлялись.
- Игровая логика, ИИ, коллизии, камера, управление и боевой баланс не изменялись.
- Проверки: `node --check` для sprites/models/render, `check-imports` (61 файл), `smoke-load`, `smoke-boot` (23) — успешно.
- Визуальная проверка в реальном браузере не выполнялась; качество движения нужно подтвердить в игре.

## Этап 4 — освещение, тени и атмосфера (2026-11-01)
- Тёмная маска освещения в overworld теперь использует один переиспользуемый offscreen canvas вместо создания нового canvas каждый кадр.
- Перед каждым проходом маска полностью очищается и сбрасывает состояние композитинга/прозрачности, чтобы не накапливались артефакты между кадрами и локациями.
- Свет вокруг героя получил более плавный радиальный спад с выраженной центральной зоной и мягкой границей.
- Добавлен очень слабый цветовой рефлекс вокруг края света: холодный для мага, тёплый для остальных классов.
- Сохранены существующие погодные эффекты, туман, молнии, виньетка и освещение сундуков/событий. Камера, управление и игровая логика не менялись.
- Проверки: `node --check` для render/effects, `check-imports` (61 файл), `smoke-load`, `smoke-boot` (23), `check-visual-assets` — успешно.
- Браузерная визуальная проверка и замер FPS не выполнялись.

## Этап 5 — настройки графики (2026-11-01)
- Добавлена отдельная вкладка «Графика» в меню настроек.
- Добавлены профили качества: низкое, сбалансированное и высокое.
- Добавлены независимые переключатели погоды, атмосферного тумана и Bloom.
- Низкий профиль отключает тяжёлые декоративные проходы; сбалансированный сохраняет погоду и ослабляет туман, но отключает Bloom; высокий оставляет все включённые эффекты.
- Новые параметры входят в миграцию настроек (версия 5), сохраняются автоматически и учитываются при сбросе настроек.
- Проверки: синтаксис state/save/menu/render, check-imports (61 файл), smoke-load, smoke-boot (23), check-visual-assets, отдельная проверка миграции настроек — успешно.
- Браузерная визуальная проверка и замер FPS не выполнялись.

## Этап 6 — финальная техническая проверка (2026-11-01)
- Проверен встроенный счётчик FPS: он измеряет частоту кадров по интервалам примерно в 1 секунду и отображается при включённой настройке «Счётчик FPS».
- Обновлён `scripts/check-settings.mjs`: тест теперь проверяет версию миграции 5, значения по умолчанию, сохранение пользовательских графических настроек и наличие/применение графических переключателей.
- Исправлена только форматировка перехода между вкладками настроек в `ui/menu.js`; поведение не менялось.
- Успешно пройдены syntax checks, check-settings, check-imports (61 файл), smoke-load, smoke-boot (23), check-visual-assets, check-overworld-map, check-gameapi (89 методов), class talents, economy, inventory/affixes, passives, story depth и rarity.
- Браузерный профайлер не запущен: пакет `playwright` отсутствует в окружении, браузерные исполняемые файлы не обнаружены в стандартных путях. Поэтому фактический FPS, frame time и сравнение до/после не измерены; прирост производительности не заявляется.


## Глобальное обновление Shards of the Rift — этап 1 (2026-11-01)
- Создан GLOBAL_UPDATE_PLAN.md: зафиксированы целевые ограничения, поэтапный план, текущая структура графики и выявленные расхождения старого лора с Shards of the Rift.
- Сохранена исходная рабочая копия до изменений этапа 1: [локальный путь скрыт] (без .git и node_modules).
- Код игры, камера, управление, механики, сохранения и ассеты на этом этапе не менялись.
- До начала обновления в рабочей копии уже были незакоммиченные изменения и удаления; они сохранены без сброса.


## Глобальное обновление Shards of the Rift — этап 2 (2026-11-01)
- Terrain atlas: добавлены 8 тонких биомных текстурных слоёв поверх исходных 40 тайлов; исходная сетка 5×8 и размеры 480×768 сохранены.
- Props atlas: добавлены деликатная фактура износа и внутренняя окантовка для всех 32 ячеек; исходная сетка 8×4 и размеры 768×384 сохранены.
- Добавлен скрипт scripts/enrich-world-atlases.mjs и отдельная проверка scripts/check-world-atlas-enrichment.mjs.
- Dungeon atlas проверен, но не подключён к runtime-рендеру; не заявляется как изменение картинки в самой игре.
- Камера, управление, механики, баланс, сохранения и игровые данные не менялись.


## Дополнительные исправления — 02.11.2026
- Управление в overworld сбрасывает WASD/стрелки при потере фокуса окна или скрытии вкладки, чтобы герой не продолжал двигаться из-за пропущенного keyup.
- Доска объявлений использует делегированные data-действия вместо inline JavaScript; исправлен data-атрибут кнопки получения ежедневной награды.
- Защищены награды кампании от переполнения золота; ежедневные задания нормализуют сохранённый прогресс, берут награды из доверенного пула и отклоняют некорректный баланс без его перезаписи.
- Добавлены проверки нормализации ежедневных заданий, защиты от некорректных балансов, поддельного флага выполнения и будущей даты; интерфейс сообщает, если награда не выдана.
- Проверка контракта GameAPI ищет фактическое присваивание фасада и не ломается из-за более ранних делегированных ссылок; обращения к API снова читаемы.
- Дополнительная проверка баланса: CI для актуального HEAD ещё не подтверждён; PASS не заявляется.


## 04.11.2026 — Инвентаризация визуальных ассетов

- В `docs/ASSET_VISUAL_AUDIT_2026-11-04.md` зафиксирован baseline main: 201 файл в Git tree, 29 PNG (7 игровых/брендинговых ресурсов и 22 скриншота visual-review), размеры атласов и контракты PNG.
- Исправлена UTF-8 кодировка названия в `assets/tiles/manifest.json`; значения manifest и игровые ресурсы не менялись.
- Уточнён важный контракт: `assets/aurora/ground-atlas.png` сейчас RGB (color type 2), остальные проверенные игровые PNG — RGBA (color type 6). Не конвертировать ground atlas без изменения его валидатора и проверки потребителя.
- Это инвентаризация и исправление метаданных, не завершённая замена графики. В актуальном дереве 69 файлов check-*.mjs и 147 JS/MJS-файлов (71 .js + 76 .mjs), поэтому числа 17 и 87 из глобального промта v2.2 устарели. Полная художественная переработка остаётся следующими этапами.


## 04.11.2026 — Aurora ground atlas: первая художественная партия

- Заменён `assets/aurora/ground-atlas.png` на 16-bit pixel-art: 768×96, 8 тайлов (4 grass + 4 path), RGB, без blur и gradient, с чёткими краями.
- Сохранены имя файла, путь, размеры, сетка 8×1 и RGB-декодирование, которое проверяет `scripts/check-visual-assets.mjs`.
- PNG оптимизирован до 13,128 B (исходный — 4,411 B); прирост +8,717 B, ориентировочно +7.2% к исходному объёму `assets/`, в пределах +15%.
- Название manifest обновлено с high-detail на 16-bit pixel-art. Остальные игровые ассеты и логика не менялись.
- Новый PNG визуально декодирован и просмотрен. CI/browser smoke и обновление screenshot review для нового HEAD ещё не подтверждены; не считать художественную ревизию завершённой.


## 04.11.2026 — Аврора: физика природных объектов и сортировка по основанию

- `systems/overworld/collisions.js`: добавлены отдельные ground-footprint коллайдеры для 12 крупных природных объектов Авроры (деревья, камни, пень, изгороди и ограды). Кроны остаются проходимыми; декоративные клумбы и кусты не превращены в непредусмотренные препятствия.
- `scripts/check-village-layout.mjs`: проверяет наличие и размеры всех 12 природных коллайдеров, реальные точки контакта и достижимость обязательных NPC/служб/дверей с учётом объектных коллизий.
- `systems/overworld/spawn.js`: статические здания и природные объекты получают depthY у основания (y+8), 96px prop-спрайты — у нижней границы (y+48).
- `scripts/check-render-depth-order.mjs`: добавлена проверка, что игрок, здание и крупный prop сортируются по реальной точке контакта с землёй.
- Исправлена ошибочная ожидаемая величина теста 11 → 12; после исправления проверки планировки и depth-sort прошли.
- GitHub Actions CI PASS на HEAD `e2fc88f2452b51a6a720729fbfb668792ec7119b`: синтаксис, импорты, профильные тесты, Aurora layout/collision, depth-sort, desktop/mobile smoke и desktop/mobile visual regression.
- GitHub Pages deployment PASS на том же HEAD. CI: https://github.com/igor74r/magic-rpg/actions/runs/41869588042 ; Deploy: https://github.com/igor74r/magic-rpg/actions/runs/41869588012 .
- Это завершает текущий инженерный блок, но не весь художественный rework Авроры: atlas props, дома/декорации, персонажи и последующая визуальная ревизия остаются открытыми.


## 04.11.2026 — Aurora village props atlas: вторая художественная партия

- Полностью заменён `assets/aurora/village-props-atlas.png`: 1024×64 RGBA, 16 кадров по 64×64, сохранены индексы кадров и порядок, используемые `ui/overworld/sprites.js`.
- Обновлены все 16 игровых декораций: фонарь, мемориал, скамья, рыночный прилавок, фонтан, клумба, знамя, жаровня, наковальня, дрова, тележка, бочки, травяная стойка, морозный фонарь, знак Разлома и врата Башни.
- Единая ограниченная палитра, пиксельные контуры, плоские цвета, без blur/gradient. Размер PNG 5,740 B против прежних 3,906 B (+1,834 B).
- Визуально проверен новый atlas; сетка и формат подтверждены существующим контрактом renderer. GitHub Actions CI PASS, включая PNG integrity, desktop/mobile browser smoke и gameplay visual regression; GitHub Pages deployment PASS на HEAD `4659bdcc35b95c2618b54728cccc22bcbdd33837`.
- CI: https://github.com/igor74r/magic-rpg/actions/runs/41870326122 ; Deploy: https://github.com/igor74r/magic-rpg/actions/runs/41870326188 .
- Художественная переработка Aurora ещё не завершена: здания, природа, terrain, персонажи/NPC и повторная ручная оценка всей сцены остаются в очереди.


## 04.11.2026 — Aurora: плоское освещение и интеграционная проверка глубины

- `ui/overworld/render.js`: для Авроры отключены radial fog, radial vignette и soft bloom. Сохранены плоский тёплый tint и мягкий night tint; свет от lantern/brazier передаётся stepped flat-color прямоугольниками без blur/gradient. Остальные биомы не менялись.
- `scripts/check-visual-assets.mjs`: добавлены проверки запрета bloom/fog/vignette для Aurora и наличия пиксельных световых пятен.
- `scripts/check-render-depth-order.mjs`: проверяет фактические `depthY`, создаваемые `spawnStatics()`, для здания, дерева и 96px prop.
- Повторно проверены desktop/mobile browser smoke и gameplay visual regression; скриншоты просмотрены вручную. Сцена Авроры стала заметно светлее и сохраняет чёткие пиксельные контуры.
- GitHub Actions CI PASS и GitHub Pages deployment PASS на HEAD `8adb744fb95dbfcc59faf3b60e35649a2b741b1d`. CI: https://github.com/igor74r/magic-rpg/actions/runs/41871414096 ; Deploy: https://github.com/igor74r/magic-rpg/actions/runs/41871414112 .


## 04.11.2026 — Depth anchors для сюжетных декораций

- `systems/overworld/spawn.js`: три динамически добавляемых сюжетных объекта Авроры (знамя Пепельного Вестника, морозный фонарь Ледяной Хватки, мемориал Кровавой Короны) теперь получают `depthY` по нижней границе 96px prop-кадра.
- `scripts/check-render-depth-order.mjs`: интеграционно проверяет depth anchors для всех трёх сюжетных декораций через реальный `spawnStatics()`, временно выставляя флаги побед и восстанавливая исходное состояние.
- CI PASS (включая Aurora layout/collision, все depth-sort tests, desktop/mobile smoke и visual regression) и Pages deployment PASS на HEAD `fe14820833eab35a36bc6f592ce24fe1187aa274`.
- CI: https://github.com/igor74r/magic-rpg/actions/runs/41872002645 ; Deploy: https://github.com/igor74r/magic-rpg/actions/runs/41872002846 .


## 04.11.2026 — Финальная проверка сюжетных prop anchors

- Проверка реальных сюжетных декораций (победы над тремя драконами) через `spawnStatics()` завершена; временное тестовое состояние игры корректно восстанавливается.
- Полный GitHub Actions CI PASS, включая desktop/mobile smoke и gameplay visual regression; GitHub Pages deployment PASS на HEAD `3e2fbba68a69e0d29b910bb287929bdd4846e8cf`.
- CI: https://github.com/igor74r/magic-rpg/actions/runs/41872353680 ; Deploy: https://github.com/igor74r/magic-rpg/actions/runs/41872353514 .


## 04.11.2026 — Aurora nature atlas: третья художественная партия

- Добавлен `assets/aurora/nature-atlas.png`: 512×80 RGBA, 8 кадров 64×80 для oak, pine, bush, rock, stump, hedge, fence и flowerbed.
- `ui/overworld/sprites.js` теперь использует авторский PNG atlas как основной источник для природных объектов; процедурный pixel fallback остаётся только на время загрузки изображения/при недоступности Image.
- `assets/tiles/manifest.json` регистрирует точную геометрию, кадры и display sizes.
- `scripts/check-visual-assets.mjs` проверяет PNG dimensions, RGBA color type, список стилей, путь загрузки и nearest-neighbour sampling. Скриншоты desktop/mobile visual regression просмотрены: новый atlas отображается в игровой сцене, без потери layout.
- CI PASS и Pages deployment PASS на HEAD `89ad2c79188b79e5b25d267755c7bd7a4153f66a`. CI: https://github.com/igor74r/magic-rpg/actions/runs/41873200313 ; Deploy: https://github.com/igor74r/magic-rpg/actions/runs/41873200129 .
- Остаётся завершить ручную проверку каждого природного кадра на полном масштабе и пройти оставшиеся архитектурные/NPC арт-этапы.


## 2026-11-04 — Aurora vegetation scale and NPC pixel-detail pass

- `ui/overworld/sprites.js`: enlarged the visible world footprint of oak/pine silhouettes and gave each Aurora nature style a proportionate size; flowerbeds, fences and other low garden pieces remain close to ground level.
- `ui/overworld/render.js`: widened the pixel-stepped contact shadows to match the enlarged nature silhouettes.
- `ui/overworld/sprites.js`: replaced antialiased line/arc embellishments on Aurora NPC role details with integer-aligned flat-color pixel clusters for blacksmith, healer, merchant, guard, elder, alchemist, herald, bard and children.
- `scripts/check-visual-assets.mjs`: added regression checks for species-specific dimensions and the absence of vector strokes in NPC role details.
- Browser visual regression and full CI are running for the new main-branch head; visual completion is not claimed until the updated screenshots are reviewed.


## 2026-11-04 — Aurora interiors rebuilt in flat pixel art

- `css/2d-art-direction.css`: replaced gradient-based room backdrops, blurred hearth glows and rounded furniture cards with flat-color walls/floors, stepped pixel details, hard-edged window/hearth shapes and role-specific CSS pixel prop silhouettes.
- `main.js`: replaced emoji room props and the house emoji label with dedicated pixel-icon slots and text; the interior entry button no longer uses an emoji glyph.
- `scripts/check-village-layout.mjs`: verifies all six interiors have pixel-art prop classes and rejects gradients/blur in the Aurora interior art block.
- CI and Pages are pending; updated browser captures must be inspected before marking the interior art pass complete.


- `scripts/browser-visual-regression.mjs`: desktop and mobile runs now enter and capture all six Aurora interiors, assert three pixel-art prop silhouettes per room, and verify the room backdrop has no background image/gradient or CSS filter.


- `ui/overworld/tile-atlas.js`: reduced the extra Aurora grass flecks from 18–26 to 8–12 per detail tile and lowered overlay alpha from 0.72 to 0.42. The authored ground atlas remains the dominant surface; sparse pixel tufts/flowers now add texture without making the lawn look grainy.
- `scripts/check-visual-assets.mjs`: guards the restrained detail density and opacity.

- Removed the last text glyph used as an interior floor ornament; it is now an empty, aria-hidden CSS pixel motif. Static and browser regression checks assert the glyph-free floor marker, visible room modal, selected room palette and three rendered prop silhouettes.

- Updated the `index.html` module query to `main.js?v=20261104-aurora-interior-pixel-pass` so browsers do not reuse the previous cached game module; `scripts/check-startup-fallback.mjs` now asserts the current cache-busted URL.

- Cache-busted `css/2d-art-direction.css` as well as `main.js`; the startup contract test now asserts both URLs. This prevents deployed browsers from pairing the new room markup with a stale interior stylesheet.

- Browser screenshots exposed a desktop/mobile header collision: the redundant Aurora corner label sat under the modal close control. Removed that label, moved the hearth into the upper-right wall area so it remains visible, and aligned all three prop cards along one bottom baseline. Cache keys for both `main.js` and the art-direction stylesheet were advanced to `20261104-aurora-interior-layout-2`; the startup contract test tracks both.

- Interior visual regression now validates the actual computed `::before` and `::after` colors for all three props in each of the six rooms; static checks require all 36 room/item pseudo-element rules (18 bodies + 18 highlights), not merely one representative icon per room.

- Manual inspection of the nature contact sheet showed that the PNG frames contained large transparent margins, making trees, bushes and garden props read much smaller than their world footprints. `drawAuroraNature()` now measures each 64×80 frame's non-transparent bounds once, caches the crop, and scales the visible sprite to its authored world dimensions with smoothing disabled. `check-visual-assets.mjs` guards the alpha-bound crop path.

- Differentiated each interior hearth and window tint by room role: forge ember, healer green, alchemy violet, market gold, hall warm ivory and tavern amber. The room-specific pseudo-elements remain hard-edged flat-color pixel clusters; JS/CSS cache keys advanced to `20261104-aurora-interior-palettes-3` and are covered by the startup contract test.

- Raised the interior floor pixel motif above the prop cards and moved it closer to the foreground so it no longer appears clipped behind the center item. Final interior JS/CSS cache keys are `20261104-aurora-interior-finish-4`.

- Manual courtyard review showed the grass base still looked noisy even after reducing the decorative flecks. The authored grass atlas is now blended over the flat base at 0.42 opacity; extra tufts are limited to 3–5 per tile at 0.24 opacity. Path tiles remain fully opaque. Canvas alpha is restored in `finally`, and `check-visual-assets.mjs` guards density, blend and state restoration. Cache keys advanced to `20261104-aurora-flat-ground-5`.


- Проверенный срез Aurora (CI run 41883204150, commit 85bd4988): 81/81 шагов CI PASS, включая desktop/mobile browser smoke и visual regression. Вручную просмотрены кадры двора и шести интерьеров. Исправлены crop прозрачных полей природы, шумность травы, интерьерные палитры/композиция, cache-busting JS/CSS и .gitignore. Полный ручной аудит всех файлов и художественный этап NPC остаются незавершёнными.

- Replaced the remaining antialiased ellipse shadow under overworld characters with three stepped rectangular pixel bands. The shared helper covers hero, NPC and creature footprints; `check-visual-assets.mjs` now rejects a return to Canvas ellipses. JS/CSS cache keys advanced to `20261104-aurora-pixel-shadows-6`.

- Aurora visual pass: grass atlas opacity reduced to 0.26 and decorative tufts to 2–3 per tile at 0.14; character shadows changed to stepped pixel bands. Desktop/mobile browser smoke and visual regression passed; Pages deployment passed.

- Overworld audit: custom Aurora static collider sets now include nature ground footprints. Chest reward logs and effects are deferred until `saveGame()` succeeds, preventing false reward feedback after rollback. Both regressions have dedicated tests and passed CI/Pages.

- Save export: defer Blob URL revocation by one second so browser downloads are not cut off; the safe-rendering contract covers this handoff.

- Shop transaction QA: expanded economy regression tests to verify that failed storage writes roll back bulk sales and buybacks without losing items, gold, earned-gold stats, or retryable buyback records. CI 82/82 and Pages deployment passed.
