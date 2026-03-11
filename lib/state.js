const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "app-state.json");

const DEFAULT_STATE = {
  settings: {
    braveApiKey: "",
    serpApiKey: "",
    enableDirectHtml: true,
    maxResultsPerProvider: 200,
    defaultProviders: ["arctic-shift", "pullpush", "reddit", "google", "bing", "duckduckgo", "brave"],
    autoIncludeBrowserLaunchers: true
  },
  runs: []
};

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
  }
}

function loadState() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw);

  return {
    settings: {
      ...DEFAULT_STATE.settings,
      ...parsed.settings,
      braveApiKey: process.env.BRAVE_API_KEY || parsed.settings?.braveApiKey || "",
      serpApiKey: process.env.SERPAPI_KEY || parsed.settings?.serpApiKey || ""
    },
    runs: Array.isArray(parsed.runs) ? parsed.runs : []
  };
}

function saveState(state) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function saveSettings(nextSettings) {
  const state = loadState();
  state.settings = {
    ...state.settings,
    ...nextSettings
  };
  saveState(state);
  return state.settings;
}

function appendRun(run) {
  const state = loadState();
  state.runs = [run, ...state.runs].slice(0, 30);
  saveState(state);
  return run;
}

module.exports = {
  DEFAULT_STATE,
  loadState,
  saveSettings,
  appendRun
};
