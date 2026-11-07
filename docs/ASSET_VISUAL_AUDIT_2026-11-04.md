# Аудит визуальных ассетов — 04.11.2026

## Область и источник

Репозиторий: `igor74r/magic-rpg`, ветка `main`. Инвентаризация выполнена по Git tree API с `truncated=false`; снимок содержит 200 файлов. Этот документ фиксирует исходную точку перед следующими заменами графики. Он **не означает**, что все ассеты уже перерисованы.

## Инвентарь PNG

В репозитории 29 PNG: 7 игровых/брендинговых ресурсов и 22 скриншота в `test-artifacts/visual-review/`.

| Файл | Размер изображения | Размер файла | Назначение |
|---|---:|---:|---|
| `assets/tiles/terrain/atlas.png` | 480×768 | 46,442 B | 5 столбцов × 8 биомов; исходный тайл 96×96, отображение 48×48 |
| `assets/tiles/props/atlas.png` | 768×384 | 45,343 B | 8×4 атлас тематических объектов |
| `assets/tiles/dungeons/atlas.png` | 480×192 | 15,367 B | 10×4 декоративный атлас подземелий, тайл 48×48 |
| `assets/aurora/ground-atlas.png` | 768×96 | 4,411 B | 8 кадров по 96×96: 4 варианта травы и 4 варианта дорожной плитки |
| `assets/aurora/village-props-atlas.png` | 1024×64 | 3,906 B | 16 кадров по 64×64 для декораций Авроры |
| `assets/aurora/world-portal.png` | 64×64 | 660 B | отдельный спрайт центрального портала |
| `assets/branding/mana-crystal.png` | 128×128 | 1,768 B | брендовый/иконный ресурс |

Проверены сигнатуры PNG и заголовки IHDR. У terrain/props/dungeons атласов, village props, portal и mana-crystal PNG color type 6 (RGBA, 8 bit). У `ground-atlas.png` color type 2 (RGB, 8 bit), без alpha. Это подтверждено также существующим `check-visual-assets.mjs`, который проверяет декомпрессию как 3 байта на пиксель. При будущей замене нельзя механически переводить этот файл в RGBA без одновременного пересмотра валидатора и потребителя; текущая спецификация «PNG-32 RGBA» расходится с фактическим контрактом этого файла.

## Связанные файлы и ограничения

- `assets/tiles/manifest.json` задаёт размеры, порядок столбцов/строк и пути атласов.
- `ui/overworld/tile-atlas.js`, `ui/overworld/sprites.js`, `ui/overworld/aurora-art.js` используют PNG и Canvas 2D.
- Для пиксельного рендера используется nearest-neighbour (`imageSmoothingEnabled = false`).
- `scripts/check-visual-assets.mjs` проверяет целостность PNG, полный поток данных ground atlas, Aurora building renderer, PNG props atlas и отсутствие градиентов/SVG в `aurora-art.js`.
- `scripts/check-world-atlas-enrichment.mjs` фиксирует размеры основных атласов и соответствие manifest.
- `scripts/check-village-layout.mjs` фиксирует 38×28 карту Авроры, 8 зданий, портал, NPC, коллизии и доступность.
- `test-artifacts/visual-review/` содержит 22 существующих скриншота UI, мира и биомов. Их наличие не заменяет повторный визуальный просмотр после изменения ресурсов.

## Подтверждённое исправление

В `assets/tiles/manifest.json` исправлена повреждённая UTF-8 строка названия атласа: `вЂ—` заменено на корректное длинное тире `—`. Значения manifest, пути, размеры, порядок тайлов и игровые данные не менялись.

## Не выполнено в рамках этой инвентаризации

- В первой художественной партии заменён `assets/aurora/ground-atlas.png`: 768×96 RGB, 8 вариантов (4 травы + 4 каменной плитки), плоская 16-bit палитра, чёткие пиксельные границы, без blur/gradient. Файл сжат до 13,128 B (ранее 4,411 B); суммарный прирост `assets/` остаётся ниже лимита +15% по текущей оценке.
- Не заявляется завершённая художественная ревизия всех биомов, персонажей, драконов, предметов и UI. Скриншоты visual-review после новой текстуры ещё не пересняты.
- Не заявляется ручной визуальный осмотр каждого кадра.
- Перед дальнейшей заменой нужна сверка каждого потребителя атласа и прогон полного CI после каждого блока; исходная версия ground atlas доступна в истории Git.

