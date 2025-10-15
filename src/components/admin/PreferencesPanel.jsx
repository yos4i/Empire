import React, { useState } from 'react';
import { Search, Calendar, User, Clock, CheckCircle } from 'lucide-react';
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
  loading,
  soldierShiftCounts = {},
  users = {},
  isDragging = false,
  onSelectSoldier,
  selectedSoldierId
}) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredSubmissions = submissions.filter(sub => {
    const nameMatch = sub.userName?.toLowerCase().includes(searchTerm.toLowerCase());
    const idMatch = sub.userId?.includes(searchTerm);
    return nameMatch || idMatch;
  });

  // Filter submissions that have any preferences
  const submissionsWithPrefs = filteredSubmissions.filter(sub => {
    return Object.values(sub.days || {}).some(dayShifts => dayShifts && dayShifts.length > 0);
  });
  const submissionsWithoutPrefs = filteredSubmissions.filter(sub => !hasAnyPreferences(sub));

  return (
    <div
      className="w-[480px] bg-white border-r border-gray-200 h-full flex flex-col flex-shrink-0"
      dir="rtl"
    >
        {/* Header */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
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
        </div>

        {/* Controls */}
        <div className="border-b border-gray-200 p-4">
          <div className="relative mb-3">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="חיפוש לפי שם..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>סה״כ: {filteredSubmissions.length}</span>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
              הגישו: {submissionsWithPrefs.length}
            </Badge>
            <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
              לא: {submissionsWithoutPrefs.length}
            </Badge>
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
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800 text-xs">
                      הגישו העדפות ({submissionsWithPrefs.length})
                    </Badge>
                  </h3>

                  <div className="space-y-4">
                    {submissionsWithPrefs.map((submission, index) => (
                      <SubmissionCard
                        key={submission.id}
                        submission={submission}
                        index={index}
                        soldierShiftCounts={soldierShiftCounts}
                        users={users}
                        onSelectSoldier={onSelectSoldier}
                        selectedSoldierId={selectedSoldierId}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Submissions without preferences */}
              {submissionsWithoutPrefs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Badge className="bg-red-100 text-red-800 text-xs">
                      לא הגישו ({submissionsWithoutPrefs.length})
                    </Badge>
                  </h3>

                  <div className="space-y-2">
                    {submissionsWithoutPrefs.map(submission => (
                      <div key={submission.id} className="bg-red-50 border border-red-200 rounded-lg p-2">
                        <div className="text-sm font-medium text-gray-900">{submission.userName}</div>
                        <div className="text-xs text-red-600">לא הגיש העדפות</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );
}

function SubmissionCard({ submission, index, soldierShiftCounts, users, onSelectSoldier, selectedSoldierId }) {
  const [isExpanded, setIsExpanded] = useState(false);

  console.log('Rendering submission:', submission);

  // Calculate total shifts
  const totalShifts = Object.values(submission.days || {}).reduce((total, dayShifts) =>
    total + (dayShifts?.length || 0), 0);

  const shiftCount = soldierShiftCounts[submission.userId] || 0;
  const soldier = users[submission.userId];
  const isSelected = selectedSoldierId === submission.userId;

  const draggableId = `${submission.userId}|preferences`;
  console.log('Creating draggable with ID:', draggableId, 'at index:', index);

  const handleCardClick = () => {
    // Both select soldier AND expand preferences
    if (onSelectSoldier) {
      onSelectSoldier(submission.userId);
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={`
        bg-white border-2 rounded-lg shadow-sm overflow-hidden transition-all cursor-pointer
        ${isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300' : 'border-gray-200 hover:border-blue-300'}
      `}
      onClick={handleCardClick}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">{submission.userName}</div>
                <div className="text-xs text-gray-500 truncate">
                  {soldier?.unit?.replace('_', ' ') || submission.userId}
                </div>
              </div>
              <div className="text-gray-400 flex-shrink-0 p-2">
                <div className="text-2xl leading-none">
                  {isExpanded ? '▼' : '▶'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                {totalShifts} העדפות
              </Badge>
              {shiftCount > 0 && (
                <Badge variant="outline" className={`text-xs
                  ${shiftCount <= 3 ? 'bg-green-50 text-green-700' : ''}
                  ${shiftCount > 3 && shiftCount <= 6 ? 'bg-yellow-50 text-yellow-700' : ''}
                  ${shiftCount > 6 ? 'bg-red-50 text-red-700' : ''}
                `}>
                  {shiftCount} משובץ
                </Badge>
              )}
              {isSelected && (
                <Badge className="text-xs bg-blue-600 text-white">
                  ✓ נבחר - לחץ על משמרת
                </Badge>
              )}
            </div>
          </div>

      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-3">
            {/* Days List - Vertical */}
            <div className="space-y-2">
              {[
                { key: 'sunday', name: 'ראשון' },
                { key: 'monday', name: 'שני' },
                { key: 'tuesday', name: 'שלישי' },
                { key: 'wednesday', name: 'רביעי' },
                { key: 'thursday', name: 'חמישי' },
                { key: 'friday', name: 'שישי' },
                { key: 'saturday', name: 'שבת' }
              ].map(({ key, name }) => {
                const daySlots = submission.days?.[key] || [];

                return (
                  <div key={key} className="flex items-start gap-2 border-b border-gray-200 pb-2 last:border-b-0">
                    <div className="text-sm font-semibold text-gray-700 min-w-[60px]">
                      {name}
                    </div>
                    <div className="flex flex-wrap gap-1 flex-1">
                      {daySlots.length > 0 ? (
                        daySlots.map((slot, idx) => (
                          <Badge
                            key={idx}
                            className="text-xs bg-green-100 text-green-800 border-green-300"
                          >
                            {slot}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
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