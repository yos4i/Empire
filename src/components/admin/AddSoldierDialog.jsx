import React, { useState } from 'react';
import { X, User, Lock, Users, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';

export default function AddSoldierDialog({ isOpen, onClose, onAddSoldier }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    rank: '',
    unit: 'קריית_חינוך',
    personal_number: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'שם משתמש נדרש';
    } else if (formData.username.length < 3) {
      newErrors.username = 'שם משתמש חייב להכיל לפחות 3 תווים';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'סיסמה נדרשת';
    }

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'שם מלא נדרש';
    }

    if (!formData.personal_number.trim()) {
      newErrors.personal_number = 'מספר אישי נדרש';
    }

    if (!formData.rank.trim()) {
      newErrors.rank = 'דרגה נדרשת';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      console.log('Adding soldier with data:', formData);
      await onAddSoldier(formData);
      console.log('Soldier added successfully');
      setFormData({
        username: '',
        password: '',
        displayName: '',
        rank: '',
        unit: 'קריית_חינוך',
        personal_number: ''
      });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Error adding soldier:', error);
      setErrors({ submit: error.message || 'שגיאה ביצירת החייל' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">הוסף חייל חדש</h2>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClose}
            className="p-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-red-700 text-sm">{errors.submit}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              שם משתמש
            </Label>
            <Input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              placeholder="הכנס שם משתמש"
              className={errors.username ? 'border-red-500' : ''}
            />
            {errors.username && <p className="text-red-500 text-sm">{errors.username}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              סיסמה
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="הכנס סיסמה"
              className={errors.password ? 'border-red-500' : ''}
            />
            {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">שם מלא</Label>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="הכנס שם מלא"
              className={errors.displayName ? 'border-red-500' : ''}
            />
            {errors.displayName && <p className="text-red-500 text-sm">{errors.displayName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="personal_number">מספר אישי</Label>
            <Input
              id="personal_number"
              name="personal_number"
              type="text"
              value={formData.personal_number}
              onChange={handleChange}
              placeholder="הכנס מספר אישי"
              className={errors.personal_number ? 'border-red-500' : ''}
            />
            {errors.personal_number && <p className="text-red-500 text-sm">{errors.personal_number}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rank">דרגה</Label>
            <select
              id="rank"
              name="rank"
              value={formData.rank}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md ${errors.rank ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">בחר דרגה</option>
              <option value="טוראי">טוראי</option>
              <option value="רב-טוראי">רב-טוראי</option>
              <option value="סמל">סמל</option>
              <option value="סמל ראשון">סמל ראשון</option>
              <option value="רב-סמל">רב-סמל</option>
              <option value="סגן משנה">סגן משנה</option>
            </select>
            {errors.rank && <p className="text-red-500 text-sm">{errors.rank}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">יחידה</Label>
            <select
              id="unit"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="קריית_חינוך">קריית חינוך</option>
              <option value="גבולות">גבולות</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'יוצר...' : 'צור חייל'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={loading}
            >
              ביטול
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}