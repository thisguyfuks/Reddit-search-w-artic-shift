const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { QUERY_MODES, buildLaunchUrls, buildQueryPlan } = require("./lib/query-builder");
const { PROVIDER_CATALOG, searchProviders } = require("./lib/search-utils");
const { loadState, saveSettings, appendRun } = require("./lib/state");

const app = express();
const PORT = process.env.PORT || 3217;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/catalog", (_req, res) => {
  res.json({
    providers: PROVIDER_CATALOG,
    queryModes: QUERY_MODES
  });
});

app.get("/api/state", (_req, res) => {
  const state = loadState();
  res.json({
    settings: state.settings,
    runs: state.runs.map((run) => ({
      id: run.id,
      username: run.username,
      queryMode: run.queryMode,
      createdAt: run.createdAt,
      resultCount: run.results.length,
      providerReports: run.providerReports
    }))
  });
});

app.get("/api/runs/:id", (req, res) => {
  const state = loadState();
  const run = state.runs.find((entry) => entry.id === req.params.id);

  if (!run) {
    res.status(404).json({ error: "Run not found." });
    return;
  }

  res.json({ run });
});

app.post("/api/settings", (req, res) => {
  const nextSettings = saveSettings(req.body || {});
  res.json({ settings: nextSettings });
});

app.post("/api/search", async (req, res) => {
  const username = String(req.body?.username || "")
    .trim()
    .replace(/^u\//i, "")
    .replace(/^\/?user\//i, "");

  if (!username) {
    res.status(400).json({ error: "Enter a Reddit username first." });
    return;
  }

  const state = loadState();
  const settings = {
    ...state.settings,
    ...(req.body?.settings || {})
  };
  const queryMode = QUERY_MODES[req.body?.queryMode] ? req.body.queryMode : "balanced";
  const requestedProviders = Array.isArray(req.body?.providers) ? req.body.providers : [];
  const providers = requestedProviders.length ? requestedProviders : settings.defaultProviders;
  const queryPlan = buildQueryPlan(username, queryMode);
  const launchUrls = buildLaunchUrls(queryPlan, providers);

  try {
    const searchResponse = await searchProviders({
      username,
      providers,
      queryPlan,
      settings
    });

    const run = {
      id: crypto.randomUUID(),
      username,
      queryMode,
      createdAt: new Date().toISOString(),
      queryPlan,
      providerReports: searchResponse.providerReports,
      launchUrls,
      results: searchResponse.hits
    };

    appendRun(run);
    res.json({ run });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Search failed."
    });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Reddit Username Workbench is running at http://localhost:${PORT}`);
});

