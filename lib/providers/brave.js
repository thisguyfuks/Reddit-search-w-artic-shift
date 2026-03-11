async function searchBraveApi({ query, apiKey, count = 8 }) {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("country", "US");
  url.searchParams.set("search_lang", "en");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API returned ${response.status}`);
  }

  const data = await response.json();
  const results = Array.isArray(data?.web?.results) ? data.web.results : [];

  return results.map((item, index) => ({
    position: index + 1,
    title: item.title || item.meta_title || "",
    snippet: item.description || "",
    url: item.url || "",
    displayUrl: item.meta_url || item.url || ""
  }));
}

module.exports = {
  searchBraveApi
};
