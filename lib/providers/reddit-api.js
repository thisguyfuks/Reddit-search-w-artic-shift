const REDDIT_HEADERS = {
  "User-Agent": "RedditUsernameLookup/1.0 (desktop research tool)",
  "Accept": "application/json"
};

async function fetchRedditJson(url) {
  const response = await fetch(url, { headers: REDDIT_HEADERS });
  if (!response.ok) {
    throw new Error(`Reddit API ${response.status} for ${url}`);
  }
  return response.json();
}

// Paginate through a Reddit listing endpoint using the `after` token
async function fetchRedditListing(baseUrl, maxItems = 200) {
  const items = [];
  let after = null;
  const maxPages = Math.ceil(maxItems / 100);

  for (let page = 0; page < maxPages; page++) {
    const limit = Math.min(100, maxItems - items.length);
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}limit=${limit}&raw_json=1${after ? `&after=${after}` : ""}`;

    try {
      const data = await fetchRedditJson(url);
      const children = data?.data?.children || [];
      if (!children.length) break;
      items.push(...children);
      after = data?.data?.after;
      if (!after) break;
    } catch {
      break;
    }
  }

  return items;
}

function mapComment(child, position) {
  const c = child?.data;
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

function mapPost(child, position) {
  const p = child?.data;
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

async function searchRedditApi({ username, count = 200 }) {
  const clean = String(username || "")
    .trim()
    .replace(/^u\//i, "")
    .replace(/^\/?user\//i, "");

  // Run all fetches in parallel
  const [aboutResult, commentsResult, postsResult, searchResult] = await Promise.allSettled([
    fetchRedditJson(`https://www.reddit.com/user/${clean}/about.json?raw_json=1`),
    fetchRedditListing(`https://www.reddit.com/user/${clean}/comments.json?sort=new`, count),
    fetchRedditListing(`https://www.reddit.com/user/${clean}/submitted.json?sort=new`, count),
    // Search for any Reddit page that mentions the username
    fetchRedditListing(
      `https://www.reddit.com/search.json?q=%22${encodeURIComponent(clean)}%22&type=link,comment&sort=new`,
      100
    )
  ]);

  const hits = [];

  // Profile card
  if (aboutResult.status === "fulfilled") {
    const user = aboutResult.value?.data;
    if (user?.name) {
      const karma = (user.total_karma || 0).toLocaleString();
      const joined = user.created_utc
        ? new Date(user.created_utc * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long" })
        : "unknown";
      hits.push({
        position: 0,
        title: `u/${user.name} — Reddit Profile`,
        snippet: [
          user.subreddit?.public_description,
          `Karma: ${karma}`,
          `Joined ${joined}`
        ].filter(Boolean).join(" · "),
        url: `https://www.reddit.com/u/${user.name}`,
        displayUrl: `reddit.com/u/${user.name}`,
        contentType: "profile",
        subreddit: "",
        createdAt: user.created_utc ? new Date(user.created_utc * 1000).toISOString() : null,
        score: 0
      });
    }
  }

  // User's own comments
  if (commentsResult.status === "fulfilled") {
    for (const child of commentsResult.value) {
      const hit = mapComment(child, hits.length);
      if (hit) hits.push(hit);
    }
  }

  // User's own posts
  if (postsResult.status === "fulfilled") {
    for (const child of postsResult.value) {
      const hit = mapPost(child, hits.length);
      if (hit) hits.push(hit);
    }
  }

  // Reddit search results mentioning the username
  if (searchResult.status === "fulfilled") {
    for (const child of searchResult.value) {
      const kind = child.kind; // t1 = comment, t3 = post
      const hit = kind === "t1"
        ? mapComment(child, hits.length)
        : kind === "t3"
          ? mapPost(child, hits.length)
          : null;
      if (hit) hits.push(hit);
    }
  }

  return hits;
}

module.exports = { searchRedditApi };
