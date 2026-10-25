import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SoldierDashboard from './pages/SoldierDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ShiftSubmissionPage from './pages/ShiftSubmissionPage';
import ScheduleManagementPage from './pages/ScheduleManagementPage';
import DailyAutoSchedulePage from './pages/DailyAutoSchedulePage';
import ShiftPreferencesPage from './pages/ShiftPreferencesPage';
import TeamSchedulePage from './pages/TeamSchedulePage';
import SoldierShell from './components/soldier/SoldierShell';
import MyStatusPage from './pages/MyStatusPage';
import { Toaster } from './components/ui/toaster';
import { ConfirmProvider } from './components/ui/confirm-dialog';
import { PageLoader } from './components/ui/spinner';

// Loading component for auth restoration
const LoadingScreen = () => (
  <div className="min-h-screen" dir="rtl">
    <PageLoader />
  </div>
);

// Main app content wrapped with auth loading check
const AppContent = () => {
  const { loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/soldier/:soldierId"
        element={
          <ProtectedRoute requiredRole="soldier">
            <SoldierShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<SoldierDashboard />} />
        <Route path="schedule" element={<TeamSchedulePage />} />
        <Route path="shifts" element={<ShiftSubmissionPage />} />
        <Route path="status" element={<MyStatusPage />} />
        {/* old link: "my assignments" now lives on the home screen */}
        <Route path="*" element={<SoldierHomeRedirect />} />
      </Route>
      <Route path="/soldier" element={<SoldierHomeRedirect />} />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute requiredRole="admin">
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
            </Routes>
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule-management"
        element={
          <ProtectedRoute requiredRole="admin">
            <ScheduleManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/daily-auto-schedule"
        element={
          <ProtectedRoute requiredRole="admin">
            <DailyAutoSchedulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shift-preferences"
        element={
          <ProtectedRoute requiredRole="admin">
            <ShiftPreferencesPage />
          </ProtectedRoute>
        }
      />

      <Route path="/my-assignments" element={<SoldierHomeRedirect />} />
      <Route path="/" element={<LoginPage />} />
      {/* Catch-all route for undefined paths - redirect based on auth state */}
      <Route path="*" element={<RedirectHandler />} />
    </Routes>
  );
};

// Sends a soldier to their own home screen (legacy /soldier, /my-assignments links)
const SoldierHomeRedirect = () => {
  const { user } = useAuth();
  if (user?.role === 'soldier') return <Navigate to={`/soldier/${user.uid}`} replace />;
  return <Navigate to="/login" replace />;
};

// Component to handle redirects for undefined routes
const RedirectHandler = () => {
  const { user } = useAuth();

  // If user is logged in, redirect to their dashboard
  if (user) {
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (user.role === 'soldier') {
      return <Navigate to={`/soldier/${user.uid}`} replace />;
    }
  }

  // If not logged in, redirect to login page
  return <Navigate to="/login" replace />;
};

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfirmProvider>
          <Router>
            <div className="min-h-screen" dir="rtl">
              <AppContent />
            </div>
          </Router>
          <Toaster />
        </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}


