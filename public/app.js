const state = {
  catalog: { providers: [], queryModes: {} },
  settings: null,
  runs: [],
  currentRun: null,
  activeTab: "all",
  filterText: ""
};

const el = {
  searchForm: document.querySelector("#searchForm"),
  settingsForm: document.querySelector("#settingsForm"),
  usernameInput: document.querySelector("#usernameInput"),
  queryModeSelect: document.querySelector("#queryModeSelect"),
  providerGrid: document.querySelector("#providerGrid"),
  historyList: document.querySelector("#historyList"),
  providerSummary: document.querySelector("#providerSummary"),
  resultList: document.querySelector("#resultList"),
  launchList: document.querySelector("#launchList"),
  refreshStateBtn: document.querySelector("#refreshStateBtn"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  braveApiKeyInput: document.querySelector("#braveApiKeyInput"),
  serpApiKeyInput: document.querySelector("#serpApiKeyInput"),
  maxResultsInput: document.querySelector("#maxResultsInput"),
  enableDirectHtmlInput: document.querySelector("#enableDirectHtmlInput"),
  autoLaunchersInput: document.querySelector("#autoLaunchersInput"),
  textFilterInput: document.querySelector("#textFilterInput"),
  tabBar: document.querySelector("#tabBar"),
  statusStack: document.querySelector("#statusStack"),
  currentUserBadge: document.querySelector("#currentUserBadge"),
  currentUserName: document.querySelector("#currentUserName"),
  statTotal: document.querySelector("#statTotal"),
  statComments: document.querySelector("#statComments"),
  statPosts: document.querySelector("#statPosts"),
  statSubreddits: document.querySelector("#statSubreddits"),
  tabCountComment: document.querySelector("#tabCountComment"),
  tabCountPost: document.querySelector("#tabCountPost"),
  resultCardTemplate: document.querySelector("#resultCardTemplate")
};

// ── Status ────────────────────────────────────────────────────────────────

function setStatus(message, tone = "ready") {
  el.statusStack.innerHTML = "";
  const pill = document.createElement("div");
  pill.className = `status-pill ${tone}`;
  pill.textContent = message;
  el.statusStack.appendChild(pill);
}

// ── API ───────────────────────────────────────────────────────────────────

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

// ── Catalog / Settings ────────────────────────────────────────────────────

function populateQueryModes() {
  el.queryModeSelect.innerHTML = "";
  Object.entries(state.catalog.queryModes).forEach(([key, val]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${val.label} — ${val.description}`;
    el.queryModeSelect.appendChild(opt);
  });
}

function renderProviderOptions() {
  el.providerGrid.innerHTML = "";
  const defaults = new Set(state.settings?.defaultProviders || []);

  state.catalog.providers.forEach((provider) => {
    const wrapper = document.createElement("label");
    wrapper.className = "provider-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "providers";
    checkbox.value = provider.id;
    checkbox.checked = defaults.has(provider.id);

    const copy = document.createElement("div");
    copy.innerHTML = `<strong>${provider.label}</strong><small>${provider.description}</small>`;
    wrapper.appendChild(checkbox);
    wrapper.appendChild(copy);
    el.providerGrid.appendChild(wrapper);
  });
}

function renderSettings() {
  if (!state.settings) return;
  el.braveApiKeyInput.value = state.settings.braveApiKey || "";
  el.serpApiKeyInput.value = state.settings.serpApiKey || "";
}

// ── History ───────────────────────────────────────────────────────────────

function renderHistory() {
  el.historyList.innerHTML = "";
  if (!state.runs.length) {
    el.historyList.innerHTML = '<div class="empty-state" style="min-height:60px">No runs yet.</div>';
    return;
  }

  state.runs.forEach((run) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "history-item";
    const date = new Date(run.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    item.innerHTML = `<strong>u/${run.username}</strong><small>${date} · ${run.resultCount} results</small>`;
    item.addEventListener("click", async () => {
      setStatus(`Loading u/${run.username}`, "working");
      const data = await fetchJson(`/api/runs/${run.id}`);
      state.currentRun = data.run;
      renderRun();
      setStatus(`Loaded u/${run.username}`, "success");
    });
    el.historyList.appendChild(item);
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────

function setActiveTab(tab) {
  state.activeTab = tab;
  el.tabBar.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  renderResults();
}

// ── Stats ─────────────────────────────────────────────────────────────────

function renderStats() {
  const results = state.currentRun?.results || [];
  const comments = results.filter((r) => r.contentType === "comment");
  const posts = results.filter((r) => r.contentType === "post");
  const subreddits = new Set(results.map((r) => r.subreddit).filter(Boolean));

  el.statTotal.textContent = results.length;
  el.statComments.textContent = comments.length;
  el.statPosts.textContent = posts.length;
  el.statSubreddits.textContent = subreddits.size;

  el.tabCountComment.textContent = comments.length || "";
  el.tabCountPost.textContent = posts.length || "";

  if (state.currentRun?.username) {
    el.currentUserName.textContent = state.currentRun.username;
    el.currentUserBadge.classList.remove("hidden");
  }
}

// ── Provider summary ──────────────────────────────────────────────────────

function renderProviderSummary(run) {
  el.providerSummary.innerHTML = "";
  if (!run?.providerReports?.length) return;

  run.providerReports.forEach((report) => {
    const row = document.createElement("div");
    row.className = "provider-row";
    row.innerHTML = `<strong>${report.label}</strong><small>${report.hitCount} results · ${report.modeUsed}${report.errors?.length ? " · ⚠ " + report.errors[0] : ""}</small>`;
    el.providerSummary.appendChild(row);
  });
}

// ── Date formatter ────────────────────────────────────────────────────────

function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d)) return "";
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / 86400000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { year: "numeric", month: "short" });
}

// ── Result rendering ──────────────────────────────────────────────────────

function filteredResults() {
  const results = state.currentRun?.results || [];
  const query = state.filterText.trim().toLowerCase();
  const tab = state.activeTab;

  return results.filter((item) => {
    const tabMatch = tab === "all" || item.contentType === tab;
    const textMatch =
      !query ||
      `${item.title} ${item.snippet} ${item.subreddit} ${item.provider}`.toLowerCase().includes(query);
    return tabMatch && textMatch;
  });
}

function renderResults() {
  const results = filteredResults();
  el.resultList.innerHTML = "";

  if (!state.currentRun) {
    el.resultList.className = "result-list empty-state";
    el.resultList.textContent = "Run a lookup to see results.";
    return;
  }

  if (!results.length) {
    el.resultList.className = "result-list empty-state";
    el.resultList.textContent = "No results match the current filters.";
    return;
  }

  el.resultList.className = "result-list";

  results.forEach((result) => {
    const node = el.resultCardTemplate.content.firstElementChild.cloneNode(true);
    node.classList.add(`type-${result.contentType}`);

    const badgeRow = node.querySelector(".badge-row");
    const dateEl = node.querySelector(".result-date");
    const titleEl = node.querySelector(".result-title");
    const snippetEl = node.querySelector(".result-snippet");
    const metaEl = node.querySelector(".result-meta");
    const scoreEl = node.querySelector(".result-score");

    // Type badge
    const typeBadge = document.createElement("span");
    typeBadge.className = `badge type-${result.contentType}`;
    typeBadge.textContent = result.contentType;
    badgeRow.appendChild(typeBadge);

    // Subreddit badge
    if (result.subreddit) {
      const sub = document.createElement("span");
      sub.className = "badge subreddit";
      sub.textContent = `r/${result.subreddit}`;
      badgeRow.appendChild(sub);
    }

    // Source mode badge (only if not reddit-api since it's obvious)
    if (result.sourceMode && result.sourceMode !== "reddit-api") {
      const modeBadge = document.createElement("span");
      modeBadge.className = "badge mode";
      modeBadge.textContent = result.sourceMode;
      badgeRow.appendChild(modeBadge);
    }

    dateEl.textContent = formatDate(result.createdAt);
    titleEl.href = result.url;
    titleEl.textContent = result.title;
    snippetEl.textContent = result.snippet || "";
    metaEl.textContent = result.displayUrl || result.url;
    if (result.score > 0) {
      scoreEl.textContent = result.score.toLocaleString();
    }

    el.resultList.appendChild(node);
  });
}

// ── Launchers ─────────────────────────────────────────────────────────────

function renderLaunchers() {
  el.launchList.innerHTML = "";
  if (!state.currentRun?.launchUrls?.length) {
    el.launchList.className = "launch-list empty-state";
    el.launchList.textContent = "Search launchers appear after a lookup.";
    return;
  }

  el.launchList.className = "launch-list";
  state.currentRun.launchUrls.forEach((launcher) => {
    const card = document.createElement("article");
    card.className = "launch-card";
    card.innerHTML = `
      <strong>${launcher.label}</strong>
      <small>${launcher.query}</small>
      <a href="${launcher.url}" target="_blank" rel="noreferrer">Open in browser →</a>
    `;
    el.launchList.appendChild(card);
  });
}

// ── Full run render ───────────────────────────────────────────────────────

function renderRun() {
  renderStats();
  renderProviderSummary(state.currentRun);
  renderResults();
  renderLaunchers();
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getSelectedProviders() {
  return [...document.querySelectorAll('input[name="providers"]:checked')].map((i) => i.value);
}

function buildSettingsPayload() {
  return {
    braveApiKey: el.braveApiKeyInput.value.trim(),
    serpApiKey: el.serpApiKeyInput.value.trim(),
    enableDirectHtml: true,
    maxResultsPerProvider: 200,
    defaultProviders: getSelectedProviders(),
    autoIncludeBrowserLaunchers: true
  };
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  if (!state.currentRun) return setStatus("Run a lookup first.", "warning");
  downloadBlob(`${state.currentRun.username}-lookup.json`, JSON.stringify(state.currentRun, null, 2), "application/json");
}

function escapeCsv(v) { return `"${String(v || "").replace(/"/g, '""')}"`; }

function exportCsv() {
  if (!state.currentRun) return setStatus("Run a lookup first.", "warning");
  const headers = ["contentType", "subreddit", "title", "url", "snippet", "score", "createdAt", "provider"];
  const rows = state.currentRun.results.map((r) =>
    [r.contentType, r.subreddit, r.title, r.url, r.snippet, r.score, r.createdAt, r.provider].map(escapeCsv).join(",")
  );
  downloadBlob(`${state.currentRun.username}-lookup.csv`, [headers.join(","), ...rows].join("\n"), "text/csv");
}

// ── Refresh / Init ────────────────────────────────────────────────────────

async function refreshState() {
  const [catalog, appState] = await Promise.all([fetchJson("/api/catalog"), fetchJson("/api/state")]);
  state.catalog = catalog;
  state.settings = appState.settings;
  state.runs = appState.runs;
  populateQueryModes();
  renderProviderOptions();
  renderSettings();
  renderHistory();
  renderRun();
}

async function initialize() {
  setStatus("Loading…", "working");
  await refreshState();
  setStatus("Ready", "ready");
}

// ── Event listeners ───────────────────────────────────────────────────────

el.searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = el.usernameInput.value.trim();
  if (!username) return;

  setStatus(`Looking up u/${username}…`, "working");

  try {
    const data = await fetchJson("/api/search", {
      method: "POST",
      body: JSON.stringify({
        username,
        queryMode: el.queryModeSelect.value,
        providers: getSelectedProviders(),
        settings: buildSettingsPayload()
      })
    });
    state.currentRun = data.run;
    state.activeTab = "all";
    el.tabBar.querySelectorAll(".tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === "all"));
    await refreshState();
    setStatus(`Found ${data.run.results.length} results for u/${username}`, "success");
  } catch (err) {
    setStatus(err.message, "warning");
  }
});

el.settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Saving…", "working");
  try {
    const data = await fetchJson("/api/settings", { method: "POST", body: JSON.stringify(buildSettingsPayload()) });
    state.settings = data.settings;
    renderProviderOptions();
    renderSettings();
    setStatus("Saved", "success");
  } catch (err) {
    setStatus(err.message, "warning");
  }
});

el.tabBar.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab?.dataset.tab) setActiveTab(tab.dataset.tab);
});

el.refreshStateBtn.addEventListener("click", async () => {
  setStatus("Refreshing…", "working");
  await refreshState();
  setStatus("Ready", "ready");
});

el.textFilterInput.addEventListener("input", (e) => {
  state.filterText = e.target.value;
  renderResults();
});

el.exportJsonBtn.addEventListener("click", exportJson);
el.exportCsvBtn.addEventListener("click", exportCsv);

initialize().catch((err) => setStatus(err.message, "warning"));