## Следующий этап

Приоритет: Aurora ground/props и здания; затем terrain/dungeon/props атласы; затем персонажи и три сюжетных дракона; далее предметные и UI-ассеты. Для каждого файла сохранить путь, геометрию сетки, фактический формат/alpha-контракт и совместимость с существующим renderer. Визуальный стиль: 2D pixel art, 16-bit, плоские цвета, без blur и gradient, crisp edges.


## Дополнительная сверка дерева репозитория

После добавления документа инвентаризации рекурсивное дерево содержит 201 файл, 29 PNG и 0 SVG. В `scripts/` обнаружено 76 файлов, из них 69 файлов `check-*.mjs`; всего в дереве 71 `.js` и 76 `.mjs` (147 JS/MJS-файлов). Следовательно, числа «17 check-*.mjs» и «87 JS/MJS-файлов» из глобального промта v2.2 не совпадают с текущим содержимым ветки main и не должны использоваться как критерии полноты без актуализации.


## Первая художественная партия — Aurora ground atlas

- Заменён `assets/aurora/ground-atlas.png` без изменения пути, размера 768×96, сетки 8×1, RGB color type и декомпрессированного объёма данных.
- Восстановлена pixel-art стилистика: 16-bit, плоские цвета, без blur/gradient, crisp edges. Сохранены 4 варианта grass и 4 варианта path.
- Новый PNG: 13,128 B против 4,411 B (+8,717 B). Прирост относительно прежнего суммарного размера `assets/` около 7.2%, что ниже лимита +15%.
- Manifest title приведён к 16-bit pixel-art направлению; геометрия/индексы не менялись.
- Визуально проверено содержимое нового PNG через декодирование изображения. Полный тестовый прогон и пересъёмка visual-review ожидают CI/browser runtime; PASS пока не заявлен.


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


## 04.11.2026 — Пропорции растительности и пиксельные детали NPC

- Увеличен видимый размер дубов и сосен: прежние прозрачные поля в кадрах атласа делали деревья слишком мелкими относительно зданий. Для каждого вида заданы отдельные размеры; низкие клумбы, ограды и изгороди не подняты до высоты деревьев.
- Контактные тени растительности согласованы с новыми силуэтами.
- Ролевые детали кузнеца, лекаря, торговца, стража, старейшины, алхимика, глашатая, барда и детей переведены на целочисленные плоские пиксельные кластеры без сглаженных линий и дуг.
- Добавлены статические проверки размеров кадров в мире и запрета векторных штрихов в деталях NPC.
- Требуется дождаться CI/Pages и просмотреть новые desktop/mobile visual-regression screenshots; до этого визуальная проверка этого изменения не считается завершённой.


## 04.11.2026 — Интерьеры Авроры переведены на плоский Pixel Art

- В `css/2d-art-direction.css` заменены градиентные стены/пол, размытое свечение очага и скруглённые карточки мебели: теперь используются плоские заливки, ступенчатые детали, жёсткие пиксельные оконные/очажные формы и отдельные CSS-пиктограммы предметов.
- В `main.js` emoji-предметы комнат и emoji-метка Авроры заменены слотами пиксельных силуэтов и текстом; кнопка входа также очищена от emoji.
- `scripts/check-village-layout.mjs` проверяет наличие пиксельных классов во всех шести интерьерах и отсутствие градиентов/blur в блоке интерьерной графики.
- CI/Pages и новые browser captures ещё ожидаются; до визуального просмотра скриншотов этап не считается завершённым.

- `scripts/browser-visual-regression.mjs` расширен: desktop/mobile browser regression последовательно открывает все шесть интерьеров, сохраняет отдельный скриншот каждой комнаты, проверяет три пиксельных силуэта предметов и подтверждает `background-image: none` / `filter: none`.

