import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import DailyRoute from './pages/DailyRoute';
import CustomerManagement from './pages/CustomerManagement';
import PaymentsDashboard from './pages/PaymentsDashboard';
import ProductManagement from './pages/ProductManagement';
import SubscriberManagement from './pages/SubscriberManagement';
import LogHistory from './pages/LogHistory';
import MonthlyBilling from './pages/MonthlyBilling';

// ─── Route tree ───────────────────────────────────────────────────────────────
//
//  /                   → AppLayout (persistent shell)
//  ├─ index            → DailyRoute
//  ├─ /customers       → CustomerManagement
//  ├─ /payments        → PaymentsDashboard
//  ├─ /products        → ProductManagement
//  ├─ /subscribers     → SubscriberManagement
//  ├─ /logs            → LogHistory
//  └─ /billing         → MonthlyBilling
//
// createBrowserRouter is used (instead of <BrowserRouter>) to enable the
// Data Router API and to keep the route configuration as a plain data structure
// that is easy to test and extend.

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,                    // matches "/" exactly
        element: <DailyRoute />,
      },
      {
        path: 'customers',              // matches "/customers"
        element: <CustomerManagement />,
      },
      {
        path: 'payments',               // matches "/payments"
        element: <PaymentsDashboard />,
      },
      {
        path: 'products',               // matches "/products"
        element: <ProductManagement />,
      },
      {
        path: 'subscribers',            // matches "/subscribers"
        element: <SubscriberManagement />,
      },
      {
        path: 'logs',                   // matches "/logs"
        element: <LogHistory />,
      },
      {
        path: 'billing',                // matches "/billing"
        element: <MonthlyBilling />,
      },
    ],
  },
]);

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return <RouterProvider router={router} />;
}
