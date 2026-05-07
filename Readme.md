# XMangaManager

Local-first manga manager and reader with automatic updates and offline support.

## Features

- Track manga from sources, currently MangaDex and MangaHere.
- Automatically check for new chapters.
- Download and store chapters locally.
- Read manga locally over LAN.
- Repair broken or incomplete downloads.
- Use per-manga reader settings.
- Cache covers locally.
- View update feed.

## Setup

### Requirements

- Node.js 18 or newer recommended.
- npm.

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

This starts:

- API: `http://localhost:3000`
- Web: `http://localhost:5173`

### Build

```bash
npm run build
```

## LAN access

To expose the web UI to your network:

```bash
npm run dev -- --host
```

Then access it from another device using:

```txt
http://YOUR_LOCAL_IP:5173
```

## Data storage

Downloaded content is stored locally in:

```txt
apps/api/data/
```

This includes:

- Manga pages.
- Cached covers.
- SQLite database.

## Backup

To back up everything, copy the entire `apps/api/data/` folder.

To restore, replace the `apps/api/data/` folder with your backup copy.

## Notes

- This is a personal archival tool.
- It is not intended to publicly host or redistribute copyrighted material.
- Source sites may change APIs.

## Troubleshooting

### Chapters stuck or broken

Use the Verify or Repair options in the UI.

Restarting the server also runs startup repair for stuck download states.

### API not running

Run the API by itself to see backend errors:

```bash
npm -w apps/api run dev
```

## Future improvements

- More sources.
- Better duplicate/version handling.
- Improved mobile UI.