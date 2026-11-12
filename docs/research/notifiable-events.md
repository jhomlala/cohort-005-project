# Notifiable events in Cadence

Research for issue #2 (map #1). A candidate catalogue, not a decision: which events already happen in the app that concern a person and could become a **Notification** (GLOSSARY.md). Terms follow GLOSSARY.md.

Source: local `main` at `d3b8ce6`, plus the untracked `app/lib/refund-copy.ts`. All paths are relative to the repo root. Code read only, no code changed.

## How to read this

- **Fires today**: the code path runs when the user acts, so a Notification could be triggered from it now.
- **Email today**: the only person-facing messaging that exists is Postmark/outbox email (`app/lib/mailer.server.ts`), sent from two routes (see "What already messages people").
- **Schema only**: the data model can represent the event, but no code path creates it.
- **Not recorded**: the app has no event or row for it, so it would need new code.

## Catalogue

### Refund Requests (the starting hint)

| # | Event | Concerns | Where (file) | Status | Candidate message |
|---|---|---|---|---|---|
| R1 | Refund Request raised (Open) | Buyer (Student or Team Admin) | `app/lib/refunds.server.ts` `raiseRefundRequest`, called from `app/routes/courses.$slug.refund.ts` action | Fires today, plus email | "We have your Refund Request for {course}. A Platform Admin will decide it." |
| R2 | Refund Request raised (Open) | Platform Admin | same as R1 | Fires today, nobody told. Admins find it by opening `app/routes/admin.refunds.tsx` | "{buyer} asked for a refund on {course} ({amount})." |
| R3 | Refund Request approved (Approved Refund Request) | Buyer | `approveRefundRequest` in `app/lib/refunds.server.ts`, called from `app/routes/admin.refunds.tsx` action | Fires today, plus email (`buildDecisionEmail`) | "Your Refund Request for {course} was approved. We are returning {amount}." |
| R4 | Refund Request declined (Declined Refund Request) | Buyer | `declineRefundRequest` in `app/lib/refunds.server.ts`, called from `app/routes/admin.refunds.tsx` | Fires today, plus email. The decline note is required, so the message can carry it | "Your Refund Request for {course} was declined: {note}. You can raise a new one." |
| R5 | Individual Purchase approved, so the Enrollment ends | Buyer (now Lapsed if they have progress) | `approveRefundRequest`, the `tx.delete(enrollments)` branch (skipped when the buyer also holds a Claimed Seat, ADR 0004) | Fires today. No separate message, though the email does not mention access ending | "Your access to {course} has ended. Your progress is kept." |
| R6 | Team Licence approved, so Unclaimed Seats are refunded | Team Admin (buyer) | `approveRefundRequest`, the `coupons.refundedAt` update branch | Fires today. Only the buyer's R3 message goes out | "The {n} unclaimed Seats on {course} can no longer be claimed." |
| R7 | Someone opens a Seat link that is on hold or refunded | Student trying to claim | `getSeatAvailability` in `app/lib/refunds.server.ts`, used by `app/routes/redeem.$code.tsx` | Fires today only as an inline error on the page, not as a message. Weak candidate | "This Seat is on hold while its Team Licence has an Open Refund Request." |
| R8 | Refund Issued (money confirmed sent) | Buyer | No code. `app/lib/refund-copy.ts` `refundDecisionEmail("issued")` and `describeRefundState` draft the wording | Schema only, and not even that: `app/db/schema.ts` `refunds` has no Pending, Issued or Failed state, only the request status. The untracked `drizzle/0010_aromatic_darkhawk.sql` and `0011_kind_ma_gnuci.sql` sketch a separate `refunds` table with `pending` status and `issued_at`, but they are not in `drizzle/meta/_journal.json` | "We have returned {amount} for {course}." |
| R9 | Refund Failed | Buyer, Platform Admin | None. `describeRefundState` has copy for it, nothing in code or schema | Not recorded | "We could not return your money yet. We will try again." |

Notes:

