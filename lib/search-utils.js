const crypto = require("crypto");
const { PROVIDER_URLS } = require("./query-builder");
const { searchBraveApi } = require("./providers/brave");
const { searchSerpApi } = require("./providers/serpapi");
const { searchDirectHtml } = require("./providers/direct-html");
const { searchRedditApi } = require("./providers/reddit-api");
const { searchArcticShift } = require("./providers/arctic-shift");
const { searchPullPush } = require("./providers/pullpush");

const PROVIDER_CATALOG = [
  {
    id: "arctic-shift",
    label: "Arctic Shift",
    description: "Complete Reddit archive — returns full comment & post history for any user. No API key. Returns 1000+ results.",
    supportsArchive: true,
    supportsSerpApi: false,
    supportsDirectHtml: false
  },
  {
    id: "pullpush",
    label: "PullPush",
    description: "Reddit archive with mention search — finds posts written BY and ABOUT the username. No API key. Data up to ~6 months ago.",
    supportsArchive: true,
    supportsSerpApi: false,
    supportsDirectHtml: false
  },
  {
    id: "reddit",
    label: "Reddit API",
    description: "Reddit's official API — recent activity only (~25 items). Use Arctic Shift for full history.",
    supportsRedditApi: true,
    supportsSerpApi: false,
    supportsDirectHtml: false
  },
  {
    id: "brave",
    label: "Brave Search",
    description: "Search engine results for \"username\" site:reddit.com — finds mentions by other users. Requires free Brave API key (api.search.brave.com).",
    supportsSerpApi: false,
    supportsDirectHtml: false
  },
  {
    id: "google",
    label: "Google",
    description: "Open in browser only (server-side scraping blocked). Requires SerpAPI key to pull results.",
    supportsSerpApi: true,
    supportsDirectHtml: false
  },
  {
    id: "bing",
    label: "Bing",
    description: "Open in browser only. Requires SerpAPI key to pull results.",
    supportsSerpApi: true,
    supportsDirectHtml: false
  },
  {
    id: "duckduckgo",
    label: "DuckDuckGo",
    description: "Open in browser only. Requires SerpAPI key to pull results.",
    supportsSerpApi: true,
    supportsDirectHtml: false
  },
  {
    id: "yandex",
    label: "Yandex",
    description: "Open in browser only. Requires SerpAPI key to pull results.",
    supportsSerpApi: true,
    supportsDirectHtml: false
  }
];

function canonicalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";

    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ved" || key === "sei") {
        url.searchParams.delete(key);
      }
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

function classifyRedditUrl(rawUrl) {
  const url = canonicalizeUrl(rawUrl);
  const lowered = url.toLowerCase();
  let subreddit = "";
  let contentType = "unknown";

  const subredditMatch = lowered.match(/reddit\.com\/r\/([^/]+)/i);
  if (subredditMatch) {
    subreddit = subredditMatch[1];
  }

  if (/reddit\.com\/(u|user)\//i.test(lowered)) {
    contentType = "profile";
  }

  if (/reddit\.com\/r\/[^/]+\/comments\/[^/]+\/[^/]+\/[^/?#]+/i.test(lowered)) {
    contentType = "comment";
  } else if (/reddit\.com\/r\/[^/]+\/comments\/[^/]+/i.test(lowered)) {
    contentType = "post";
  }

  return {
    canonicalUrl: url,
    subreddit,
    contentType
  };
}

function scoreHit({ url, title, snippet, username }) {
  let score = 35;

  if (/reddit\.com/i.test(url)) {
    score += 20;
  }

  if (/\/comments\//i.test(url)) {
    score += 20;
  }

  if (/\/(u|user)\//i.test(url)) {
    score += 10;
  }

  const body = `${title} ${snippet}`.toLowerCase();
  if (body.includes(String(username).toLowerCase())) {
    score += 10;
  }

  return Math.min(score, 100);
}

function normalizeHit({ provider, sourceMode, rawHit, queryPlanItem, username }) {
  const { canonicalUrl, subreddit, contentType } = classifyRedditUrl(rawHit.url || "");
  const title = String(rawHit.title || "").trim();
  const snippet = String(rawHit.snippet || "").trim();

  return {
    id: crypto.createHash("sha1").update(`${provider}:${canonicalUrl}:${queryPlanItem.id}`).digest("hex"),
    provider,
    sourceMode,
    queryId: queryPlanItem.id,
    queryLabel: queryPlanItem.label,
    query: queryPlanItem.query,
    title: title || rawHit.displayUrl || canonicalUrl,
    snippet,
    url: canonicalUrl,
    displayUrl: rawHit.displayUrl || canonicalUrl,
    position: rawHit.position || 0,
    subreddit,
    contentType,
    confidence: scoreHit({
      url: canonicalizeUrl(rawHit.url || ""),
      title,
      snippet,
      username
    }),
    createdAt: rawHit.createdAt || null,
    score: rawHit.score || 0,
    fetchedAt: new Date().toISOString()
  };
}

function dedupeHits(hits) {
  const seen = new Map();

  for (const hit of hits) {
    const key = hit.url;
    const existing = seen.get(key);

    if (!existing || hit.confidence > existing.confidence) {
      seen.set(key, hit);
    }
  }

  return [...seen.values()].sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bDate - aDate;
  });
}

