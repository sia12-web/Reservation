import React from "react";
import { Route, Routes, Navigate, Outlet } from "react-router-dom";
import AdminGuard, { AdminLogin } from "./components/admin/AdminGuard";
import AdminLayout from "./app/layout/AdminLayout";
import AdminFloorMap from "./routes/admin/AdminFloorMap";
import ReservationsList from "./routes/admin/ReservationsList";
import ReservationDetails from "./routes/admin/ReservationDetails";
import BlackoutsList from "./routes/admin/BlackoutsList";
import MarketingPage from "./routes/admin/MarketingPage";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-3">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-slate-600">
              Please return to the admin dashboard.
            </p>
            <a
              className="inline-flex items-center justify-center rounded-md bg-slate-900 text-white h-12 px-6 text-lg font-bold shadow-lg hover:bg-slate-800 transition-colors"
              href="/admin/reservations"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function AdminApp() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Admin Panel */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminGuard />}>
          <Route element={<AdminLayout><Outlet /></AdminLayout>}>
            <Route index element={<Navigate to="/admin/reservations" replace />} />
            <Route path="floor" element={<AdminFloorMap />} />
            <Route path="reservations" element={<ReservationsList />} />
            <Route path="reservations/:id" element={<ReservationDetails />} />
            <Route path="blackouts" element={<BlackoutsList />} />
            <Route path="marketing" element={<MarketingPage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/admin/reservations" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