- `app/lib/refund-copy.ts` is untracked and not imported by any route or test of a route. Only `refund-copy.test.ts` imports it. The live emails are built inline in `refunds.server.ts` (`raiseRefundRequest`, `buildDecisionEmail`), so the wording exists twice.
- A Team Admin has no say over Refund Requests (GLOSSARY.md), but is the buyer for Team Licence refunds (`courses.$slug.refund.ts` redirects to `/team` for those), so R1, R3 and R4 concern them too.

### Purchases, Enrollments and Seats

| # | Event | Concerns | Where (file) | Status | Candidate message |
|---|---|---|---|---|---|
| P1 | Individual Purchase made | Student (buyer) | `app/routes/courses.$slug.purchase.tsx` `action` -> `createPurchase`, `enrollUser` | Fires today. `enrollUser` has a stub `if (sendEmail) { // Would send welcome email here }` that is never enabled (called with `false`) | "You bought {course} for {amount}. Start watching." |
| P2 | Individual Purchase made | Instructor of the course | same as P1 (`courses.instructorId`) | Fires today, nobody told | "{student} bought {course}." |
| P3 | Enrollment created from a purchase | Student | `enrollUser` in `courses.$slug.purchase.tsx` | Fires today (same moment as P1) | "You are enrolled in {course}." |
| P4 | Team Licence purchased | Team Admin | `createTeamPurchase` in `courses.$slug.purchase.tsx` (`generateCoupons` creates the Seats) | Fires today, nobody told | "Your Team Licence for {course} is ready: {n} Seats to share." |
| P5 | Team Licence purchased | Instructor | same as P4 | Fires today, nobody told | "{n} Seats on {course} were bought as a Team Licence." |
| P6 | Seat claimed, so an Enrollment is created | Student (claimer) | `redeemCoupon` in `app/routes/redeem.$code.tsx` (`coupons.redeemedAt`, `enrollments` insert) | Fires today, nobody told | "You claimed a Seat and are enrolled in {course}." |
| P7 | Seat claimed | Team Admin | same as P6 (`coupons.teamId`, `teamMembers` role admin) | Fires today, nobody told. Visible on `app/routes/team.tsx` | "{student} claimed a Seat on {course}. {x} of {n} Seats claimed." |
| P8 | Seat claimed, so the Team Licence can no longer be refunded | Team Admin | same as P6; rule in `findRuleBreaks` (`seat_claimed`) in `refunds.server.ts` | Fires today, as a derived state | "A Seat was claimed, so this Team Licence can no longer be refunded." |
| P9 | Enrollment lost, student is now Lapsed | Student, Instructor | Only cause today is R5. `isLapsed` in `app/lib/enrollments.ts`; roster in `app/routes/instructor.$courseId.students.tsx` `getCourseLapsedStudents` | Derived at read time, never stored. Fires only via R5 | Student: "Your access to {course} ended." Instructor: "{student} has lapsed on {course}." |
| P10 | Course completed (`enrollments.completedAt`) | Student, Instructor | Column exists in `app/db/schema.ts`; nothing in `app/` writes it (no `update(enrollments)`). Per-lesson completion is written in `app/routes/courses.$slug.lessons.$lessonId.tsx` (`lessonProgress`, around lines 223-261) | Schema only for course completion. Lesson completion fires | "You finished {course}." / "{student} finished {course}." |

### Learning: quizzes, comments, ratings

