# Reddit Username Workbench

> Bloomberg Terminal-style Reddit OSINT tool. Look up any public user's full comment history, posts, and mentions — no API key required.

Built on top of **Arctic Shift** (full Reddit archive) + **PullPush** (mention search) + the official Reddit API. Returns 800–1000+ results where Reddit's own API returns ~6.

---

## Features

- **Arctic Shift** — complete Reddit archive, 500+ comments & posts per user, no key needed, ~1 week lag
- **PullPush** — finds posts written BY and ABOUT a username via full-text search, no key needed
- **Reddit API** — live recent activity (~200 items)
- **Brave Search** — search engine mentions (free API key)
- **Google / Bing / DuckDuckGo** — browser-launch links, or pull via SerpAPI
- Results sorted newest-first, deduplicated across all sources
- Filter by Comments / Posts / Profile tabs
- Export to JSON or CSV
- Run history saved locally

---

## Quick start

```bash
# Requires Node.js 18+
npm install
npm start
# Open http://localhost:3217
