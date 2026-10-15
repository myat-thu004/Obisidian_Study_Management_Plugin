# Life & Study Dashboard

An Obsidian plugin that turns your vault into a paper-white life and study dashboard. **Markdown files are the source of truth.** The dashboard reads and updates ordinary notes, so your records stay portable and editable.

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Folder structure](#folder-structure)
- [File formats](#file-formats)
- [Using the dashboard](#using-the-dashboard)
- [Settings and commands](#settings-and-commands)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Development](#development)
- [Changelog](#changelog)

---

## Features

| Area | What it does |
| --- | --- |
| **Today** | Shows today's tasks from your weekly plan. Ticking a task updates the checkbox in the note. A button creates (or opens) this week's plan. |
| **Calendar** | Monthly calendar with today highlighted and deadline markers. Add deadlines from the dashboard. A scrollable list below shows the month's deadlines. |
| **Pomodoro** | Timer with a subject picker, session length picker, and Start, Pause, Resume and End. Completed sessions are logged to `Sessions.md`. |
| **Stats** | Focused time for today, this week, this month and this year. |
| **Study activity** | Yearly heatmap (one square per day) beside a horizontal bar chart of hours by subject. |
| **Books** | Card view of notes in the `Books` folder, with a progress bar. |
| **Resources** | Link list kept in a single `Resources.md` file, with a form to add new links. |

---

## Installation

The plugin is plain JavaScript with no build step.

1. Download `main.js`, `manifest.json` and `styles.css`.
2. In your vault, open the hidden `.obsidian/plugins/` folder (Mac: `Cmd + Shift + .` in Finder; Windows: View → Show → Hidden items).
3. Create a folder named exactly `life-study-dashboard` and put the three files in it:
   ```
   .obsidian/plugins/life-study-dashboard/main.js
   .obsidian/plugins/life-study-dashboard/manifest.json
   .obsidian/plugins/life-study-dashboard/styles.css
   ```
4. Restart Obsidian, or run **Reload app without saving** from the command palette.
5. Go to **Settings → Community plugins**, turn on community plugins if needed, and enable **Life & Study Dashboard**.

The plugin is not in Obsidian's community directory, so the **Browse** button won't find it. To install and update it through a GitHub repository, use the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin. This needs a GitHub release whose tag matches the `version` in `manifest.json`, with the three files attached.

To update, replace the three files and reload Obsidian.

---

## Quick start

1. Enable the plugin. On first load it creates a `Life & Study` folder with example notes, if the folder doesn't exist.
2. Click the dashboard icon in the left ribbon, or run **Open dashboard** from the command palette.
3. Press **Create this week's plan** in the Today column, then add tasks under each date.
4. Pick a subject and press **Start** to run a Pomodoro.

The example notes can be edited or deleted. Existing files are never overwritten.

---

## Folder structure

Everything lives under one main folder (default `Life & Study`).

```
Life & Study/
  Home.md                    entry note with links
  Deadlines.md               all deadlines
  Sessions.md                all completed Pomodoro sessions
  Resources.md               all resource links
  Weekly Plans/
    2026-10 Week 03.md       one note per week
  Subjects/
    Chinese/Overview.md      one folder per subject
    Python/Overview.md
    SQL/Overview.md
    Reading/Overview.md
    Writing/Overview.md
  Books/
    Atomic Habits.md         one note per book
  Daily/
    2026-10-15.md            optional daily notes
```

Subjects are folders, so you can keep as many notes as you like inside each one. The `Daily` notes are example records only. The dashboard doesn't read them.

---

## File formats

Dates in headings and deadlines always use `dd-mm-yyyy` with a four-digit year.

### Weekly plans

Any note inside `Weekly Plans/` is scanned. A task belongs to the nearest `### dd-mm-yyyy` heading above it.

```markdown
# October

## Week 03

### 15-10-2026
- [ ] Review Python variables and data types
- [ ] Complete two SQL exercises

### 16-10-2026
- [ ] Practice Python loops

## Weekly goals
- 

## Notes
```

- Today's tasks are the checkbox items under today's date heading.
- Any other heading (`#`, `##` or `###`) ends the current date section. Tasks under `## Weekly goals` are not shown as daily tasks.
- Empty checkboxes (`- [ ] `) are ignored until you type text.
- Tasks for other dates stay in the note.

**File naming and week numbers.** Weekly files are named `YYYY-MM Week NN.md`. A week runs Monday to Sunday, and its Thursday decides the month and week number. The week number is `ceil(day of Thursday / 7)`. Example: the week of Monday 12 October 2026 has Thursday 15 October, so it is `2026-10 Week 03`. This is not the ISO week number.

### Deadlines

```markdown
# Deadlines

## October 2026

- [ ] 16-10-2026 — Submit health informatics assignment
- [ ] 18-10-2026 — Finish Python fundamentals review
```

- Format: `- [ ] dd-mm-yyyy — text`. The separator can be `—`, `–` or `-`.
- Deadlines added from the dashboard go under the matching `## Month YYYY` heading. The heading is created if missing.
- `Deadlines.md` is the source of truth. The calendar is only a view of it.

### Sessions

```markdown
# Sessions

### 15-10-2026
- Chinese | 25 mins | 09:00–09:25
- Python | 45 mins | 14:10–14:55
```

- Format: `- Subject | N mins | optional note`. The dashboard writes the start and end time as the note.
- New sessions are added under the session's start date. A new date heading is created if missing.
- You can edit or add lines by hand. The heatmap and stats read from this file.

### Subjects

Each folder inside `Subjects/` is one subject in the timer's dropdown. The folder name is used as the subject name in `Sessions.md`. Renaming a folder changes future sessions only. Old lines keep the old name.

### Books

One note per book. The card reads these properties:

```markdown
---
title: "Atomic Habits"
author: "James Clear"
isbn: "9780735211292"
status: reading
total_pages: 320
current_page: 40
---
```

- `title` falls back to the file name if missing.
- A progress bar shows when `total_pages` is greater than 0.
- Click a card to open its note.

### Resources

```markdown
# Resources

### Python Official Tutorial
https://docs.python.org/3/tutorial/
```

- Each resource is a `### name` heading with its link on the next non-empty line.
- Only links starting with `http://` or `https://` are clickable.

---

## Using the dashboard

### Today column
Shows tasks under today's date heading. If there are none, it says so. **Create this week's plan** builds the file for the current week (a heading and an empty checkbox for each of the 7 days, plus Weekly goals and Notes sections). If the file exists, the button changes to **Open this week's plan**.

### Calendar column
- Use **‹ ›** to change month.
- Day styling: outlined is today. An underline marks deadlines: green is upcoming, amber is within 3 days, red is overdue, grey is completed.
- Click a day to fill the date field, type a title and press **Add deadline**.
- The list below the calendar shows the displayed month's deadlines. It scrolls and has checkboxes. Overdue items are red.

### Pomodoro column
1. Choose a subject and a session length.
2. **Start** begins the countdown. **Pause** and **Resume** work as expected. Paused time does not count as focused time.
3. When the countdown reaches zero, the session is saved with the selected length.
4. **End** stops early and saves the actual focused minutes, rounded to the nearest minute (for example `Chinese | 17 mins`). Sessions under 1 minute aren't saved.
5. **Add subject** creates a new folder inside `Subjects/` with an `Overview.md`.

The timer keeps running if you close the dashboard tab. Reloading or quitting Obsidian stops it without saving.

### Stats row
Focused minutes for today, this week (Monday to Sunday), this month and this year, shown as hours and minutes.

### Study activity
One square per day of the current year. Click a square to see that day's total and sessions.

| Focused minutes | Level |
| --- | --- |
| 0 | No activity |
| 1–29 | Very light |
| 30–59 | Light |
| 60–119 | Medium |
| 120+ | Strong |

Beside it, **Hours by subject** shows one horizontal bar per subject for the year, longest first. On narrow windows it moves below the heatmap.

### Books and Resources
Book cards open their notes. **Add book** (title and author) creates a note in `Books/` with `status: to-read`. **Add resource** (name and link) appends a `### name` entry to `Resources.md`.

---

## Settings and commands

**Settings → Life & Study Dashboard**

| Setting | Description |
| --- | --- |
| Main folder | Root folder for all files. If you rename it, move your existing files too. |
| Session lengths | Comma-separated minutes for the length picker, for example `25, 45, 50`. |
| Create folder structure | Creates any missing folders and example notes. Never overwrites. |

Subjects are managed by adding, renaming or deleting folders in `Subjects/`.

**Commands** (command palette)

- **Open dashboard**
- **Create Life & Study folder with examples**

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| No tasks show | Check the note is inside `Weekly Plans/`, and the heading is exactly `### dd-mm-yyyy` for today's date with a four-digit year. |
| Timer has no subjects | Add a folder inside `Subjects/`, or use **Add subject**. |
| Stats or heatmap are empty | Check `Sessions.md` has `### dd-mm-yyyy` headings and lines like `- Chinese | 25 mins | …`. |
| Deadline doesn't appear | Check the format `- [ ] dd-mm-yyyy — text` and that the file is `Deadlines.md` in the main folder. |
| Old `Sessions/` folder is ignored | Sessions now live in a single `Sessions.md`. Move old entries into it manually. |
| Dashboard looks out of date | Close and reopen the dashboard tab. |
| Plugin won't enable | Open the developer console (`Cmd + Option + I` on Mac, `Ctrl + Shift + I` on Windows/Linux) and look for red errors. |

---

## Limitations

- The weekly four-column grid page is not built yet.
- Book covers and automatic metadata lookup (Google Books, Open Library) are not built.
- Tasks can't yet be linked to subjects or deadlines, and don't have priorities or planned time.
- Typing in an input box on the dashboard can be cleared if a vault file changes at the same moment, because the dashboard re-renders.
- The timer state is held in memory only.
- Only tested by syntax check so far. Try it on a copy of your vault first.

---

## Development

The plugin is three files with no dependencies:

- `main.js`: plugin logic and the dashboard view (uses the Obsidian API)
- `styles.css`: layout and theme (`.lsd-` class prefix)
- `manifest.json`: plugin metadata

Edit the files directly in `.obsidian/plugins/life-study-dashboard/` and reload Obsidian to test.

---

## Changelog

| Version | Changes |
| --- | --- |
| 0.4.2 | Deadline list moved back under the calendar, scrollable. |
| 0.4.1 | Tighter spacing between heatmap and chart, more right margin. |
| 0.4.0 | Section dividers, heatmap ×0.9, hours-by-subject chart, wider book cards. |
| 0.3.0 | Single `Sessions.md` and `Resources.md`, subject folders, books card view, heatmap ×1.5. |
| 0.2.0 | `Life & Study` main folder with example notes, create-weekly-plan button. |
| 0.1.0 | First version: today's tasks, calendar, Pomodoro, stats and heatmap. |
