import React from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const MainPage = ({ onNavigate, onLogout, userName = 'חייל' }) => {
  const menuItems = [
    { id: 'shift-submission', title: '📅 הגשת משמרות', description: 'הגש את העדפות המשמרות שלך לשבוע הבא', color: 'bg-blue-500 hover:bg-blue-600' },
    { id: 'soldier-dashboard', title: '👤 הפרטים שלי', description: 'צפה ועדכן את הפרטים האישיים שלך', color: 'bg-green-500 hover:bg-green-600' },
    { id: 'my-status', title: '📊 הסטטוס שלי', description: 'צפה במשמרות שלך ובסטטוס הבקשות', color: 'bg-purple-500 hover:bg-purple-600' },
    { id: 'schedule-management', title: '📋 ניהול סידור', description: 'ממשק מנהל לניהול הסידור השבועי', color: 'bg-orange-500 hover:bg-orange-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <header className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🌟 אימפריה - מערכת סידור עבודה</h1>
              <p className="text-gray-600 mt-2">שלום {userName}, ברוך הבא למערכת</p>
            </div>
            <Button onClick={onLogout} variant="outline" className="text-red-600 border-red-300 hover:bg-red-50">התנתק</Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-6">
          {menuItems.map((item) => (
            <Card key={item.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{item.description}</p>
                </div>
                <Button onClick={() => onNavigate(item.id)} className={`w-full text-white ${item.color} transition-colors`} size="lg">
                  כניסה לעמוד
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🔧 פעולות מהירות</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button onClick={() => onNavigate('shift-submission')} variant="outline" className="h-12">הגש משמרות חדשות</Button>
            <Button onClick={() => onNavigate('my-status')} variant="outline" className="h-12">צפה בסטטוס נוכחי</Button>
            <Button onClick={() => onNavigate('soldier-dashboard')} variant="outline" className="h-12">עדכן פרטים אישיים</Button>
          </div>
        </Card>

        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p>מערכת סידור עבודה - גרסה 1.0</p>
          <p>לתמיכה טכנית פנה למנהל המערכת</p>
        </footer>
      </div>
    </div>
  );
};

export default MainPage;



