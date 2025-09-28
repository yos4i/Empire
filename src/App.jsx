import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SoldierDashboard from './pages/SoldierDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ShiftSubmissionPage from './pages/ShiftSubmissionPage';
import ScheduleManagementPage from './pages/ScheduleManagementPage';
import ShiftPreferencesPage from './pages/ShiftPreferencesPage';

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
      <Route path="/" element={<LoginPage />} />
    </Routes>
  );
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


