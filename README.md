# SQLite Database Viewer

A lightweight, client-side React application for browsing and filtering SQLite databases directly in the browser using **sql.js** and **Tabulator**.

This tool is particularly useful for exploring structured data (e.g., personal knowledge bases, Obsidian vaults with DataView/SQL plugins, reading trackers, or any custom SQLite dataset) without requiring a server backend.

## Features

- **Fully client-side**: No data is uploaded or sent anywhere — everything runs locally in your browser.
- **Interactive table** powered by [Tabulator](https://tabulator.info/) with sorting, column resizing, and responsive layout.
- **Clickable tag/backlink filtering**: Tags and backlinks are rendered as colored, clickable badges that instantly filter the table.
- **Advanced filtering**:
  - Full-text search on a configurable column
  - Include/exclude filters for taggable columns (e.g., tags, backlinks)
- **Customizable via JSON configuration** — define your own SQL query, columns, sorting, and behavior.
- **Dark/light mode toggle**
- **Supports custom column types**: text, date, number, boolean, and taggable (with visual badges)
- **No build tools required** — works with a simple static deployment

## Live Demo

An example database (`test-full.db`) is included for immediate testing.

## Screenshots

*They will ve there soon*

## Usage

1. Open the application in your browser.
2. Click **"Choose File"** and select your `.db` SQLite file.
   - Alternatively, download the provided `test-full.db` example to explore the features.
3. The main table will load using the default query.
4. Use the filters above the table:
   - Search by file name (or configured column)
   - Include or exclude specific tags/backlinks using the dropdowns
   - Click any tag in the table to instantly filter by it
5. (Optional) Click **"Show Config"** to edit the JSON configuration and tailor the view to your database schema.

## Configuration

The viewer is highly configurable via a JSON object. Click **"Show Config"** in the app to edit it live.

Key configuration options:

| Field                  | Description |
|------------------------|-----------|
| `mainQuery`            | Primary SQL query to fetch table rows |
| `queries`              | Named queries to populate filter dropdowns (e.g., all tags) |
| `textSearchColumn`     | Column to enable free-text search on |
| `taggableColumns`      | Columns rendered as clickable colored tags |
| `columns`              | Define visible columns, types, and formatting |
| `defaultSortField` / `defaultSortDir` | Initial table sorting |

See the default config in `src/App.jsx` for full documentation.

## Tech Stack

- [React](https://reactjs.org/)
- [sql.js](https://sql.js.org/) – SQLite compiled to WebAssembly
- [Tabulator](https://tabulator.info/) – Powerful interactive table library
- [react-select](https://react-select.com/) – Accessible multi-select component


## Acknowledgments

- [sql.js](https://github.com/sql-js/sql.js) by @sql-js
- [Tabulator](https://tabulator.info/) by Oli Warner
- Inspired by tools like Obsidian + DataView for personal data visualization

---

**Simple. Local. Powerful.** — Explore your SQLite data with ease.