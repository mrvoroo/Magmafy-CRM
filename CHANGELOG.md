# Changelog

## 1.0.0 — 2026-10-30

First complete build.

- Login with email + one-time code, request access, welcome flow.
- Workspace (kit layout) with the 3D volcano in the "O" of WORKSPACE, KPIs, today's meetings and tasks.
- Contacts (grid and table, filters, bulk actions), Companies, Lead drawer and full page (card, scope, tasks, docs, log, chat, audit).
- Schedule (day, week and month), booking a meeting, meeting outcomes; header "Your Schedule" bar with a live now marker.
- Tasks, Sales tools: Pipeline (drag between stages, lost reason, undo), Reports, Templates, Activity feed.
- Inbox: direct, group and client threads with mentions; admin ↔ employee chat.
- Announcements: admin editor (levels, audience, pin, schedule, expiry, require acknowledgement), banner, urgent modal, bell, read and ack stats, reminders, Q&A thread.
- Settings: preferences, team, access requests, agency settings, audit log with CSV export.
- Dark (default), light and auto themes; Arabic (RTL) and English; mobile layout with bottom nav.
- In-browser mock backend, CI to GitHub Pages, unit tests for time and rules.
- 3D: the real magmafy-pro particle volcano everywhere (no SVG fallback); slow devices get fewer particles but keep animating; bigger volcano in the Workspace hero.
- Brand: official Magmafy mark and wordmark (login, welcome, header, rail), favicon, app icons and Apple touch icon.
- Fix: company grouping now strips generic Arabic words (`\b` does not match Arabic letters).
