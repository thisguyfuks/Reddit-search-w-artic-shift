const PROVIDER_URLS = {
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  yandex: "https://yandex.com/search/?text=",
  duckduckgo: "https://duckduckgo.com/?q=",
  yahoo: "https://search.yahoo.com/search?p=",
  brave: "https://search.brave.com/search?q="
};

const QUERY_MODES = {
  balanced: {
    label: "Balanced",
    description: "A practical mix of profile, permalink, and broad discovery queries."
  },
  focused: {
    label: "Focused",
    description: "A smaller, faster set that prioritizes direct profile and permalink paths."
  },
  deep: {
    label: "Deep",
    description: "Runs more query variants for wider discovery across search engines."
  }
};

function unique(items) {
  return [...new Set(items)];
}

function buildQueryPlan(username, mode = "balanced") {
  const clean = String(username || "")
    .trim()
    .replace(/^u\//i, "")
    .replace(/^\/?user\//i, "")
    .replace(/^\/+|\/+$/g, "");

  const shared = [
    {
      id: "profile-u",
      label: "Direct profile path",
      query: `site:reddit.com/u/${clean}`
    },
    {
      id: "profile-user",
      label: "Legacy user path",
      query: `site:reddit.com/user/${clean}`
    },
    {
      id: "quoted-u",
      label: "Quoted username path",
      query: `site:reddit.com "u/${clean}"`
    },
    {
      id: "quoted-user",
      label: "Quoted legacy path",
      query: `site:reddit.com "user/${clean}"`
    }
  ];

  const expanded = [
    {
      id: "broad-comments",
      label: "Broad comment discovery",
      query: `site:reddit.com "${clean}" "comment"`
    },
    {
      id: "broad-posts",
      label: "Broad post discovery",
      query: `site:reddit.com "${clean}" "posted by"`
    },
    {
      id: "reddit-mention",
      label: "General username mentions",
      query: `site:reddit.com "${clean}" reddit`
    },
    {
      id: "subreddit-scan",
      label: "Subreddit permalink scan",
      query: `site:reddit.com/r/ "${clean}"`
    }
  ];

  const byMode = {
    focused: shared.slice(0, 3),
    balanced: [...shared, ...expanded.slice(0, 2)],
    deep: [...shared, ...expanded]
  };

  return (byMode[mode] || byMode.balanced).map((item, index) => ({
    ...item,
    order: index + 1,
    username: clean
  }));
}

function buildLaunchUrls(queryPlan, providers) {
  const urls = [];

  for (const provider of unique(providers || [])) {
    const prefix = PROVIDER_URLS[provider];
    if (!prefix) {
      continue;
    }

    for (const plan of queryPlan) {
      urls.push({
        provider,
        queryId: plan.id,
        label: `${provider} - ${plan.label}`,
        query: plan.query,
        url: `${prefix}${encodeURIComponent(plan.query)}`
      });
    }
  }

  return urls;
}

module.exports = {
  PROVIDER_URLS,
  QUERY_MODES,
  buildLaunchUrls,
  buildQueryPlan
};
