# Dairy Farm Management App - Master Specification (v2.0)

## 1. Project Structure & Tech Stack
**Stack:** React/TSX (Frontend), Node.js/Express (Backend), MySQL (Database).
**Enhancements:** Vite PWA for offline capability, `localforage` (IndexedDB) for state-based offline queuing, `react-i18next` for English/Hindi/Marathi localization.

```text
/backend
  /config       # Database connection file (db.js) - MUST enforce +05:30 IST timezone
  /controllers  # Business logic for routes
  /routes       # Express router definitions
  server.js     # Entry point & middleware

/frontend
  /src
    /components # Reusable UI (e.g., AddCustomerForm)
    /pages      # Main views (CustomersTab, DailyRoute, Billing)
    /services   # Axios API wrappers & localforage offline sync logic
    /locales    # JSON translation files for i18next (en, hi, mr)
    App.tsx     # Main layout and routing