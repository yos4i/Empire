import React, { useState } from 'react';
import { X, User, Search, Check, Plus, Minus } from 'lucide-react';
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";

export default function AssignSoldierDialog({ isOpen, onClose, shiftInfo, allSoldiers, assignedSoldiers = [], onToggleAssign }) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen || !shiftInfo) return null;

  const filteredSoldiers = allSoldiers.filter(soldier => {
    if (!soldier) return false;
    const name = soldier.hebrew_name || soldier.displayName || soldier.full_name || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (soldier.personal_number || '').includes(searchTerm);
  });

  const isAssigned = (soldierId) => assignedSoldiers.includes(soldierId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-white rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              שיבוץ חיילים למשמרת
            </h2>
            <p className="text-gray-600 mt-1">
              {shiftInfo.dayName} - {shiftInfo.shiftName}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClose}
            className="p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-6 border-b">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="חיפוש חייל..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        {/* Current Assignment Summary */}
        <div className="p-6 bg-gray-50 border-b">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-600">משובצים כרגע: </span>
              <Badge variant="outline">
                {assignedSoldiers.length}
              </Badge>
            </div>
            {assignedSoldiers.length > 0 && (
              <div className="text-sm text-gray-600">
                {allSoldiers
                  .filter(s => assignedSoldiers.includes(s.id))
                  .map(s => s.hebrew_name || s.displayName || s.full_name)
                  .join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Soldiers List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-2">
            {filteredSoldiers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>אין חיילים מתאימים</p>
              </div>
            ) : (
              filteredSoldiers.map(soldier => {
                const assigned = isAssigned(soldier.id);
                
                return (
                  <div
                    key={soldier.id}
                    className={`
                      p-4 rounded-lg border transition-all cursor-pointer
                      ${assigned 
                        ? 'bg-blue-50 border-blue-200 shadow-sm' 
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                      }
                    `}
                    onClick={() => onToggleAssign(soldier.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-6 h-6 rounded border-2 flex items-center justify-center
                          ${assigned 
                            ? 'bg-blue-600 border-blue-600' 
                            : 'border-gray-300'
                          }
                        `}>
                          {assigned && <Check className="w-4 h-4 text-white" />}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-gray-900">
                              {soldier.hebrew_name || soldier.displayName || soldier.full_name}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span>{soldier.rank || 'לא ידוע'}</span>
                            <span className="mx-2">•</span>
                            <span>{(soldier.unit || '').replace('_', ' ')}</span>
                            <span className="mx-2">•</span>
                            <span>מ.א: {soldier.personal_number || 'לא ידוע'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={assigned ? "destructive" : "default"}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleAssign(soldier.id);
                          }}
                        >
                          {assigned ? (
                            <>
                              <Minus className="w-4 h-4 ml-1" />
                              הסר
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 ml-1" />
                              הוסף
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            נבחרו {assignedSoldiers.length} חיילים למשמרת
          </div>
          <Button onClick={onClose}>
            סגור
          </Button>
        </div>
      </Card>
    </div>
  );
}


