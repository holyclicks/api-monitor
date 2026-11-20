import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Activity } from "lucide-react";
import Navbar from "./components/Navbar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import AddMonitorModal from "./components/AddMonitorModal.jsx";

// Auth
import { subscribeToAuthChanges } from "./services/auth.js";

// Pages
import Dashboard from "./pages/Dashboard.jsx";
import Monitors from "./pages/Monitors.jsx";
import FolderViewPage from "./pages/FolderViewPage.jsx";
import AddMonitorPage from "./pages/AddMonitorPage.jsx";
import EditMonitorPage from "./pages/EditMonitorPage.jsx";
import MonitorDetails from "./pages/MonitorDetails.jsx";
import Incidents from "./pages/Incidents.jsx";
import Alerts from "./pages/AlertsLog.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";

function ProtectedRoute({ currentUser, children }) {
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PublicAuthRoute({ currentUser, children }) {
  if (currentUser) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppContent() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/forgot-password";

  // While Firebase Auth is determining user session, show clean loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-gray-300">
        <div className="p-3 bg-emerald-600 rounded-xl text-white mb-4 animate-pulse">
          <Activity className="w-8 h-8" />
        </div>
        <p className="text-sm font-semibold text-white tracking-wide">APIWatch Platform</p>
        <p className="text-xs text-gray-500 mt-1">Verifying secure session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      {!isAuthPage && <Navbar currentUser={currentUser} />}

      <div className="flex-1 flex overflow-hidden">
        {!isAuthPage && currentUser && (
          <Sidebar onOpenAddModal={() => setIsAddModalOpen(true)} />
        )}

        <main className={`flex-1 overflow-y-auto ${!isAuthPage && currentUser ? "p-4 sm:p-6 lg:p-8 max-w-7xl" : ""}`}>
          <Routes>
            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute currentUser={currentUser}>
                  <Dashboard
                    key={`${currentUser?.uid}-${refreshTrigger}`}
                    onOpenAddModal={() => setIsAddModalOpen(true)}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitors"
              element={
                <ProtectedRoute currentUser={currentUser}>
                  <Monitors
                    key={`${currentUser?.uid}-${refreshTrigger}`}
                    onOpenAddModal={() => setIsAddModalOpen(true)}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitors/new"
              element={
                <ProtectedRoute currentUser={currentUser}>
                  <AddMonitorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitors/folder/:folderName"
              element={
                <ProtectedRoute currentUser={currentUser}>
                  <FolderViewPage key={currentUser?.uid} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitors/:id/edit"
              element={
                <ProtectedRoute currentUser={currentUser}>
                  <EditMonitorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitors/:id"
              element={
                <ProtectedRoute currentUser={currentUser}>
                  <MonitorDetails key={currentUser?.uid} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/incidents"
              element={
                <ProtectedRoute currentUser={currentUser}>
                  <Incidents key={currentUser?.uid} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute currentUser={currentUser}>
                  <Alerts key={currentUser?.uid} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute currentUser={currentUser}>
                  <Reports key={currentUser?.uid} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute currentUser={currentUser}>
                  <Settings key={currentUser?.uid} currentUser={currentUser} />
                </ProtectedRoute>
              }
            />

            {/* Public Auth Routes */}
            <Route
              path="/login"
              element={
                <PublicAuthRoute currentUser={currentUser}>
                  <Login />
                </PublicAuthRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicAuthRoute currentUser={currentUser}>
                  <Register />
                </PublicAuthRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicAuthRoute currentUser={currentUser}>
                  <ForgotPassword />
                </PublicAuthRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <AddMonitorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={() => setRefreshTrigger((prev) => prev + 1)}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
