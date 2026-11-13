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
      detail: "Waiting for our team to decide.",
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

  it("says the money is back, and access has ended, once Issued", () => {
    expect(
      describeRefundState({ request: "approved", refund: "issued" })
    ).toEqual({
      label: "Refund Issued",
      detail: "Your money has been returned and your access has ended.",
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

  it("says a declined request is final", () => {
    expect(describeRefundState({ request: "declined", refund: null })).toEqual({
      label: "Refund Request Declined",
      detail: "We could not approve this refund request.",
    });
  });
});

describe("refundIneligibleMessage", () => {
  it("explains every reason in the learner's terms", () => {
    expect(refundIneligibleMessage("window-closed")).toBe(
      "The 14-day refund window has closed."
    );
    expect(refundIneligibleMessage("already-requested")).toBe(
      "You have already made a refund request for this purchase."
    );
    expect(refundIneligibleMessage("team-seat-claimed")).toBe(
      "A claimed team seat cannot be refunded."
    );
    expect(refundIneligibleMessage("watched-too-much")).toBe(
      "You have watched too much of this course to get a refund."
    );
    expect(refundIneligibleMessage("completed-too-much")).toBe(
      "You have completed too much of this course to get a refund."
    );
    expect(refundIneligibleMessage("not-purchased")).toBe(
      "You have not bought this course."
    );
  });
});

describe("refund emails", () => {
  const input = {
    learnerName: "Ada",
    courseTitle: "TypeScript Basics",
    amount: 4900,
  };

  it("confirms the request and says a decision comes first", () => {
    const email = refundRequestedEmail(input);

    expect(email.subject).toBe("Refund request received — TypeScript Basics");
    expect(email.body).toContain('We have your refund request for "TypeScript Basics".');
    expect(email.body).toContain("$49.00");
    expect(email.body).toContain("We will email you when we have decided");
  });

  it("tells the learner an approved request means the money is on its way", () => {
    const email = refundDecisionEmail("approved", input);

    expect(email.subject).toBe("Refund approved — TypeScript Basics");
    expect(email.body).toContain("We will email you again once your money has been returned");
  });

  it("tells the learner their access has ended once the refund is issued", () => {
    const email = refundDecisionEmail("issued", input);

    expect(email.subject).toBe("Refund issued — TypeScript Basics");
    expect(email.body).toContain("$49.00");
    expect(email.body).toContain("your access to the course has ended");
  });

  it("tells the learner a decline is final", () => {
    const email = refundDecisionEmail("declined", input);

    expect(email.subject).toBe("Refund request declined — TypeScript Basics");
    expect(email.body).toContain("This decision is final");
  });
});
