# Calendar Frontend (Tizen Web App)

A simple calendar scheduler app built with React + Vite for Tizen web. It provides a month view calendar, an event list sidebar, and modal dialogs to add/edit events. State is in-memory with localStorage persistence. Includes placeholder reminder notifications.

## Features
- Month view with previous/next/today navigation
- Highlight today, indicate days with events (dot)
- Select a day to see its events in a sidebar
- Add/Edit/Delete events with fields:
  - Title (required), Date, Time, Description
  - Reminder toggle + minutes before
- In-memory store with localStorage persistence
- Placeholder notification scheduler using setTimeout
  - Logs to console at reminder time; stub for Tizen notification APIs
- Ocean Professional theme:
  - primary #2563EB, secondary/success #F59E0B, error #EF4444
  - background #f9fafb, surface #ffffff, text #111827
  - subtle gradient headers, rounded corners, shadows, transitions
- Accessibility:
  - Semantic roles for grid and dialog
  - ARIA labels for buttons and dialog
  - Modal focus management and ESC/BACK to close (BACK via remote)

## Getting Started

- Development (HMR):
  npm run dev

- Preview build:
  npm run build
  npm run preview

The existing preview setup runs on the default Vite port (3000). Ensure your environment exposes port 3000.

## Usage Tips
- Click a day in the calendar to select it; the sidebar lists the day's events.
- Use "+ Add Event" to create a new event for the selected day.
- Edit or delete events from the sidebar list.
- Reminders will log to the console when due.

## Packaging for Tizen
- Build the web bundle:
  npm run build:tizen

- Package widget:
  npm run package:tizen

This creates app.wgt in the project root (beside dist) including config.xml.

## Notes
- No external APIs or services used.
- If Tizen push/notification APIs are available, integrate inside scheduleReminder in src/App.jsx where indicated.
