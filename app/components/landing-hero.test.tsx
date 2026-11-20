import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { LandingHero, LandingStats } from "./landing-hero";

function renderInRouter(element: React.ReactElement) {
  const router = createMemoryRouter([{ path: "/", element }], {
    initialEntries: ["/"],
  });
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

describe("LandingHero", () => {
  it("left-aligns the headline, lede and call to action", () => {
    const html = renderInRouter(<LandingHero />);

    expect(html).toContain("Learn to code,");
    expect(html).toContain("Browse Courses");
    expect(html).not.toContain("text-center");
    // The button's own classes centre its label, so check the row wrapper.
    expect(html).toContain("mt-10 flex items-center gap-4");
  });
});

describe("LandingStats", () => {
  it("left-aligns the stats strip and shows the counts it was given", () => {
    const html = renderInRouter(
      <LandingStats totalCourses={4} totalCategories={5} />
    );

    expect(html).toContain(">4<");
    expect(html).toContain(">5<");
    expect(html).toContain("Self-paced");
    expect(html).not.toContain("text-center");
    expect(html).not.toContain("mx-auto mb-3");
  });
});
