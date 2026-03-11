// PullPush — Reddit archive with full-text mention search
// No API key required. Data lags ~6 months behind present.
// Useful for finding mentions of a username by OTHER users.

const BASE = "https://api.pullpush.io/reddit/search";

const HEADERS = {
  "User-Agent": "RedditUsernameLookup/1.0",
  "Accept": "application/json"
};

async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`PullPush returned ${res.status}`);
  return res.json();
}

async function fetchAll(endpoint, params, maxItems = 200) {
  const items = [];
  let before = null;

  while (items.length < maxItems) {
    const size = Math.min(100, maxItems - items.length);
    const qs = new URLSearchParams({ ...params, size: String(size), sort_type: "created_utc", sort: "desc" });
    if (before) qs.set("before", String(before));

    const data = await fetchPage(`${BASE}${endpoint}/?${qs}`);
    const page = Array.isArray(data?.data) ? data.data : [];
    if (!page.length) break;

    items.push(...page);
    const last = page[page.length - 1];
    before = last?.created_utc ?? null;
    if (!before || page.length < size) break;
  }

  return items;
}

function mapComment(c, position) {
  const permalink = c.permalink || (c.link_id && c.id ? `/r/${c.subreddit}/comments/${c.link_id?.slice(3)}/_/${c.id}/` : null);
  if (!permalink) return null;
  const body = String(c.body || "").replace(/\s+/g, " ").trim();
  return {
    position,
    title: `Comment in r/${c.subreddit}`,
    snippet: body.slice(0, 400),
    url: `https://www.reddit.com${permalink}`,
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

async function searchPullPush({ username, count = 200 }) {
  const clean = String(username || "")
    .trim()
    .replace(/^u\//i, "")
    .replace(/^\/?user\//i, "");

  // Run author history AND mention search in parallel
  const [commentsData, postsData, mentionCommentsData, mentionPostsData] = await Promise.allSettled([
    fetchAll("/comment", { author: clean }, count),
    fetchAll("/submission", { author: clean }, Math.min(count, 100)),
    fetchAll("/comment", { q: clean }, Math.min(count, 100)),
    fetchAll("/submission", { q: clean }, Math.min(count, 100))
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

  // Mentions written by OTHER users
  if (mentionCommentsData.status === "fulfilled") {
    for (const c of mentionCommentsData.value) {
      const hit = mapComment(c, hits.length);
      if (hit) hits.push(hit);
    }
  }

  if (mentionPostsData.status === "fulfilled") {
    for (const p of mentionPostsData.value) {
      const hit = mapPost(p, hits.length);
      if (hit) hits.push(hit);
    }
  }

  return hits;
}

module.exports = { searchPullPush };
