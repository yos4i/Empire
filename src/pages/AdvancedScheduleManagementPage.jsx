import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import AdminScheduleManager from '../components/admin/AdminScheduleManager';

export default function AdvancedScheduleManagementPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3" dir="rtl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">ניהול שיבוץ משמרות מתקדם</h1>
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            חזרה לדשבורד
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <AdminScheduleManager />
    </div>
  );
}