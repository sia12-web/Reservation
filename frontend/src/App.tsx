import React from "react";
import { Route, Routes, Navigate, Outlet } from "react-router-dom";
import NewReservationPage from "./routes/kiosk/NewReservationPage";
import ReservationSuccessPage from "./routes/kiosk/ReservationSuccessPage";
import InactivityGuard from "./components/kiosk/InactivityGuard";
import AdminGuard, { AdminLogin } from "./components/admin/AdminGuard";
import AdminLayout from "./app/layout/AdminLayout";
import AdminFloorMap from "./routes/admin/AdminFloorMap";
import ReservationsList from "./routes/admin/ReservationsList";
import ReservationDetails from "./routes/admin/ReservationDetails";
import BlackoutsList from "./routes/admin/BlackoutsList";
import ManageReservationPage from "./routes/client/ManageReservationPage";

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
      const isAdmin = window.location.pathname.startsWith("/admin");

      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-3">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-slate-600">
              {isAdmin ? "Please return to the admin dashboard." : "Please return to the reservation home page."}
            </p>
            <a
              className="inline-flex items-center justify-center rounded-md bg-slate-900 text-white h-12 px-6 text-lg font-bold shadow-lg hover:bg-slate-800 transition-colors"
              href={isAdmin ? "/admin/reservations" : "/reservations"}
            >
              {isAdmin ? "Return to Dashboard" : "Start New Reservation"}
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Redirect root to Reservations view */}
        <Route path="/" element={<Navigate to="/reservations" replace />} />

        {/* Kiosk Mode (Main UI) */}
        <Route
          element={
            <InactivityGuard>
              <Outlet />
            </InactivityGuard>
          }
        >
          <Route path="/reservations" element={<NewReservationPage />} />
          <Route
            path="/reservations/:id/success"
            element={<ReservationSuccessPage />}
          />
        </Route>

        {/* Admin Panel */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminGuard />}>
          <Route element={<AdminLayout><Outlet /></AdminLayout>}>
            <Route index element={<Navigate to="/admin/reservations" replace />} />
            <Route path="floor" element={<AdminFloorMap />} />
            <Route path="reservations" element={<ReservationsList />} />
            <Route path="reservations/:id" element={<ReservationDetails />} />
            <Route path="blackouts" element={<BlackoutsList />} />
          </Route>
        </Route>

        {/* Legacy /reserve -> Redirect to Reservations */}
        <Route path="/reserve" element={<Navigate to="/reservations" replace />} />
        <Route path="/reserve/success/:id" element={<Navigate to={`/reservations/${window.location.pathname.split('/').pop()}/success`} replace />} />

        {/* Manage Existing Reservation */}
        <Route path="/reservations/manage/:shortId" element={<ManageReservationPage />} />



        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/reservations" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