- В `ui/overworld/tile-atlas.js` уменьшено количество дополнительных травяных кластеров с 18–26 до 8–12 на тайл, alpha слоя снижена с 0.72 до 0.42. Базовый авторский ground atlas теперь визуально доминирует, а редкие пиксели травы/цветов не превращают лужайку в шум.
- `scripts/check-visual-assets.mjs` проверяет ограниченную плотность и непрозрачность деталей.

- Убран последний текстовый символ из интерьерного орнамента пола: теперь это пустой `aria-hidden` CSS-пиксельный мотив. Статическая и browser-регрессия проверяют отсутствие glyph, открытое окно комнаты, выбранную палитру и три отрисованных силуэта предметов.

- Обновлён query-параметр ES-модуля в `index.html` на `main.js?v=20261104-aurora-interior-pixel-pass`, чтобы браузер не использовал предыдущий кэш `main.js`; `scripts/check-startup-fallback.mjs` проверяет актуальный URL.

- Cache-busting распространён и на `css/2d-art-direction.css`; `scripts/check-startup-fallback.mjs` проверяет оба URL. Это не позволяет браузеру соединить новую разметку комнат со старым интерьерным CSS.

- Просмотр desktop/mobile screenshots выявил наложение: декоративная метка «АВРОРА» попадала под кнопку закрытия модального окна. Метка удалена; очаг перенесён выше в правую часть стены, а три карточки предметов выровнены по одной нижней линии. Cache keys `main.js` и art-direction CSS обновлены до `20261104-aurora-interior-layout-2`, оба значения закреплены startup-тестом.

- Browser-регрессия теперь проверяет реальные computed colors `::before` и `::after` у всех трёх предметов каждой из шести комнат; статическая проверка требует все 36 CSS-правил пиксельных тел и бликов, а не только по одной иконке на комнату.

- Ручной просмотр contact sheet растительности показал большие прозрачные поля внутри кадров PNG: деревья, кусты и садовые объекты выглядели заметно меньше заданных world footprints. `drawAuroraNature()` теперь один раз определяет границы непрозрачных пикселей каждого кадра 64×80, кэширует crop и масштабирует видимую часть до заданного размера без сглаживания. `check-visual-assets.mjs` закрепляет эту логику.

- Для каждой комнаты заданы собственные оттенки очага и окна: кузница — уголь/жар, лечебный дом — зелёный, алхимия — фиолетовый, рынок — золотой, зал совета — тёплая слоновая кость, таверна — янтарный. Все псевдоэлементы остаются плоскими пиксельными блоками с чёткими краями; cache keys JS/CSS обновлены до `20261104-aurora-interior-palettes-3`.

- Пиксельный знак пола выведен на передний план поверх карточек предметов и опущен ближе к краю пола: он больше не выглядывает из-под центрального предмета. Финальные cache keys интерьерных JS/CSS — `20261104-aurora-interior-finish-4`.

- Ручной просмотр двора показал, что трава оставалась шумной даже после уменьшения декоративных пикселей. Авторский grass atlas теперь смешивается с плоской базовой заливкой при alpha 0.42; дополнительных кластеров только 3–5 на тайл при alpha 0.24. Дорожки остаются непрозрачными. Alpha Canvas восстанавливается в `finally`; тест проверяет плотность, смешивание и восстановление состояния. Cache keys обновлены до `20261104-aurora-flat-ground-5`.


- Final grass review against desktop and mobile captures: the earlier alpha 0.42 still left visible texture noise. The atlas is now drawn at alpha 0.26; decorative grass clusters are 2–3 per tile at alpha 0.14. Pixel character shadows use three stepped rectangular bands. The CI run `41886704221` passed all steps and its desktop/mobile screenshot artifact was manually reviewed.

- Browser visual QA now includes a dedicated `aurora-02-npc-art-sheet.png` built through production `drawObject()`: all 12 village residents/special NPCs are rendered (blacksmith, healer, alchemist, merchant, elder, well, bard, guard, cat, kids, herald, questBoard). The latest CI run `41889099528` passed 81/81 steps; artifact `13351764287` was downloaded and the NPC sheet manually inspected. GitHub Pages run `41889099501` passed.
