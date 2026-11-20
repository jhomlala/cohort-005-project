// Fails when a commit adds an oxlint-disable comment with no reason.
// The reason follows `--`: `// oxlint-disable-next-line rule -- why`.
// Only added lines are checked, so the comments already in the repo stay as
// they are. A disable is a last resort: fix the code, or give the reason.
// Usage: node scripts/check-lint-disables.js <file>...

import { execFileSync } from "node:child_process";

// A directive starts a comment, so match only that form. Prose and regexes
// that mention the word are not directives.
const DISABLE = /(\/\/|\/\*)\s*oxlint-disable/;
const REASONED = /oxlint-disable\S*\s.*--\s*\S/;

// Walks a unified diff with -U0, so every hunk line is an added, removed, or
// header line, and tracks the new-file line number of each added line.
export const findUnreasoned = (diff) => {
  const found = [];
  let file = "";
  let line = 0;
  for (const text of diff.split("\n")) {
    if (text.startsWith("+++ ")) {
      file = text.slice(4).replace(/^b\//, "");
    } else if (text.startsWith("@@")) {
      line = Number(text.match(/\+(\d+)/)[1]);
    } else if (text.startsWith("+")) {
      const content = text.slice(1);
      if (DISABLE.test(content) && !REASONED.test(content)) {
        found.push({ file, line, content: content.trim() });
      }
      line += 1;
    }
  }
  return found;
};

const files = process.argv.slice(2);
if (files.length > 0) {
  const diff = execFileSync(
    "git",
    ["diff", "--cached", "-U0", "--", ...files],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  const found = findUnreasoned(diff);
  if (found.length > 0) {
    console.error("These oxlint-disable comments have no reason:\n");
    for (const { file, line, content } of found) {
      console.error(`  ${file}:${line}: ${content}`);
    }
    console.error(`
Add a reason after \`--\`, for example:
  // oxlint-disable-next-line rule/name -- why the code is right as it is

Before you add a disable, try to fix the code. Splitting a function that is
too long is usually the fix, not a disable. See CODING_STANDARDS.md.`);
    process.exit(1);
  }
}