async function runProviderQuery({ provider, query, settings, count, username }) {
  // Arctic Shift — full Reddit archive, no API key, 1000+ results
  if (provider === "arctic-shift") {
    return {
      modeUsed: "arctic-shift",
      hits: await searchArcticShift({ username, count })
    };
  }

  // PullPush — Reddit archive + mention search, no API key
  if (provider === "pullpush") {
    return {
      modeUsed: "pullpush",
      hits: await searchPullPush({ username, count })
    };
  }

  // Reddit official API — recent activity only
  if (provider === "reddit") {
    return {
      modeUsed: "reddit-api",
      hits: await searchRedditApi({ username, count })
    };
  }

  if (provider === "brave" && settings.braveApiKey) {
    return {
      modeUsed: "brave-api",
      hits: await searchBraveApi({
        query,
        apiKey: settings.braveApiKey,
        count
      })
    };
  }

  if (settings.serpApiKey && PROVIDER_CATALOG.find((entry) => entry.id === provider)?.supportsSerpApi) {
    return {
      modeUsed: "serpapi",
      hits: await searchSerpApi({
        provider,
        query,
        apiKey: settings.serpApiKey,
        count
      })
    };
  }

  return {
    modeUsed: "browser-launch",
    hits: []
  };
}

async function searchProviders({ username, providers, queryPlan, settings }) {
  const maxResults = Number(settings.maxResultsPerProvider || 12);
  const providerReports = [];
  const allHits = [];

  for (const provider of providers) {
    let modeUsed = "browser-launch";
    const errors = [];
    const providerHits = [];

    // Archive/direct providers run once per lookup, not once per query plan item
    const SINGLE_RUN_PROVIDERS = ["reddit", "arctic-shift", "pullpush"];
    const plans = SINGLE_RUN_PROVIDERS.includes(provider) ? [queryPlan[0]] : queryPlan;

    for (const plan of plans) {
      if (providerHits.length >= maxResults) {
        break;
      }

      try {
        const response = await runProviderQuery({
          provider,
          query: plan.query,
          settings,
          count: SINGLE_RUN_PROVIDERS.includes(provider) ? 500 : Math.min(8, maxResults),
          username
        });

        modeUsed = response.modeUsed;

        for (const rawHit of response.hits) {
          providerHits.push(
            normalizeHit({
              provider,
              sourceMode: response.modeUsed,
              rawHit,
              queryPlanItem: plan,
              username
            })
          );
        }
      } catch (error) {
        errors.push(error.message);
      }
    }

    const cap = SINGLE_RUN_PROVIDERS.includes(provider) ? 1500 : maxResults;
    const dedupedProviderHits = dedupeHits(providerHits).slice(0, cap);
    allHits.push(...dedupedProviderHits);

    providerReports.push({
      provider,
      label: PROVIDER_CATALOG.find((entry) => entry.id === provider)?.label || provider,
      modeUsed,
      hitCount: dedupedProviderHits.length,
      errors,
      launchPrefix: PROVIDER_URLS[provider] || ""
    });
  }

  return {
    providerReports,
    hits: dedupeHits(allHits)
  };
}

module.exports = {
  PROVIDER_CATALOG,
  searchProviders
};
