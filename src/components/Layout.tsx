import React from "react";
import { Link } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
  currentPageName?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPageName }) => {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">אימפריה - מערכת סידור</h1>
            </div>
            <nav className="flex items-center space-x-4 space-x-reverse">
              <Link 
                to="/soldierdashboard" 
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                דשבורד
              </Link>
              <Link 
                to="/shiftsubmission" 
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                הגשת משמרות
              </Link>
              <Link 
                to="/mystatus" 
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                הפרופיל שלי
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main>
        {children}
      </main>
    </div>
  );
};

export default Layout;