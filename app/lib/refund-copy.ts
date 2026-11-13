import { formatPrice } from "~/lib/utils";
import type { RefundIneligibleReason } from "~/lib/refunds.server";

// Every word a learner reads about refunds lives here, and uses the terms in
// GLOSSARY.md: Refund Request (Open, Approved, Declined) and Refund (Pending,
// Issued, Failed). Pure functions, so the wording is tested without a server.

export type RefundState = {
  request: "open" | "approved" | "declined";
  refund: "pending" | "issued" | "failed" | null;
};

/** What the learner sees on Settings for one refund request. */
export function describeRefundState(state: RefundState): {
  label: string;
  detail: string;
} {
  if (state.request === "open") {
    return {
      label: "Open Refund Request",
      detail: "Waiting for our team to decide.",
    };
  }

  if (state.request === "declined") {
    return {
      label: "Refund Request Declined",
      detail: "We could not approve this refund request.",
    };
  }

  switch (state.refund) {
    case "issued":
      return {
        label: "Refund Issued",
        detail: "Your money has been returned and your access has ended.",
      };
    case "failed":
      return {
        label: "Refund Failed",
        detail:
          "We could not return your money yet. We will try again; you do not need to ask twice.",
      };
    default:
      return {
        label: "Refund Pending",
        detail: "Approved. We are returning your money.",
      };
  }
}

const INELIGIBLE_MESSAGES: Record<RefundIneligibleReason, string> = {
  "not-purchased": "You have not bought this course.",
  "already-requested":
    "You have already made a refund request for this purchase.",
  "team-seat-claimed": "A claimed team seat cannot be refunded.",
  "window-closed": "The 14-day refund window has closed.",
  "watched-too-much":
    "You have watched too much of this course to get a refund.",
  "completed-too-much":
    "You have completed too much of this course to get a refund.",
};

export function refundIneligibleMessage(reason: RefundIneligibleReason) {
  return INELIGIBLE_MESSAGES[reason];
}

type EmailInput = {
  learnerName: string;
  courseTitle: string;
  amount: number;
};

type Email = { subject: string; body: string };

function compose(input: EmailInput, subject: string, lines: string[]): Email {
  return {
    subject: `${subject} — ${input.courseTitle}`,
    body: [`Hi ${input.learnerName},`, "", ...lines, "", "— The Cadence team"].join(
      "\n"
    ),
  };
}

/** Sent when the learner makes the request, before anyone has decided. */
export function refundRequestedEmail(input: EmailInput): Email {
  return compose(input, "Refund request received", [
    `We have your refund request for "${input.courseTitle}".`,
    `The refund would be for ${formatPrice(input.amount)}, the amount you paid.`,
    "",
    "Our team reviews every refund request by hand. You do not need to do anything else. We will email you when we have decided.",
  ]);
}

/** Sent when an admin decides the request, and again when the money is back. */
export function refundDecisionEmail(
  decision: "approved" | "declined" | "issued",
  input: EmailInput
): Email {
  switch (decision) {
    case "approved":
      return compose(input, "Refund approved", [
        `Your refund request for "${input.courseTitle}" has been approved.`,
        `We are returning ${formatPrice(input.amount)}, the amount you paid.`,
        "",
        "We will email you again once your money has been returned.",
      ]);
    case "issued":
      return compose(input, "Refund issued", [
        `We have returned ${formatPrice(input.amount)} for "${input.courseTitle}".`,
        "",
        "As part of the refund, your access to the course has ended.",
      ]);
    case "declined":
      return compose(input, "Refund request declined", [
        `We could not approve your refund request for "${input.courseTitle}".`,
        "",
        "This decision is final, and you keep your access to the course.",
      ]);
  }
}
