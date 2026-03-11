// Arctic Shift — comprehensive Reddit archive
// Returns full comment/post history for any user, no API key required.
// API docs: https://arctic-shift.photon-reddit.com/api/docs

const BASE = "https://arctic-shift.photon-reddit.com/api";

const HEADERS = {
  "User-Agent": "RedditUsernameLookup/1.0",
  "Accept": "application/json"
};

async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Arctic Shift returned ${res.status}`);
  return res.json();
}

// Paginate using `before=<unix_timestamp>` of the last item
async function fetchAll(endpoint, params, maxItems = 500) {
  const items = [];
  let before = null;

  while (items.length < maxItems) {
    const limit = Math.min(100, maxItems - items.length);
    const qs = new URLSearchParams({ ...params, limit: String(limit) });
    if (before) qs.set("before", String(before));

    const data = await fetchPage(`${BASE}${endpoint}?${qs}`);
    const page = Array.isArray(data?.data) ? data.data : [];
    if (!page.length) break;

    items.push(...page);
    const last = page[page.length - 1];
    before = last?.created_utc ?? null;
    if (!before || page.length < limit) break;
  }

  return items;
}

function mapComment(c, position) {
  if (!c?.permalink) return null;
  const body = String(c.body || "").replace(/\s+/g, " ").trim();
  return {
    position,
    title: `Comment in r/${c.subreddit}`,
    snippet: body.slice(0, 400),
    url: `https://www.reddit.com${c.permalink}`,
    displayUrl: `reddit.com/r/${c.subreddit}`,
    contentType: "comment",
    subreddit: c.subreddit || "",
    createdAt: c.created_utc ? new Date(c.created_utc * 1000).toISOString() : null,
    score: c.score || 0
  };
}

function mapPost(p, position) {
  if (!p?.permalink) return null;
  const body = String(p.selftext || "").replace(/\s+/g, " ").trim();
  return {
    position,
    title: p.title || `Post in r/${p.subreddit}`,
    snippet: body.slice(0, 400) || p.url || "",
    url: `https://www.reddit.com${p.permalink}`,
    displayUrl: `reddit.com/r/${p.subreddit}`,
    contentType: "post",
    subreddit: p.subreddit || "",
    createdAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
    score: p.score || 0
  };
}

async function searchArcticShift({ username, count = 500 }) {
  const clean = String(username || "")
    .trim()
    .replace(/^u\//i, "")
    .replace(/^\/?user\//i, "");

  const [commentsData, postsData] = await Promise.allSettled([
    fetchAll("/comments/search", { author: clean, sort: "desc" }, count),
    fetchAll("/posts/search", { author: clean, sort: "desc" }, Math.min(count, 200))
  ]);

  const hits = [];

  if (commentsData.status === "fulfilled") {
    for (const c of commentsData.value) {
      const hit = mapComment(c, hits.length);
      if (hit) hits.push(hit);
    }
  }

  if (postsData.status === "fulfilled") {
    for (const p of postsData.value) {
      const hit = mapPost(p, hits.length);
      if (hit) hits.push(hit);
    }
  }

  return hits;
}

module.exports = { searchArcticShift };
