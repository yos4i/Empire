import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { AlertCircle, Clock, Calendar, CheckCircle } from "lucide-react";

export default function SubmissionRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          חוקי ההגשה
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
            <div>
              <span className="font-medium">בחירת משמרות חופשית</span>
              <p className="text-gray-600">בחר את המשמרות שאתה מעוניין לעבוד</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
            <div>
              <span className="font-medium">ללא הגבלות</span>
              <p className="text-gray-600">ניתן לבחור כמות משמרות לפי העדפתך</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 mt-0.5" />
            <div>
              <span className="font-medium">זמני הגשה</span>
              <p className="text-gray-600">ניתן להגיש בכל עת</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-purple-600 mt-0.5" />
            <div>
              <span className="font-medium">עדכון הגשות</span>
              <p className="text-gray-600">ניתן לעדכן ההגשה מספר פעמים</p>
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium">חופש בחירה:</p>
              <p>בחר בדיוק את המשמרות שאתה רוצה - ללא הגבלות</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


