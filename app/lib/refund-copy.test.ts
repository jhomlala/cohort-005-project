import { describe, it, expect } from "vitest";
import {
  describeRefundState,
  refundDecisionEmail,
  refundIneligibleMessage,
  refundRequestedEmail,
} from "./refund-copy";

describe("describeRefundState", () => {
  it("calls an undecided request an Open Refund Request", () => {
    expect(describeRefundState({ request: "open", refund: null })).toEqual({
      label: "Open Refund Request",
      detail: "Waiting for Cadence to decide.",
    });
  });

  it("calls an approved request with unpaid money Refund Pending", () => {
    expect(
      describeRefundState({ request: "approved", refund: "pending" })
    ).toEqual({
      label: "Refund Pending",
      detail: "Approved. We are returning your money.",
    });
  });

  it("says the money is back once Issued", () => {
    expect(
      describeRefundState({ request: "approved", refund: "issued" })
    ).toEqual({
      label: "Refund Issued",
      detail: "Your money has been returned.",
    });
  });

  it("says a Failed refund is being retried, not that the request failed", () => {
    expect(
      describeRefundState({ request: "approved", refund: "failed" })
    ).toEqual({
      label: "Refund Failed",
      detail:
        "We could not return your money yet. We will try again; you do not need to ask twice.",
    });
  });

  it("says a declined request can be raised again", () => {
    expect(describeRefundState({ request: "declined", refund: null })).toEqual({
      label: "Refund Request Declined",
      detail:
        "We could not approve this refund request. You can raise a new one.",
    });
  });
});

describe("refundIneligibleMessage", () => {
  it("explains every reason in the learner's terms", () => {
    expect(refundIneligibleMessage("window_closed")).toBe(
      "The 14-day refund window has closed."
    );
    expect(refundIneligibleMessage("open_request_exists")).toBe(
      "You already have an Open Refund Request for this purchase."
    );
    expect(refundIneligibleMessage("already_refunded")).toBe(
      "This purchase has already been refunded."
    );
    expect(refundIneligibleMessage("seat_claimed")).toBe(
      "A team licence with a claimed seat cannot be refunded."
    );
    expect(refundIneligibleMessage("watched_too_much")).toBe(
      "You have watched too much of this course to get a refund."
    );
    expect(refundIneligibleMessage("completed_too_much")).toBe(
      "You have completed too much of this course to get a refund."
    );
  });
});

describe("refund emails", () => {
  const input = {
    learnerName: "Ada",
    courseTitle: "TypeScript Basics",
    amount: 4900,
    kind: "individual_purchase" as const,
  };
  const team = { ...input, kind: "team_licence" as const };

  it("confirms the request and says a decision comes first", () => {
    const email = refundRequestedEmail(input);

    expect(email.subject).toBe("Refund request received — TypeScript Basics");
    expect(email.body).toContain('We have your refund request for "TypeScript Basics".');
    expect(email.body).toContain("$49.00");
    expect(email.body).toContain("You keep your access to the course while we decide");
    expect(email.body).toContain("We will email you when we have decided");
  });

  it("warns a Team Admin that unclaimed seats are frozen while the request is open", () => {
    expect(refundRequestedEmail(team).body).toContain(
      "your team's unclaimed seats cannot be claimed"
    );
  });

  it("says approval ends access but keeps progress", () => {
    const email = refundDecisionEmail({ decision: "approved" }, input);

    expect(email.subject).toBe("Refund approved — TypeScript Basics");
    expect(email.body).toContain("Your access to the course has ended");
    expect(email.body).toContain("Your progress is kept");
    expect(email.body).toContain("We will email you again once your money has been returned");
  });

  it("says approval withdraws a Team Licence's unclaimed seats", () => {
    const email = refundDecisionEmail({ decision: "approved" }, team);

    expect(email.body).toContain("unclaimed seats have been withdrawn");
    expect(email.body).not.toContain("access to the course");
  });

  it("confirms the money is back once the refund is issued", () => {
    const email = refundDecisionEmail({ decision: "issued" }, input);

    expect(email.subject).toBe("Refund issued — TypeScript Basics");
    expect(email.body).toContain("$49.00");
  });

  it("passes on the decline note and says the learner can ask again", () => {
    const email = refundDecisionEmail(
      { decision: "declined", decisionNote: "You have finished the course." },
      input
    );

    expect(email.subject).toBe("Refund request declined — TypeScript Basics");
    expect(email.body).toContain("You have finished the course.");
    expect(email.body).toContain("You can raise a new refund request");
    expect(email.body).not.toContain("final");
  });
});