| # | Event | Concerns | Where (file) | Status | Candidate message |
|---|---|---|---|---|---|
| Q1 | Quiz attempt scored (`passed` is score above 0.7) | Student | `app/routes/courses.$slug.lessons.$lessonId.tsx`, quiz scoring around line 599, inserts `quizAttempts` | Fires today. Result is already shown on the page, so a Notification adds little | "You passed the quiz in {lesson}." |
| Q2 | Student passes or fails a quiz | Instructor | same as Q1 | Fires today, nobody told. Likely noise at volume | "{student} passed {quiz}." |
| C1 | Student posts a question or comment on a lesson | Instructor of the course | `createComment` in `courses.$slug.lessons.$lessonId.tsx` (action intent `create-comment`, around line 903) | Fires today. The instructor only sees it on `app/routes/instructor.questions.tsx` (Unanswered Questions) | "{student} asked a question on {lesson}." |
| C2 | Instructor (or admin) replies to a question | Student who asked | `createComment` with `parentId` in `app/routes/instructor.questions.tsx` `action` (around line 211) | Fires today, nobody told | "{instructor} answered your question on {lesson}." |
| C3 | Reply posted by someone else under a comment | Parent comment author | `createComment` in `courses.$slug.lessons.$lessonId.tsx` (`parentId` set; replies are one level deep) | Fires today, nobody told | "{name} replied to your comment on {lesson}." |
| C4 | Question unanswered for 3 days | Instructor | `STALE_AFTER_DAYS = 3` in `instructor.questions.tsx` (visual call-out only) | Derived at read time. A Notification would need a scheduled job, which the app does not have | "A question on {lesson} has waited 3 days." |
| G1 | Student rates a course | Instructor | `app/routes/courses.$slug.tsx` rating upsert (`courseRatings`, around lines 351-359) | Fires today, nobody told | "{student} rated {course} {n} stars." |

### Staff and content (lower priority, mostly Instructor and Platform Admin)

| # | Event | Concerns | Where (file) | Status | Candidate message |
|---|---|---|---|---|---|
| S1 | Course status changed (Draft, Published, Archived) | Instructor (by a Platform Admin) | `updateCourseStatus` in `app/routes/admin.courses.tsx` action (the instructor can also change it in `app/routes/instructor.$courseId.tsx`) | Fires today, nobody told | "{course} was set to {status} by a Platform Admin." |
| S2 | Course status changed to Archived or Draft | Enrolled Students | same as S1 | Fires today, nobody told | "{course} is no longer published." |
| S3 | User role changed | The user | `updateUserRole` in `app/routes/admin.users.tsx` action | Fires today, nobody told | "Your role is now {role}." |
| S4 | New signup | Platform Admin | `app/routes/signup.tsx` (`users` insert) | Fires today, nobody told. Probably noise | "{name} joined Cadence." |

## What already messages people today

Only email, and only for Refund Requests:

- `app/routes/courses.$slug.refund.ts` calls `sendEmail(result.email)` after `raiseRefundRequest` (R1).
- `app/routes/admin.refunds.tsx` calls `sendEmail(result.email)` after approve or decline (R3, R4).
- `app/lib/mailer.server.ts` sends via Postmark when `POSTMARK_SERVER_TOKEN` is set, otherwise writes JSON into `.outbox/`. A failed Postmark call throws, and both routes `await` it after the database write has committed, so a send failure surfaces as an error to the user even though the decision is saved. A Notification provider call placed in the same spot would inherit that behaviour (relevant to map #1 "failures behave").

Everything else in the catalogue happens silently. The in-app "message" is whatever the page shows on next load (Settings for the buyer's Refund Requests, `/team`, the instructor roster and Unanswered Questions).

## Observations for later tickets (not decisions)

1. Natural hook points are the same places `sendEmail` is called: one place per Refund Request outcome. Other events happen inside route-level helper functions (`createPurchase`, `redeemCoupon`, `createComment`) that are not shared modules, so a trigger would have to be added in each route.
2. Recipients are `users.id` rows (`app/db/schema.ts` `users`); roles are `UserRole` Student, Instructor, Admin (Admin is the glossary's Platform Admin). A Team Admin is not a role: it is `teamMembers.role = admin` (`TeamMemberRole`). Resolving "who is the Team Admin of this Seat" goes through `coupons.teamId`.
3. Every event above that involves a Refund Request already has the person's identity, course title and amount available at the call site (the email builders use them).
4. Events with no trigger point today (R8, R9, P10, C4) cannot be fired without new product work first. R8 and R9 depend on a Refund money-state model that the untracked migrations only sketch.
5. A few events are derived (P8, P9, C4) rather than written. A Notification for them needs an explicit trigger at the write that causes them (R5 for Lapsed), or a scheduled check.

## Out of scope

Provider choice, feed design, read/unread, preferences, testing. Those are other tickets under map #1.
