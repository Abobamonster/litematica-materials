# Разработка

Для обычного запуска ничего собирать не нужно: Index.html самодостаточен, а dist/ готов к статическому хостингу.

## Сборка страницы и комплекта

Нужен Python 3.10+ и интернет при первой сборке:

```sh
python build.py
```

Результаты: Index.html, Code.gs, dist/index.html, dist/litematica-kit.zip. Версии текстур закреплены в build.py. Кеш ресурсов asset-cache/ локальный, в репозиторий не входит.

## Проверки

```sh
python make_fixtures.py
node tests.cjs
node schem-tests.cjs
node groups-tests.cjs
node progress-tests.cjs
node bridge-tests.cjs
node lock-tests.cjs
node preview-tests.cjs
```

Нужен Node.js 22+; проверки Google выполняются с имитацией сервисов. Они не создают таблицы в аккаунте Google.

## Изменение 3D-движка

Готовый viewer.bundle.js уже включён. Если меняете viewer.js:

```sh
npm install
npm run build:viewer
python build.py
```

## Оформление

Тема D1 из предоставленного пользователем Opera Design Kit. Шесть исходных CSS-слоёв загружаются из theme/ в порядке: style, selection, opera, design-themes, tokens, product-clean. Затем применяются компоненты приложения из dist/style.css. Арт в theme/racing-transparent.png сохранён без изменения и встраивается в HTML. Шрифты: Segoe UI и Georgia с системными заменами.

Google-страница редактируется в bridge-shell.html и bridge-client.js. Code.gs получает её при сборке; фрагмент после BEGIN GENERATED GOOGLE BRIDGE вручную не редактируйте.
