import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SoldierDashboard from './pages/SoldierDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ShiftSubmissionPage from './pages/ShiftSubmissionPage';
import ScheduleManagementPage from './pages/ScheduleManagementPage';
import ShiftPreferencesPage from './pages/ShiftPreferencesPage';
import MyAssignmentsPage from './pages/MyAssignmentsPage';
import MyStatusPage from './pages/MyStatusPage';

// Loading component for auth restoration
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">טוען...</p>
    </div>
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
        path="/soldier/:soldierId/*"
        element={
          <ProtectedRoute requiredRole="soldier">
            <Routes>
              <Route path="/" element={<SoldierDashboard />} />
              <Route path="/shifts" element={<ShiftSubmissionPage />} />
              <Route path="/assignments" element={<MyAssignmentsPage />} />
              <Route path="/status" element={<MyStatusPage />} />
            </Routes>
          </ProtectedRoute>
        }
      />
      <Route
        path="/soldier"
        element={
          <ProtectedRoute requiredRole="soldier">
            <SoldierDashboard />
          </ProtectedRoute>
        }
      />
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
        path="/shift-preferences"
        element={
          <ProtectedRoute requiredRole="admin">
            <ShiftPreferencesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-assignments"
        element={
          <ProtectedRoute requiredRole="soldier">
            <MyAssignmentsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<LoginPage />} />
      {/* Catch-all route for undefined paths - redirect based on auth state */}
      <Route path="*" element={<RedirectHandler />} />
    </Routes>
  );
};

// Component to handle redirects for undefined routes
const RedirectHandler = () => {
  const { user } = useAuth();

  // If user is logged in, redirect to their dashboard
  if (user) {
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (user.role === 'soldier') {
      return <Navigate to="/soldier" replace />;
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
        <Router>
          <div className="App" dir="rtl">
            <AppContent />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}


