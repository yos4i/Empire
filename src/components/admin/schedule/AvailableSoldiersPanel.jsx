import React, { useState } from 'react';
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { User, Search, Clock, AlertTriangle, Shield, Car, Filter } from 'lucide-react';

export default function AvailableSoldiersPanel({ soldiers, users, assignedSoldierIds, soldierShiftCounts, submissions, day, shift, isOpen, onToggle }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnit, setFilterUnit] = useState('הכל');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

  // Convert soldiers array to work with our structure
  const allSoldiers = soldiers || Object.values(users || {}).filter(u => u.role === 'soldier' || u.role === 'user');

  const filteredSoldiers = allSoldiers.filter(soldier => {
    if (!soldier) return false;
    
    // Search filter
    const matchesSearch = (soldier.hebrew_name || soldier.displayName || soldier.full_name || '')
      .toLowerCase().includes(searchTerm.toLowerCase()) || 
      (soldier.personal_number || '').includes(searchTerm);
    
    // Unit filter
    const matchesUnit = filterUnit === 'הכל' || soldier.unit === filterUnit;
    
    // Availability filter (if enabled, only show soldiers not already assigned many shifts)
    const isAvailable = !showOnlyAvailable || (soldierShiftCounts[soldier.id] || 0) < 6;
    
    return matchesSearch && matchesUnit && isAvailable && soldier.is_active;
  });

  const getSoldierStatusColor = (soldier) => {
    const shiftCount = soldierShiftCounts[soldier.id] || 0;
    if (shiftCount === 0) return 'bg-green-100 border-green-200';
    if (shiftCount <= 3) return 'bg-yellow-100 border-yellow-200';
    if (shiftCount <= 6) return 'bg-orange-100 border-orange-200';
    return 'bg-red-100 border-red-200';
  };

  const getAvailableUnits = () => {
    const units = [...new Set(allSoldiers.map(s => s.unit).filter(Boolean))];
    return ['הכל', ...units];
  };

  const renderSoldierCard = (soldier, index) => {
    const shiftCount = soldierShiftCounts[soldier.id] || 0;
    const isOverworked = shiftCount > 6;
    const isAssigned = assignedSoldierIds.has(soldier.id);

    return (
      <div
        key={soldier.id}
        className={`
          p-3 mb-2 rounded-lg border transition-all shadow-sm
          ${getSoldierStatusColor(soldier)}
          ${isAssigned ? 'opacity-60' : ''}
          hover:shadow-md
        `}
      >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-gray-900 text-sm">
                  {soldier.hebrew_name || soldier.displayName || soldier.full_name}
                </span>
              </div>
              {isOverworked && (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span>{soldier.rank || 'לא ידוע'}</span>
                <span>•</span>
                <span>{(soldier.unit || '').replace('_', ' ')}</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span>מ.א: {soldier.personal_number || 'לא ידוע'}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-500">
                    {shiftCount} משמרות השבוע
                  </span>
                </div>

                <div className="flex gap-1">
                  {soldier.is_driver && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      <Car className="w-3 h-3" />
                    </Badge>
                  )}
                  {soldier.rank?.includes('סמל') && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      <Shield className="w-3 h-3" />
                    </Badge>
                  )}
                </div>
              </div>

              {isAssigned && (
                <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                  כבר משובץ לסידור
                </div>
              )}

              {/* Show soldier's shift preferences */}
              {submissions[soldier.id] && Object.keys(submissions[soldier.id]).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center gap-1 mb-1">
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                      רוצה לעבוד
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600 max-h-16 overflow-y-auto">
                    {Object.entries(submissions[soldier.id]).map(([day, dayShifts]) => (
                      dayShifts && dayShifts.length > 0 && (
                        <div key={day} className="mb-1">
                          <span className="font-medium">{day}:</span> {dayShifts.join(', ')}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">חיילים זמינים</h3>
          <Badge variant="outline" className="ml-auto">
            {filteredSoldiers.length}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="חיפוש חייל..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 text-sm"
          />
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="w-full px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {getAvailableUnits().map(unit => (
              <option key={unit} value={unit}>
                {unit === 'הכל' ? 'כל היחידות' : unit.replace('_', ' ')}
              </option>
            ))}
          </select>

          <Button
            variant={showOnlyAvailable ? "default" : "outline"}
            size="sm"
            className="w-full text-xs"
            onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
          >
            <Filter className="w-3 h-3 ml-1" />
            {showOnlyAvailable ? 'הצג הכל' : 'רק זמינים'}
          </Button>
        </div>
      </div>

      {/* Soldiers List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="min-h-full">
          {filteredSoldiers.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">אין חיילים מתאימים</p>
              <p className="text-xs text-gray-400">נסה לשנות את תנאי החיפוש</p>
            </div>
          ) : (
            <>
              {filteredSoldiers.map((soldier, index) =>
                renderSoldierCard(soldier, index)
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 border-t bg-gray-50 text-xs text-gray-600">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="font-medium">סה״כ חיילים:</span>
            <span className="ml-1">{allSoldiers.length}</span>
          </div>
          <div>
            <span className="font-medium">זמינים:</span>
            <span className="ml-1">{filteredSoldiers.length}</span>
          </div>
          <div>
            <span className="font-medium">משובצים:</span>
            <span className="ml-1">{assignedSoldierIds.size}</span>
          </div>
          <div>
            <span className="font-medium">עמוסים (6+):</span>
            <span className="ml-1">
              {Object.values(soldierShiftCounts).filter(count => count > 6).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


