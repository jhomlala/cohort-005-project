# Hosted notification-feed providers: comparison

Issue: jhomlala/cohort-005-project#3 (parent map #1). Researched 2026-11-12 from official docs and pricing pages only. Anything the fetched page did not state is marked **unverified**; pricing changes, re-check before committing.

## Recommendation

**Knock.** It is the only candidate where every criterion was confirmed from first-party docs: the in-app feed (prebuilt and headless) is on the free plan, there are explicit read/seen/archive operations, signed-JWT user auth, an idempotent server trigger API, and email/push/SMS/chat channels in the same workflow model. **Runner-up: Novu** (open source, HMAC auth, headless hooks, cheaper paid entry), but its free tier lists activity-feed retention of only 24 hours; verify inbox message retention before choosing it. Courier and MagicBell are viable but weaker on free-tier volume or headless documentation; OneSignal is a poor fit (no web inbox).

Trade-offs of Knock: free plan keeps Knock branding; paid jump is $250/month; the feed is a Knock-hosted service (recipient data leaves Cadence); free plan caps 10,000 messages/month.

## Comparison

| Criterion | Knock | Novu | Courier | MagicBell | OneSignal | SuprSend |
|---|---|---|---|---|---|---|
| Free tier | 10,000 messages/mo; feed + components + Feed API on Free; Knock branding not removable | 10,000 workflow runs/mo; 5 workflows, 3 team members; activity feed retention 24h | 10,000 sends/mo (in-app counts as a send) | 1,000 deliveries/mo, 1 project, unlimited users | Unlimited in-app for up to 1,000 MAU, but in-app messages are mobile-only | 10k notifications/mo, inbox included with SuprSend branding |
| First paid | Starter $250/mo (50k msgs) | Pro from $30/mo (30k runs) | $0.005/send pay-as-you-go | Startup $249/mo (50k deliveries) | Growth from $19/mo + usage | Essentials $100/mo |
| React SDK | `@knocklabs/react` | `@novu/react` (React 18/19) | `@trycourier/courier-react` v9 | `@magicbell/react` | none for web inbox found | `@suprsend/react` |
| Prebuilt UI | `NotificationIconButton`, `NotificationFeedPopover`, `NotificationFeed` | `Inbox` component | Inbox component with `CourierInboxTheme` | `FloatingInbox` | n/a | drop-in components |
| Headless | Yes (hooks, `FeedClient`) | Yes (`NovuProvider`, `useNotifications`, `useCounts`) | Custom views and low-level APIs (not called "headless") | Not mentioned on pages read (unverified) | n/a | Yes (documented as an option) |
| Recipient id / auth | Your user id; optional enhanced security: RS256 signed `userToken` JWT minted on server | `subscriberId`; optional HMAC-SHA256 `subscriberHash` of the id | Your `user_id`; server-minted JWT with scopes, passed to `signIn` | User token (JWT or HMAC) passed to `Provider` | n/a | Signed JWT user tokens |
| Read/unread/archive | seen, read, archived (and unarchive) on `FeedClient`; unread badge option | `read`, `archive` on client; unread counts | Read, unread count, archive; synced across devices | "Mark all as read"; archive not mentioned on pages read (unverified) | n/a | unverified |
| Server trigger | `POST /v1/workflows/{key}/trigger`, recipients by id, async (`workflow_run_id`), `Idempotency-Key` header (24h), up to 1,000 recipients | `POST /v1/events/trigger`, `Authorization: ApiKey`, `to` up to 100, `transactionId`; `Idempotency-Key` only for orgs enabled by support | `POST https://api.courier.com/send`, Bearer key, `routing.channels: ["inbox"]`, `Idempotency-Key` header | REST API exists; details not verified | dashboard-created in-app messages; not creatable via API | unverified |
| Later email/push | Email, push, SMS, chat (Slack, Teams, Discord) channels | In-app, email, SMS, push, chat; 60+ providers | Multi-channel; inbox is one routing channel | Email, push, etc. (all integrations on free tier) | Strong push/email, weak inbox | unverified |
| Open source | No | Yes (MIT core, commercial `/enterprise` folder), self-hostable | No | No | No | No |

## Provider notes and sources

### Knock
- Pricing: Free $0 with 10,000 messages/mo; feeds per recipient unlimited on all plans; prebuilt and custom feed components and Feed API available on Free; branding removal only on Starter ($250/mo). <https://knock.app/pricing>
- Prebuilt feed: `KnockProvider` + `KnockFeedProvider`, `NotificationIconButton`, `NotificationFeedPopover`, `NotificationFeed`; `renderItem`, CSS variables, `badgeCountType="unread"`, dark mode, i18n. <https://docs.knock.app/in-app-ui/react/feed>
- Headless: guide says hooks and client let you build fully custom UI; headless code must mark items seen itself or the unseen count never clears. `FeedClient.markAsArchived` / `markAsUnarchived` exist; archived items are excluded from the feed by default. <https://docs.knock.app/in-app-ui/react/headless/feed>, <https://docs.knock.app/in-app-ui/javascript/sdk/feed-client>, <https://docs.knock.app/in-app-ui/api-overview>
- Auth: without enhanced security mode a public key can act as any user; enable it and pass an RS256 signed user token (`sub`, `exp`, `iat`), default expiry 3600s, signed server-side with `signUserToken` from `@knocklabs/node`. <https://docs.knock.app/in-app-ui/security-and-authentication>
- Trigger: `POST /v1/workflows/{key}/trigger`, async, returns `workflow_run_id`; inline identification of actor/recipient. <https://docs.knock.app/api-reference/workflows/trigger>. Idempotency header and limits (10MB data, 1,000 recipients): <https://docs.knock.app/send-notifications/triggering-workflows/api>
- Channels: email, push, SMS, chat, in-app feeds. <https://docs.knock.app/concepts/channels>
- Not confirmed from docs read: SSR specifics (the SDK is client-side; assume the feed mounts client-only in React Router and the server only mints the token and triggers workflows).

