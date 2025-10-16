import React, { useState } from 'react';
import { Search, Calendar, User, Shield } from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import {
  hasAnyPreferences
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
      className="w-[240px] bg-white border-r border-gray-200 h-full flex flex-col flex-shrink-0"
      dir="rtl"
    >
        {/* Header */}
        <div className="border-b border-gray-200 p-3">
          <div className="flex flex-col items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div className="text-center">
              <h2 className="text-base font-bold text-gray-900">
                העדפות חיילים
              </h2>
              <p className="text-xs text-gray-600">
                {format(new Date(weekStart), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="border-b border-gray-200 p-2">
          <div className="relative mb-2">
            <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
            <Input
              placeholder="חיפוש..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-7 text-xs h-8"
            />
          </div>
          <div className="flex flex-col gap-1 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                סה״כ: {filteredSubmissions.length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <Badge variant="outline" className="bg-green-50 text-green-700 text-xs flex-1 justify-center">
                ✓ {submissionsWithPrefs.length}
              </Badge>
              <Badge variant="outline" className="bg-red-50 text-red-700 text-xs flex-1 justify-center">
                ✗ {submissionsWithoutPrefs.length}
              </Badge>
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
            <div className="p-2">
              {/* Submissions with preferences */}
              {submissionsWithPrefs.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-900 mb-2 text-center">
                    <Badge className="bg-green-100 text-green-800 text-xs w-full justify-center">
                      הגישו ({submissionsWithPrefs.length})
                    </Badge>
                  </h3>

                  <div className="space-y-2">
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
                  <h3 className="text-xs font-semibold text-gray-900 mb-2 text-center">
                    <Badge className="bg-red-100 text-red-800 text-xs w-full justify-center">
                      לא הגישו ({submissionsWithoutPrefs.length})
                    </Badge>
                  </h3>

                  <div className="space-y-1">
                    {submissionsWithoutPrefs.map(submission => (
                      <div key={submission.id} className="bg-red-50 border border-red-200 rounded p-1.5">
                        <div className="text-xs font-medium text-gray-900 truncate">{submission.userName}</div>
                        <div className="text-xs text-red-600">לא הגיש</div>
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
        bg-white border-2 rounded shadow-sm overflow-hidden transition-all cursor-pointer
        ${isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300' : 'border-gray-200 hover:border-blue-300'}
      `}
      onClick={handleCardClick}
    >
      <div className="p-2">
        <div className="flex items-center gap-1 mb-1.5">
          <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs text-gray-900 truncate">{submission.userName}</div>
                <div className="text-xs text-gray-500 truncate">
                  {soldier?.unit?.replace('_', ' ') || ''}
                </div>
              </div>
              <div className="text-gray-400 flex-shrink-0">
                <div className="text-sm leading-none">
                  {isExpanded ? '▼' : '▶'}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs justify-center">
                {totalShifts} העדפות
              </Badge>
              {shiftCount > 0 && (
                <Badge variant="outline" className={`text-xs justify-center
                  ${shiftCount <= 3 ? 'bg-green-50 text-green-700' : ''}
                  ${shiftCount > 3 && shiftCount <= 6 ? 'bg-yellow-50 text-yellow-700' : ''}
                  ${shiftCount > 6 ? 'bg-red-50 text-red-700' : ''}
                `}>
                  {shiftCount} משובץ
                </Badge>
              )}
              {isSelected && (
                <Badge className="text-xs bg-blue-600 text-white justify-center">
                  ✓ לחץ על משמרת
                </Badge>
              )}
            </div>
          </div>

      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-2">
            {/* Equipment Section */}
            {soldier?.equipment && (
              <div className="mb-2 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-1 mb-1">
                  <Shield className="w-3 h-3 text-purple-600" />
                  <span className="text-xs font-bold text-gray-700">ציוד:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {soldier.equipment.vest && (
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                      ווסט
                    </Badge>
                  )}
                  {soldier.equipment.helmet && (
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                      קסדה
                    </Badge>
                  )}
                  {soldier.equipment.radio && (
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                      קשר
                    </Badge>
                  )}
                  {soldier.equipment.weapon && (
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                      נשק
                    </Badge>
                  )}
                  {!soldier.equipment.vest && !soldier.equipment.helmet && !soldier.equipment.radio && !soldier.equipment.weapon && (
                    <span className="text-xs text-gray-400">לא דווח</span>
                  )}
                </div>
              </div>
            )}

            {/* Days List - Vertical */}
            <div className="space-y-1">
              {[
                { key: 'sunday', name: 'א׳' },
                { key: 'monday', name: 'ב׳' },
                { key: 'tuesday', name: 'ג׳' },
                { key: 'wednesday', name: 'ד׳' },
                { key: 'thursday', name: 'ה׳' },
                { key: 'friday', name: 'ו׳' },
                { key: 'saturday', name: 'ש׳' }
              ].map(({ key, name }) => {
                const daySlots = submission.days?.[key] || [];

                return (
                  <div key={key} className="flex items-start gap-1 border-b border-gray-200 pb-1 last:border-b-0">
                    <div className="text-xs font-bold text-gray-700 min-w-[20px]">
                      {name}
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1">
                      {daySlots.length > 0 ? (
                        daySlots.map((slot, idx) => (
                          <Badge
                            key={idx}
                            className="text-xs bg-green-100 text-green-800 border-green-300 justify-center"
                          >
                            {slot}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 text-center">—</span>
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