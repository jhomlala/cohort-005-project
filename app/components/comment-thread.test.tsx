import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { CommentThread } from "./comment-thread";

function renderInRouter(element: React.ReactElement) {
  const router = createMemoryRouter([{ path: "/", element }], {
    initialEntries: ["/"],
  });
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

const thread = {
  comments: [],
  currentUserId: 1,
  canModerate: false,
  canPost: true,
  instructorName: "Sarah Chen",
};

describe("CommentThread notes slot", () => {
  it("renders the notes above the discussion, inside the same card", () => {
    const html = renderInRouter(
      <CommentThread {...thread} notes={<p>My private note</p>} />
    );

    const notesAt = html.indexOf("My private note");
    const discussionAt = html.indexOf("Questions &amp; Discussion");
    expect(notesAt).toBeGreaterThan(-1);
    expect(discussionAt).toBeGreaterThan(notesAt);
    expect(html.match(/data-slot="card"/g)).toHaveLength(1);
  });

  it("renders no notes section when no notes are passed", () => {
    const html = renderInRouter(<CommentThread {...thread} />);

    expect(html).toContain("Questions &amp; Discussion");
    expect(html).not.toContain("My private note");
  });
});
