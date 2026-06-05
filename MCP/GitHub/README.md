# GitHub MCP Server für AgenticFlow

Verbindet Perplexity mit deinen GitHub-Repositories.

## Setup

```bash
cd C:\Users\ModBot\AgenticFlow\MCP\GitHub
npm install
```

## Umgebungsvariablen

Erstelle `.env`:
```
GITHUB_TOKEN=github_pat_xxxxxxxxxxxx
```

Token erzeugen: https://github.com/settings/tokens (Scope: repo, read:repo)

## Starten

```bash
npm start
```

## Verfügbare Tools

- `list_repos` — Deine Repositories
- `get_repo_info` — Info zu Repo (owner/repo)
- `list_issues` — Issues auflisten
- `create_issue` — Neues Issue erstellen
- `list_pulls` — Pull Requests
- `health_check` — API-Status

## In Perplexity nutzen

```
"Zeige mir alle offenen Issues in meinem Hauptprojekt"
"Erstelle ein GitHub Issue für diese Aufgabe"
"Was sind meine aktiven PRs?"
```
