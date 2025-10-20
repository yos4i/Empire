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
          <div className="relative flex items-center justify-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/soldier')}
              className="absolute left-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <h1 className="text-2xl font-bold text-gray-900">המשמרות שלי</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <MyAssignments />
    </div>
  );
}