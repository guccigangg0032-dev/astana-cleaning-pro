# ACPro Instagram Direct: безопасная миграция на Facebook Login

Этот документ относится к `AstanaCleaningPro`, `@astanacleaningpro` и Plesk-сайту `acpro.kz`. Изменения в GitHub **не обновляют Plesk автоматически**.

## Что доказано 17.10.2026

- Facebook Page: `1353920131143281`.
- Instagram Professional ID: `17841423790986385`.
- Facebook Graph API `GET /{page-id}/conversations?platform=instagram&limit=5` с **Page Access Token** возвращал пять переписок.
- `GET /{page-id}/subscribed_apps` изначально вернул `data: []`; после отдельного `POST` проверка показала поле `messages`.
- `GET /{ig-id}/subscribed_apps` вернул `data: []` (снимок пользователя).
- Meta Dashboard показывает Instagram Webhook field `messages` как подписанный, но **новые реальные POST** в Plesk после контрольного Direct **пока не появились**.
- Поэтому отсутствие входящих POST **нельзя объяснить только PHP-кодом**: webhook не выполняется, пока запрос не достиг сервера.

## Два независимых направления отладки

1. **Доставка события Meta → Plesk**: отдельно проверить `POST /v26.0/17841423790986385/subscribed_apps` с `subscribed_fields=messages` и Page Access Token, затем `GET` того же ребра. Для Instagram Login путь иной: `graph.instagram.com/me/subscribed_apps` с IG user token. Не путать токены/хосты/подписки. Подтвердить подписку поля `messages` в Meta Developers → Instagram Webhooks на callback `https://acpro.kz/api/ig-webhook.php`; проверить Development/Live и полномочия тестировщиков при отправке Direct. Не считать `success:true` гарантией доставки: нужен настоящий POST в Plesk и файл в закрытой очереди.
2. **Ответ сервера → Instagram**: прежний PHP-релей использовал `graph.instagram.com/me/messages` и Instagram User Token, а проверенные диалоги относятся к Facebook Login. В этой ветке добавлен явный `api_mode`. Для Facebook Login отправка выполняется через `graph.facebook.com/v26.0/{facebook_page_id}/messages` с **Page Access Token** и `messaging_type=RESPONSE`; старый режим Instagram Login сохранён.

## Перед любыми реальными ответами

**Ранее Page Access Token был раскрыт в переписке. Отзвать старую авторизацию и получить новый токен.** Ни Page Access Token, ни Instagram токен, ни App Secret, ни `worker_token` нельзя помещать в GitHub, переписку или на общедоступный сайт.

Скопировать изменения только после проверки/слияния PR и резервной копии Plesk. В приватном `private-acpro-meta/config.php` (не в `httpdocs`) указать:

```php
'api_mode' => 'facebook_login',
'facebook_page_id' => '1353920131143281',
'facebook_page_access_token' => 'НОВЫЙ_НЕПУБЛИЧНЫЙ_ТОКЕН_СТРАНИЦЫ',
'instagram_account_id' => '17841423790986385',
'replies_enabled' => false,
```

Не удалять другие существующие настройки `app_secret`, `verify_token`, `worker_token`. **Не включать `replies_enabled` до теста реального входящего сообщения, проверки локального агента Qwen и ручного подтверждения безопасного текста ответа.**

## Контрольные условия для запуска

- Meta отправляет настоящий `POST` на `/api/ig-webhook.php` после Direct от тестировщика.
- `webhook-status.json` показывает `signature: valid`, `event_types.text_message > 0`, `queued > 0`; диагностика хранит только типы/счётчики и до десяти записей без текста, токенов и ID клиентов.
- Приватная очередь содержит событие (не копировать личную переписку из неё).
- Локальный агент получает событие, формирует корректный ответ и остаётся в безопасном dry-run.
- Только после ручной проверки включается одна контролируемая отправка через Page Send API.

## Ограничения

- GitHub-тесты не подтверждают фактическую доставку Webhook Meta или успешную отправку сообщения внешнему человеку.
- Изменения PHP в этой ветке не решают отсутствие входящего HTTP-запроса от Meta. Это надо расследовать отдельно.
- Текущая обработка Webhook принимает только объект `instagram`; неизвестные объекты не ставит в очередь, чтобы не перепутать Messenger Facebook-страницы с Instagram Direct.
