# Notifiable events in Cadence: candidate catalogue

Research for issue #2 (parent map #1). This is a **catalogue of candidates, not a decision**. Which events ship in v1 is for the catalogue ticket (#4) to pick.

Sources: this repo at commit `11e8b2e` (`app/routes`, `app/lib`, `app/db/schema.ts`). Every claim below is read directly from that code. Line numbers are approximate pointers into that commit.

## Caveats about the inputs

- **`GLOSSARY.md` does not exist** in this repo (only `.agents/skills/teach/GLOSSARY-FORMAT.md`). Role names below follow the code: `UserRole` = Student / Instructor / Admin (`schema.ts`), `TeamMemberRole` = Admin / Member. "Platform Admin" = `UserRole.Admin`; "Team Admin" = `TeamMemberRole.Admin`. "Notification Feed" has no code counterpart yet.
- **`app/lib/refund-copy.ts` does not exist**, and there is no `app/services`. The Refund Request flow lives in `app/routes/courses.$slug.refund.ts`. The code and UI call it "cancel" / "Reversal", while the schema says `refunds`.
- **No central domain layer.** Mutations are private helper functions inside route files (`db.insert(...)` in each route's `action`). There is no shared hook point for events, so each event below fires from a different route action.
- **Existing precedent for "notifying" a person:** the refund route builds a "Reversal requested" email and only `console.log`s it (`courses.$slug.refund.ts:88-112, 225-234`). It also promises "we will email you again when it is done" (line 107).

## Things the issue asks about that are NOT in the code today

| Topic | Finding |
| --- | --- |
| Refund Request **outcomes** (approved / declined) | Schema supports them (`RefundStatus.Approved/Declined`, `refunds.resolvedAt`, `resolvedByUserId`, `amountRefunded`), but **no route or function ever resolves a refund**. Only `Requested` is ever written (`refund.ts:216-223`). `settings.tsx:60-73` lists open requests. So these events are schema-ready but have no firing point yet. |
| **Lapsed** enrollments | No such concept. grep for "lapse" finds only time-ago helpers in `utils.ts`. `enrollments` has no expiry/status column. |
| Enrollment **completion** | `enrollments.completedAt` is read (dashboard, instructor students list) but **never written** anywhere in `app/`. Course completion has no firing point. |
| Seat **released / revoked** | A claimed seat cannot be cancelled (`refund.ts:150-162`); no revoke or reassign code exists. |

## Candidate catalogue

Recipient key: S = Student, I = Instructor, PA = Platform Admin, TA = Team Admin. "Exists" = a code path fires today; "Schema-only" = data model supports it but nothing fires it.

### Purchases and Enrollments

| # | Event | Concerns | Where it happens | Candidate message | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Individual Purchase + Enrollment created | S (buyer) | `courses.$slug.purchase.tsx` action `confirm-purchase`: `createPurchase` (l.180) + `enrollUser` (l.145; has a dead `sendEmail` flag and "Would send welcome email here" stub) | "You're enrolled in {course}. Start learning." | Exists |
| 2 | New student enrolled in my course | I (course owner) | same action; owner = `courses.instructorId` | "{student} enrolled in {course}." | Exists |
| 3 | Sale recorded | I (owner) | same action (`purchases.amountPaid`, PPP-adjusted) | "{course} sold for {amount} ({country})." | Exists |
| 4 | Coupon redeemed, student enrolled | S (redeemer) | `redeem.$code.tsx` `redeemCoupon`: updates `coupons`, inserts `enrollments` | "Your seat for {course} is active." | Exists |
| 5 | Student enrolled via team seat | I (owner) | same, `redeemCoupon` | "{student} joined {course} through a team licence." | Exists |

### Team Licences and Seats

| # | Event | Concerns | Where it happens | Candidate message | Status |
| --- | --- | --- | --- | --- | --- |
| 6 | Team Licence purchased, seats generated | TA (buyer, auto-created team admin) | `purchase.tsx` action team intent: `createTeamPurchase` (l.245) -> `getOrCreateTeamForUser`, `generateCoupons` (l.222) | "{n} seats for {course} are ready. Share the codes." | Exists |
| 7 | A team seat was claimed | TA | `redeem.$code.tsx` `redeemCoupon`; team found via `coupons.teamId` | "{redeemer email} claimed a seat for {course} ({claimed}/{total})." | Exists |
| 8 | All seats for a course claimed | TA | derived from the same event; `team.tsx:100-125` already computes total vs claimed | "All {n} seats for {course} are claimed. Buy more?" | Derived |
| 9 | Seat redemption failed (already redeemed / country mismatch / already enrolled) | S (redeemer) | `redeemCoupon` error returns; currently shown as a toast only | "We couldn't redeem that code: {reason}." | Exists (as UI error; arguably not a Notification) |
| 10 | Team Licence sale | I (owner) | team intent in `purchase.tsx` action | "{n} team seats for {course} sold." | Exists |

### Refund Requests

| # | Event | Concerns | Where it happens | Candidate message | Status |
| --- | --- | --- | --- | --- | --- |
| 11 | Refund Request filed | S (requester) | `refund.ts` action, after `insert(refunds)` (l.215); existing email stub is the precedent | "We've received your refund request for {course}. We'll let you know once it's reviewed." | Exists |
| 12 | Refund Request awaiting review | PA | same insert; no admin queue or route exists today | "{student} requested a refund of {amount} for {course}." | Exists (no admin UI yet) |
| 13 | Refund Request filed on my course | I (owner) | same insert (FYI only; the code gives instructors no role in resolving) | "A student requested a refund on {course}." | Exists, low value |
| 14 | Refund approved | S | **no firing point**; fields `status=approved`, `amountRefunded`, `resolvedAt`, `resolvedByUserId` | "Your refund of {amount} for {course} was approved." | Schema-only |
| 15 | Refund declined | S | **no firing point**; `status=declined`, `resolvedAt` | "Your refund request for {course} was declined." | Schema-only |

Refund rules that shape what a Notification can say (`refund.ts`): 14-calendar-day window (l.22), max 2 h watched (l.23), claimed team seats cannot be refunded (l.160), one open request per purchase (l.144). Rejected attempts surface only as HTTP 403/409 errors, with no persisted record, so there is nothing to notify on.

Note: `courses.$slug.tsx` (l.~372-420) has its own cancel-eligibility constants (`CANCEL_COMPLETION_LIMIT = 0.5`) that differ from `refund.ts`; the two copies of the rules could drift. This is worth knowing if eligibility ever becomes a Notification.

### Learning activity (Student-facing)

| # | Event | Concerns | Where it happens | Candidate message | Status |
| --- | --- | --- | --- | --- | --- |
| 16 | Quiz passed | S | `courses.$slug.lessons.$lessonId.tsx` `submit-quiz` (l.952, insert `quizAttempts` ~l.603; `passed = score > 0.7`) | "You passed {quiz} with {pct}%." | Exists |
| 17 | Quiz failed | S | same | "You scored {pct}% on {quiz}. Review and try again." | Exists |
| 18 | Student passed/failed a quiz | I (owner) | same | "{student} passed {quiz} in {course}." | Exists, high volume |
| 19 | Lesson completed | S | `markLessonComplete` (l.218), `mark-complete` intent (l.947) | "Lesson {title} complete." | Exists, likely noise |
| 20 | Course completed (all lessons) | S, I | **not detected anywhere**; `enrollments.completedAt` is never set | "You finished {course}." / "{student} finished {course}." | Schema-only |

### Questions and comments

| # | Event | Concerns | Where it happens | Candidate message | Status |
| --- | --- | --- | --- | --- | --- |
| 21 | Student posts a lesson comment/question | I (owner) | `lessons.$lessonId.tsx` `createComment` (l.404) via `create-comment` (l.898). Top-level (`parentId = null`) comments are what `instructor.questions.tsx` treats as questions | "{student} asked a question on {lesson}." | Exists |
| 22 | Instructor answers a question (reply) | S (author of parent comment) | `instructor.questions.tsx` action (l.188) -> `createComment`; also replies via the lesson page | "{instructor} replied to your question on {lesson}." | Exists |
| 23 | Reply to my comment by another student | S (parent author) | `lessons.$lessonId.tsx` `createComment` with `parentId` set (replies are one level deep) | "{name} replied to your comment." | Exists |
| 24 | Question unanswered for 3+ days | I (owner), maybe PA | **no event**; `instructor.questions.tsx` has `STALE_AFTER_DAYS = 3` as a display rule only, so this would need a scheduled job | "A question on {lesson} has waited {n} days." | Derived (needs a scheduler) |
| 25 | My comment deleted by staff | S (author) | `deleteComment` (l.459, `isStaff`), soft delete via `deletedAt` | "A moderator removed your comment." | Exists |

### Ratings

| # | Event | Concerns | Where it happens | Candidate message | Status |
| --- | --- | --- | --- | --- | --- |
| 26 | Course rated / rating changed | I (owner) | `courses.$slug.tsx` `rateCourse` (l.335): insert or update `courseRatings` | "{student} rated {course} {n} stars." | Exists |

### Course lifecycle and administration

| # | Event | Concerns | Where it happens | Candidate message | Status |
| --- | --- | --- | --- | --- | --- |
| 27 | Course published / archived / unpublished by instructor | S (enrolled; archive matters most), PA | `instructor.$courseId.tsx` `update-status` (l.154, l.695) | "{course} has been archived." (whether enrollees keep access is not verified here; see open questions) | Exists |
| 28 | Course status changed by Platform Admin | I (owner) | `admin.courses.tsx` `update-status` (l.76, l.141) | "A platform admin set {course} to {status}." | Exists |
| 29 | Lessons added/removed/moved in a course I'm enrolled in | S (enrolled) | `instructor.$courseId.tsx` `add-lesson` (l.753), `delete-lesson` (l.827), `move-lesson` | "New lesson in {course}: {title}." (the "new content" use case also named in `_internal/feature-ideas.md` #29) | Exists |
| 30 | Course price changed | I (owner), PA | `update-price` (l.176, l.700) | Probably not student-facing; low value | Exists, low value |
| 31 | Quiz created/updated/deleted on a lesson | S (enrolled) | `instructor.$courseId.lessons.$lessonId.quiz.tsx` `save-quiz` (l.386), `delete-quiz` (l.425) | "A quiz was added to {lesson}." | Exists, low value |
| 32 | Role changed | S/I/PA (the user) | `admin.users.tsx` `update-role` (l.60, l.126) | "Your role is now {role}." | Exists |
| 33 | Profile changed by Platform Admin | any user | `admin.users.tsx` `update-user` (l.119) | "An admin updated your profile." | Exists, low value |
| 34 | New user signed up | PA | `signup.tsx` (l.78 `insert(users)`) | "{name} joined as a student." | Exists, noise at scale |
| 35 | New course drafted | PA | `instructor.new.tsx` (l.60) | "{instructor} created {course} (draft)." | Exists, low value |

### Existing signals worth noting but not events

- `api.video-tracking.ts` inserts `videoWatchEvents`: telemetry only, not notifiable. Its sum feeds refund eligibility.
- `settings.tsx` lists the student's open refund requests (`status = Requested`); a Notification Feed would complement it.
- Recipient identity everywhere is `users.id` (integer, autoincrement), with `email` as unique key. `UserRole` is a single column, so one person has one platform role, but a person can also be a Team Admin via `team_members`.

## Observations for downstream tickets (not decisions)

1. **The strongest candidates are those with an existing firing point and an unambiguous single recipient:** #1, #4, #6, #7, #11, #12, #16/#17, #22, #26. #11 already has an email-shaped stub to copy.
2. **#14/#15 (refund outcomes) are the natural story but cannot fire today**: building them requires a resolution flow (admin route) that does not exist. The map names the Refund Request flow as a starting hint, so this gap is relevant to scoping.
3. **Instructor-facing events are higher volume** (#2, #3, #18, #21, #26) and likely need grouping or preferences.
4. **Student-visible archiving/content-change events (#27, #29) concern many recipients at once** (every enrollee of the course); this implies fan-out, which differs from the 1:1 events.
5. **Derived/time-based events (#8, #24, and any "lapsed enrollment") need a scheduler or an on-write check**; the app has none. "Lapsed" does not exist as a concept, so it would first need to be defined.
6. **Recipient mapping needs a lookup in several cases**: course owner (`courses.instructorId`), team admins (`team_members` with role admin via `coupons.teamId`), parent-comment author (`comments.parentId` -> `userId`), enrollees (`enrollments.courseId`), Platform Admins (`users.role = admin`).
7. **Writes are synchronous** (`.run()/.get()` inside actions), so a provider call added beside them must not throw into the action; relevant to the map's "provider outage must not break a Purchase" question.

## Open questions surfaced

- Does archiving a course keep access for existing enrollees? (Needed before message #27 can be written honestly.)
- Should a Team Admin who buys seats also be a Student of the course? Today a team purchase does **not** enrol the buyer (`purchase.tsx` comment "user does NOT get enrolled themselves").
- Where should "Platform Admin" refund review live, given no admin refunds route exists?
