# Changelog

## 1.1.0 — 2026-10-30

- Backend (`backend/`): gateway for the site (`doPost action=crm`) and the 23 new functions: announcements, team chat, notifications and pulse, access requests, audit log, settings, team, templates, bulk lead edits, activity feed.
- 7 new sheet tabs created by «① تجهيز الشيت», plus `CRM_URL` and `CHAT_POLL_SECONDS` settings and an «نشط» column for templates.
- Every change (site, sheet edits, public bookings) goes to «سجل التعديلات»; assignments, bookings, announcements, messages and mentions ring the bell.
- Fix: ids no longer wrap to 0000 after 9999 records.
- Tests run the real `.gs` files against an in-memory sheet with the site's schemas.

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
- Mobile: every 3D shape sits centred behind the content, sized to the screen width.
- Fix: company grouping now strips generic Arabic words (`\b` does not match Arabic letters).
