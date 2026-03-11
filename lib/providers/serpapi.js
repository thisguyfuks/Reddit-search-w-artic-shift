const ENGINE_MAP = {
  google: "google",
  bing: "bing",
  yandex: "yandex",
  duckduckgo: "duckduckgo",
  yahoo: "yahoo"
};

async function searchSerpApi({ provider, query, apiKey, count = 8 }) {
  const engine = ENGINE_MAP[provider];
  if (!engine) {
    throw new Error(`SerpAPI does not support provider "${provider}" in this app.`);
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", engine);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(count));
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SerpAPI returned ${response.status}`);
  }

  const data = await response.json();
  const organic = Array.isArray(data.organic_results) ? data.organic_results : [];

  return organic.map((item, index) => ({
    position: item.position || index + 1,
    title: item.title || "",
    snippet: item.snippet || item.rich_snippet?.top?.extensions?.join(" ") || "",
    url: item.link || item.redirect_link || "",
    displayUrl: item.displayed_link || item.link || ""
  }));
}

module.exports = {
  searchSerpApi
};
