import React, { useState } from 'react';
import { X, Search, Calendar, User, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { 
  WEEKDAYS_HE, 
  hasAnyPreferences, 
  getTotalShifts, 
  getSlotDisplayText 
} from '../../utils/preferences';

export default function PreferencesPanel({ 
  isOpen, 
  onClose, 
  submissions, 
  weekStart, 
  loading 
}) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredSubmissions = submissions.filter(sub => 
    sub.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.userId.includes(searchTerm)
  );

  const submissionsWithPrefs = filteredSubmissions.filter(hasAnyPreferences);
  const submissionsWithoutPrefs = filteredSubmissions.filter(sub => !hasAnyPreferences(sub));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end" dir="rtl">
      <div className="bg-white w-full max-w-4xl h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  העדפות חיילים
                </h2>
                <p className="text-sm text-gray-600">
                  שבוע המתחיל ב־ {format(new Date(weekStart), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="חיפוש לפי שם או מזהה..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>סה״כ: {filteredSubmissions.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="bg-green-50 text-green-800">
                  הגישו: {submissionsWithPrefs.length}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="bg-red-50 text-red-800">
                  לא הגישו: {submissionsWithoutPrefs.length}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">טוען העדפות...</p>
              </div>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-500">אין הגשות לשבוע זה</h3>
                <p className="text-gray-400">לא נמצאו העדפות משמרות לשבוע הנבחר</p>
              </div>
            </div>
          ) : (
            <div className="p-4">
              {/* Submissions with preferences */}
              {submissionsWithPrefs.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800">
                      חיילים שהגישו העדפות ({submissionsWithPrefs.length})
                    </Badge>
                  </h3>
                  
                  <div className="space-y-4">
                    {submissionsWithPrefs.map(submission => (
                      <SubmissionCard key={submission.id} submission={submission} />
                    ))}
                  </div>
                </div>
              )}

              {/* Submissions without preferences */}
              {submissionsWithoutPrefs.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Badge className="bg-red-100 text-red-800">
                      חיילים שלא הגישו העדפות ({submissionsWithoutPrefs.length})
                    </Badge>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {submissionsWithoutPrefs.map(submission => (
                      <div key={submission.id} className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="font-medium text-gray-900">{submission.userName}</div>
                        <div className="text-sm text-gray-600">מזהה: {submission.userId}</div>
                        <div className="text-xs text-red-600 mt-1">לא הגיש העדפות</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SubmissionCard({ submission }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalShifts = getTotalShifts(submission);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-gray-400" />
            <div>
              <div className="font-medium text-gray-900">{submission.userName}</div>
              <div className="text-sm text-gray-600">מזהה: {submission.userId}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-blue-50 text-blue-800">
              {totalShifts} משמרות
            </Badge>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {format(submission.updatedAt, 'dd/MM HH:mm')}
            </div>
            <div className="text-gray-400 text-sm">
              {isExpanded ? '▼' : '▶'}
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-4">
            <div className="grid grid-cols-7 gap-3">
              {WEEKDAYS_HE.map((dayName, index) => {
                const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][index];
                const daySlots = submission.days[dayKey] || [];
                
                return (
                  <div key={dayKey} className="text-center">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      {dayName}
                    </div>
                    <div className="space-y-1">
                      {daySlots.length > 0 ? (
                        daySlots.map((slot, slotIndex) => (
                          <Badge 
                            key={slotIndex}
                            variant="outline" 
                            className="text-xs bg-green-50 text-green-800 border-green-200 block w-full text-center"
                          >
                            {getSlotDisplayText(slot)}
                          </Badge>
                        ))
                      ) : (
                        <div className="text-gray-400 text-xs">—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}