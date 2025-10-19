import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import MyAssignments from '../components/soldier/MyAssignments';

export default function MyAssignmentsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Navigation Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/soldier')}
              className="flex items-center gap-2 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">חזרה לדשבורד</span>
              <span className="sm:hidden">חזור</span>
            </Button>

            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 flex-1 text-center">המשמרות שלי</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <MyAssignments />
    </div>
  );
}