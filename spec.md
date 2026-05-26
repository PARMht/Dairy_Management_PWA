# Dairy Farm Management App - Master Specification

## 1. Project Structure
The project will be split into two distinct directories within the root to separate the Node.js backend from the React/TSX frontend.

/backend
  /config       # Database connection file (db.js)
  /controllers  # Business logic for routes
  /routes       # Express router definitions
  server.js     # Entry point & middleware

/frontend
  /src
    /components # Reusable UI (e.g., AddCustomerForm)
    /pages      # Main views (CustomersTab, DailyRoute, Billing)
    /services   # Axios/Fetch API call wrappers
    App.tsx     # Main layout and routing

---

## 2. Backend API Routes

### Customer Management
**GET /api/customers**
* **Query Params:** `?is_subscriber=true` OR `?is_subscriber=false`
* **Description:** Fetches the list of customers. The query parameter is used by the frontend tabs to separate the daily route clients from the ad-hoc debtors.

**POST /api/customers**
* **Description:** Creates a new customer profile and handles the frontend toggle logic.
* **Request Body:** * `name` (string, required)
    * `phone` (string, required)
    * `is_subscriber` (boolean, required)
    * *If `is_subscriber` is true, include:* `product_id`, `shift`, `default_qty`.
    * *If `is_subscriber` is false, include:* `product_id`, `quantity`.
* **Logic:**
    1. Insert into `Customers` table.
    2. If true: Insert the provided details into the `Subscriptions` table.
    3. If false: Insert an immediate, one-off record into the `Daily_Logs` table (fetching current price from `Products`).

### Daily Route & Ledger Logging
**GET /api/route**
* **Query Params:** `?shift=Morning` (or Afternoon/Evening)
* **Description:** Powers the main bulk-entry UI.
* **Logic:** Joins the `Subscriptions` and `Customers` tables. Returns an array of customers assigned to the requested shift, including their `default_qty` and the `current_price` of their subscribed product.

**POST /api/logs/bulk**
* **Description:** Submits the entire daily route from the frontend with a single button click.
* **Request Body:** An array of log objects `[{ customer_id, product_id, quantity, shift, recorded_price }]`.
* **Logic:** Iterates through the array and performs a bulk `INSERT` into the `Daily_Logs` table. Calculates `total_charge` (`quantity` * `recorded_price`) during insertion.

**POST /api/payments**
* **Description:** Logs cash/UPI received to clear arrears.
* **Request Body:** `{ customer_id, amount, method, notes }`
* **Logic:** Inserts into the `Payments` table with the current date.

## 3. Frontend React Architecture

**Stack:** React, Vite (or Create React App), Tailwind CSS (for quick styling), and Axios.

**Directory Structure:**
/frontend/src/
  /components
    - `CustomerToggleForm.jsx` (Handles Add Customer with Ad-Hoc/Subscriber toggle)
  /pages
    - `CustomerManagement.jsx` (Tabs for Subscribers vs. Ad-Hoc)
    - `DailyRoute.jsx` (Top tabs for Morning/Afternoon/Evening shift. Displays list with +, -, 0 counters)
  /services
    - `api.js` (Axios configuration pointing to http://localhost:5000/api)

**Key UI Behaviors:**
1. **DailyRoute.jsx:** - On load, fetch `GET /api/route?shift=Morning`.
   - Each row displays Customer Name, Product, Default Qty, and Current Price.
   - The user can adjust the quantity via simple increment/decrement buttons.
   - A single "Confirm Shift Route" button maps the current UI state into an array of objects and POSTs to `/api/logs/bulk`.
2. **CustomerToggleForm.jsx:**
   - Must use local state (`isSubscriber`) to dynamically show/hide the subscription fields (Shift, Product, Default Qty) versus the quick-add fields (Product, Qty).