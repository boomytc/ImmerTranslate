import { assertVersion } from "./version-files.mjs";

// The tag endpoint only returns published releases. Drafts require the list
// endpoint and a token with push access, including when testing for existence.
export function getGithubRelease(repo, tag, gh) {
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo))
    throw new Error("Invalid GITHUB_REPOSITORY");
  if (!tag?.startsWith("v")) throw new Error("Invalid release tag");
  assertVersion(tag.slice(1));
  try {
    return JSON.parse(gh("api", `repos/${repo}/releases/tags/${tag}`));
  } catch (error) {
    if (!error.stderr?.toString().includes("(HTTP 404)")) throw error;
  }
  const releases = JSON.parse(
    gh("api", `repos/${repo}/releases?per_page=100`, "--paginate", "--slurp")
  ).flat();
  const matches = releases.filter((release) => release.tag_name === tag);
  if (matches.length > 1) throw new Error(`Ambiguous release tag: ${tag}`);
  return matches[0] || null;
}
