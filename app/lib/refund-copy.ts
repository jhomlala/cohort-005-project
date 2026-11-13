import { formatPrice } from "~/lib/utils";
import { REFUND_WINDOW_DAYS, type RuleBreak } from "~/lib/refund-rules";
import type { Email, PurchaseKind } from "~/lib/refunds.server";

// Every word a learner reads about refunds lives here, and uses the terms in
// GLOSSARY.md: Refund Request (Open, Approved, Declined) and Refund (Pending,
// Issued, Failed). Pure functions, so the wording is tested without a server.
// Only types come from refunds.server, so nothing server-side is bundled.

export type RefundState = {
  request: "open" | "approved" | "declined";
  refund: "pending" | "issued" | "failed" | null;
};

/** What the learner sees on Settings for one Refund Request. */
export function describeRefundState(state: RefundState): {
  label: string;
  detail: string;
} {
  if (state.request === "open") {
    return {
      label: "Open Refund Request",
      detail: "Waiting for Cadence to decide.",
    };
  }

  if (state.request === "declined") {
    return {
      label: "Refund Request Declined",
      detail:
        "We could not approve this refund request. You can raise a new one.",
    };
  }

  switch (state.refund) {
    case "issued":
      return {
        label: "Refund Issued",
        detail: "Your money has been returned.",
      };
    case "failed":
      return {
        label: "Refund Failed",
        detail:
          "We could not return your money yet. We will try again; you do not need to ask twice.",
      };
    case "pending":
    case null:
      return {
        label: "Refund Pending",
        detail: "Approved. We are returning your money.",
      };
  }
}

/** Why a learner can't raise a Refund Request right now. */
export type RefundIneligibleReason =
  | RuleBreak
  | "open_request_exists"
  | "already_refunded";

const INELIGIBLE_MESSAGES: Record<RefundIneligibleReason, string> = {
  open_request_exists:
    "You already have an Open Refund Request for this purchase.",
  already_refunded: "This purchase has already been refunded.",
  seat_claimed: "A team licence with a claimed seat cannot be refunded.",
  window_closed: `The ${REFUND_WINDOW_DAYS}-day refund window has closed.`,
  watched_too_much:
    "You have watched too much of this course to get a refund.",
  completed_too_much:
    "You have completed too much of this course to get a refund.",
};

export function refundIneligibleMessage(reason: RefundIneligibleReason) {
  return INELIGIBLE_MESSAGES[reason];
}

type EmailInput = {
  learnerName: string;
  courseTitle: string;
  amount: number;
  kind: PurchaseKind;
};

type EmailCopy = Omit<Email, "to">;

function compose(
  input: EmailInput,
  subject: string,
  lines: string[]
): EmailCopy {
  return {
    subject: `${subject} — ${input.courseTitle}`,
    body: [`Hi ${input.learnerName},`, "", ...lines, "", "— The Cadence team"].join(
      "\n"
    ),
  };
}

// What the Purchase granted, and what happens to it while a request is open
// and once it is approved (GLOSSARY, ADR-0001, ADR-0003).
const WHILE_OPEN: Record<PurchaseKind, string> = {
  individual_purchase: "You keep your access to the course while we decide.",
  team_licence:
    "While we decide, your team's unclaimed seats cannot be claimed.",
};

const ON_APPROVAL: Record<PurchaseKind, string> = {
  individual_purchase:
    "Your access to the course has ended. Your progress is kept, so if you buy the course again you pick up where you left off.",
  team_licence:
    "Your team's unclaimed seats have been withdrawn and can no longer be claimed.",
};

/** Sent when the learner makes the request, before anyone has decided. */
export function refundRequestedEmail(input: EmailInput): EmailCopy {
  return compose(input, "Refund request received", [
    `We have your refund request for "${input.courseTitle}".`,
    `The refund would be for ${formatPrice(input.amount)}, the amount you paid.`,
    "",
    WHILE_OPEN[input.kind],
    "We review every refund request by hand. You do not need to do anything else. We will email you when we have decided.",
  ]);
}

export type RefundDecision =
  | { decision: "approved" }
  | { decision: "issued" }
  | { decision: "declined"; decisionNote: string };

/** Sent when a Platform Admin decides the request, and again when the money is back. */
export function refundDecisionEmail(
  outcome: RefundDecision,
  input: EmailInput
): EmailCopy {
  switch (outcome.decision) {
    case "approved":
      return compose(input, "Refund approved", [
        `Your refund request for "${input.courseTitle}" has been approved.`,
        `We are returning ${formatPrice(input.amount)}, the amount you paid.`,
        "",
        ON_APPROVAL[input.kind],
        "",
        "We will email you again once your money has been returned.",
      ]);
    case "issued":
      return compose(input, "Refund issued", [
        `We have returned ${formatPrice(input.amount)} for "${input.courseTitle}".`,
      ]);
    case "declined":
      return compose(input, "Refund request declined", [
        `We could not approve your refund request for "${input.courseTitle}".`,
        "",
        outcome.decisionNote,
        "",
        "Nothing you bought has been taken away. You can raise a new refund request if your situation changes.",
      ]);
  }
}
