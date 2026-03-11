const cheerio = require("cheerio");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

function toAbsoluteUrl(url) {
  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Google redirect: /url?q=https://...&sa=...
  if (url.startsWith("/url?q=")) {
    const raw = url.slice(7).split("&")[0];
    return decodeURIComponent(raw);
  }

  // DuckDuckGo redirect: /l/?uddg=https%3A%2F%2F...&rut=...
  if (url.includes("uddg=")) {
    try {
      const qs = url.includes("?") ? url.slice(url.indexOf("?") + 1) : url;
      const params = new URLSearchParams(qs);
      const uddg = params.get("uddg");
      if (uddg) {
        return decodeURIComponent(uddg);
      }
    } catch {
      // fall through
    }
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  return url;
}

function textOrEmpty(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const PARSERS = {
  google: {
    buildUrl: (query) => `https://www.google.com/search?hl=en&q=${encodeURIComponent(query)}`,
    parse(html) {
      const $ = cheerio.load(html);
      const hits = [];

      $("div.g").each((_, element) => {
        const anchor = $(element).find("a").first();
        const title = textOrEmpty($(element).find("h3").first().text());
        const snippet = textOrEmpty(
          $(element).find(".VwiC3b, .yXK7lf, .MUxGbd, .lEBKkf span").first().text()
        );
        const url = toAbsoluteUrl(anchor.attr("href"));

        if (title && url) {
          hits.push({ title, snippet, url });
        }
      });

      return hits;
    }
  },
  bing: {
    buildUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    parse(html) {
      const $ = cheerio.load(html);
      const hits = [];

      $("li.b_algo").each((_, element) => {
        const anchor = $(element).find("h2 a").first();
        const title = textOrEmpty(anchor.text());
        const snippet = textOrEmpty($(element).find(".b_caption p").first().text());
        const url = toAbsoluteUrl(anchor.attr("href"));

        if (title && url) {
          hits.push({ title, snippet, url });
        }
      });

      return hits;
    }
  },
  yandex: {
    buildUrl: (query) => `https://yandex.com/search/?text=${encodeURIComponent(query)}`,
    parse(html) {
      const $ = cheerio.load(html);
      const hits = [];

      $(".serp-item, .Organic").each((_, element) => {
        const anchor = $(element).find("a.OrganicTitle-Link, a.Link").first();
        const title = textOrEmpty(anchor.text());
        const snippet = textOrEmpty($(element).find(".OrganicTextContentSpan, .TextContainer").first().text());
        const url = toAbsoluteUrl(anchor.attr("href"));

        if (title && url) {
          hits.push({ title, snippet, url });
        }
      });

      return hits;
    }
  },
  duckduckgo: {
    buildUrl: (query) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    parse(html) {
      const $ = cheerio.load(html);
      const hits = [];

      $(".result").each((_, element) => {
        const anchor = $(element).find(".result__title a, .result__a").first();
        const title = textOrEmpty(anchor.text());
        const snippet = textOrEmpty($(element).find(".result__snippet").first().text());
        const url = toAbsoluteUrl(anchor.attr("href"));

        if (title && url) {
          hits.push({ title, snippet, url });
        }
      });

      return hits;
    }
  },
  yahoo: {
    buildUrl: (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`,
    parse(html) {
      const $ = cheerio.load(html);
      const hits = [];

      $("div#web li, div.algo").each((_, element) => {
        const anchor = $(element).find("a").first();
        const title = textOrEmpty(anchor.text());
        const snippet = textOrEmpty($(element).find(".compText p").first().text());
        const url = toAbsoluteUrl(anchor.attr("href"));

        if (title && url) {
          hits.push({ title, snippet, url });
        }
      });

      return hits;
    }
  },
  brave: {
    buildUrl: (query) => `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
    parse(html) {
      const $ = cheerio.load(html);
      const hits = [];

      $(".snippet, .search-card, .result").each((_, element) => {
        const anchor = $(element).find("a").first();
        const title = textOrEmpty($(element).find("h2, .font-medium").first().text() || anchor.text());
        const snippet = textOrEmpty($(element).find("p, .snippet-description").first().text());
        const url = toAbsoluteUrl(anchor.attr("href"));

        if (title && url) {
          hits.push({ title, snippet, url });
        }
      });

      return hits;
    }
  }
};

const COMMON_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache"
};

async function fetchHtml(url, extraHeaders = {}) {
  const response = await fetch(url, {
    headers: { ...COMMON_HEADERS, ...extraHeaders },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`HTML fetch returned ${response.status}`);
  }

  return response.text();
}

async function searchDirectHtml({ provider, query, count = 8 }) {
  const parser = PARSERS[provider];
  if (!parser) {
    throw new Error(`No direct HTML parser is configured for "${provider}".`);
  }

  const html = await fetchHtml(parser.buildUrl(query));
  return parser.parse(html).slice(0, count).map((item, index) => ({
    position: index + 1,
    ...item
  }));
}

module.exports = {
  searchDirectHtml
};