### Novu
- Pricing: Free 10,000 runs/mo, 5 workflows, 2 environments, 3 team members, activity feed retention 24h (Pro 7 days, Team 90 days); Pro from $30/mo, Team from $250/mo. <https://novu.co/pricing>
- Inbox: `Inbox` component, `appearance` prop for theming, `routerPush` can be wired to React Router `navigate`; React 18/19. <https://docs.novu.co/platform/inbox/react/get-started>
- Headless: `useNotifications`, `useCounts`, `novu.notifications.read/archive`, real-time events. <https://docs.novu.co/platform/inbox/headless/get-started>
- Auth: HMAC-SHA256 of `subscriberId` with the secret key, passed as `subscriberHash`; if HMAC is enabled and the hash is missing the Inbox will not load. <https://docs.novu.co/platform/inbox/prepare-for-production>
- Trigger: `POST /v1/events/trigger`, `ApiKey` auth; `transactionId` dedup is not reliable under concurrency; `Idempotency-Key` header requires contacting support. <https://docs.novu.co/api-reference/events/trigger-event>
- Open source and self-hostable; core MIT with commercial enterprise folder. <https://docs.novu.co/platform/overview>, <https://github.com/novuhq/novu>

### Courier
- Pricing: Developer plan free, 10,000 sends/mo; Business $0.005/send, and once a card is added every send is charged including the first 10,000; in-app counts as a send. <https://www.courier.com/pricing>
- Inbox: `@trycourier/courier-react` v9; theme, custom views, or low-level APIs; unread counts, read/archive, cross-device sync. <https://www.courier.com/docs/platform/inbox/inbox-overview>
- Auth: backend mints a JWT via the Issue Token endpoint with scopes (`user_id:<id>`, `inbox:read:messages`, `inbox:write:events`); SDK does not refresh tokens, so the app must re-mint before `exp`. <https://www.courier.com/docs/platform/inbox/authentication>
- Send: `POST https://api.courier.com/send`, Bearer key, `to.user_id`, `routing.channels: ["inbox"]`, `Idempotency-Key`. <https://www.courier.com/docs/api-reference/send/send-a-message>

### MagicBell
- Pricing: Builder free, 1,000 deliveries/mo; Startup $249/mo, 50,000 deliveries; each channel delivery counts separately (in-app to 100 users = 100). <https://www.magicbell.com/pricing>
- React: `@magicbell/react` (`Provider`, `FloatingInbox`), CSS-variable styling, component replacement, user JWT, "Mark all as read", WebSocket updates; no headless or archive mention on the page read. <https://www.magicbell.com/inbox>, <https://www.magicbell.com/docs>
- Smallest free tier of the group, tight for a course project.

### OneSignal
- Pricing: in-app messaging unlimited up to 1,000 MAU on free. <https://onesignal.com/pricing>
- Docs state in-app messages are only available for mobile apps with the mobile SDK, are created in the dashboard (not the API), and no inbox feed API is described. Not suitable for a web bell/inbox. <https://documentation.onesignal.com/docs/en/in-app-messages-setup>

### Other candidate: SuprSend
- Free 10k notifications/mo with inbox included (branded); Essentials $100/mo removes branding. <https://suprsend.com/pricing>
- `@suprsend/react` with drop-in and headless options; JWT user tokens replaced HMAC. <https://docs.suprsend.com/docs/inbox-react>
- Read/archive, trigger API and channels were not verified; a credible alternative worth a follow-up if Knock's branding or paid jump matters.

## Cadence fit notes

- React Router / SSR: all React SDKs are client components. Cadence server code (loaders/actions) should only trigger events with the secret key and mint the per-user token (Knock JWT, Courier JWT, or Novu HMAC hash); the feed mounts client-side. No provider documented a React Router specific guide in the pages read.
- Outage isolation: trigger calls are HTTP and (Knock) async; wrap them so a failure never blocks a Purchase or Refund Request decision. Idempotency headers (Knock, Courier) make retry safe.
- DevUI user switching: recipient ids are the Cadence user ids; the token or hash must be re-minted when the DevUI changes user.
- Personal data: Knock and Novu accept a bare user id as recipient; sending name/email is optional.

## Open questions

- Knock free-plan message counting per recipient and in-app message retention were not confirmed.
- Novu inbox message retention versus the 24h activity-feed retention on Free.
- MagicBell API, headless and archive; SuprSend archive and trigger API.
