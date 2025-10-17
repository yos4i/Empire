// src/services/shiftTypes.js
// Clean, organized shift type management service

import {
  collection,
  doc,
  getDocs,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Shift Type Structure:
 * {
 *   id: "kiryat_hinuch_morning",
 *   name_he: "ק.חינוך בוקר",
 *   name_en: "kiryat_hinuch_morning",
 *   type: "morning", // morning, evening, borders
 *   category: "kiryat_hinuch", // kiryat_hinuch or borders
 *   defaultStartTime: "07:00",
 *   defaultEndTime: "14:30",
 *   required: 18,
 *   order: 1
 * }
 *
 * Weekly Shift Hours Structure (stored in weekly_shift_hours/{week_start}):
 * {
 *   week_start: "2025-10-19",
 *   shifts: {
 *     sunday: {
 *       kiryat_hinuch_morning: { startTime: "07:00", endTime: "14:30" },
 *       kiryat_hinuch_evening: { startTime: "15:30", endTime: "19:30" },
 *       borders: { startTime: "07:00", endTime: "15:30" }
 *     },
 *     monday: { ... },
 *     // ... for each day
 *   }
 * }
 */

class ShiftTypesService {
  constructor() {
    this.shiftTypes = [];
    this.listeners = [];
  }

  // Default shift types (initialized once)
  static defaultShiftTypes = [
    {
      id: 'kiryat_hinuch_morning',
      name_he: 'ק.חינוך בוקר',
      name_en: 'kiryat_hinuch_morning',
      type: 'morning',
      category: 'kiryat_hinuch',
      defaultStartTime: '07:00',
      defaultEndTime: '14:30',
      required: 18,
      order: 1
    },
    {
      id: 'kiryat_hinuch_evening',
      name_he: 'ק.חינוך ערב',
      name_en: 'kiryat_hinuch_evening',
      type: 'evening',
      category: 'kiryat_hinuch',
      defaultStartTime: '15:30',
      defaultEndTime: '19:30',
      required: 6,
      order: 2
    },
    {
      id: 'borders',
      name_he: 'גבולות בוקר',
      name_en: 'borders',
      type: 'borders',
      category: 'borders',
      defaultStartTime: '07:00',
      defaultEndTime: '15:30',
      required: 6,
      isLong: true,
      order: 3
    }
  ];

  // Initialize shift types in database
  async initializeShiftTypes() {
    try {
      console.log('ShiftTypesService: Initializing shift types...');

      const shiftTypesRef = collection(db, 'shift_types');
      const snapshot = await getDocs(shiftTypesRef);

      if (snapshot.empty) {
        console.log('ShiftTypesService: No shift types found, creating defaults...');

        for (const shiftType of ShiftTypesService.defaultShiftTypes) {
          await setDoc(doc(db, 'shift_types', shiftType.id), {
            ...shiftType,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        console.log('✅ ShiftTypesService: Default shift types created');
      } else {
        console.log('✅ ShiftTypesService: Shift types already exist');
      }
    } catch (error) {
      console.error('❌ ShiftTypesService: Error initializing shift types:', error);
      throw error;
    }
  }

  // Get all shift types
  async getShiftTypes() {
    try {
      const shiftTypesRef = collection(db, 'shift_types');
      const q = query(shiftTypesRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);

      const shiftTypes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      this.shiftTypes = shiftTypes;
      return shiftTypes;
    } catch (error) {
      console.error('❌ ShiftTypesService: Error fetching shift types:', error);
      return ShiftTypesService.defaultShiftTypes;
    }
  }

  // Subscribe to shift types changes
  subscribeToShiftTypes(callback) {
    try {
      const shiftTypesRef = collection(db, 'shift_types');
      const q = query(shiftTypesRef, orderBy('order', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const shiftTypes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        this.shiftTypes = shiftTypes;
        callback(shiftTypes);
      });

      this.listeners.push(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('❌ ShiftTypesService: Error subscribing to shift types:', error);
      throw error;
    }
  }

  // Get weekly shift hours for a specific week
  async getWeeklyShiftHours(weekStart) {
    try {
      const docRef = doc(db, 'weekly_shift_hours', weekStart);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data();
      }

      // Return default hours if not found
      return this.createDefaultWeeklyHours(weekStart);
    } catch (error) {
      console.error('❌ ShiftTypesService: Error fetching weekly shift hours:', error);
      return this.createDefaultWeeklyHours(weekStart);
    }
  }

  // Subscribe to weekly shift hours
  subscribeToWeeklyShiftHours(weekStart, callback) {
    try {
      const docRef = doc(db, 'weekly_shift_hours', weekStart);

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data());
        } else {
          callback(this.createDefaultWeeklyHours(weekStart));
        }
      });

      this.listeners.push(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('❌ ShiftTypesService: Error subscribing to weekly shift hours:', error);
      throw error;
    }
  }

  // Create default weekly hours structure
  createDefaultWeeklyHours(weekStart) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const shifts = {};

    days.forEach(day => {
      shifts[day] = {};
      ShiftTypesService.defaultShiftTypes.forEach(shiftType => {
        shifts[day][shiftType.id] = {
          startTime: shiftType.defaultStartTime,
          endTime: shiftType.defaultEndTime
        };
      });
    });

    return {
      week_start: weekStart,
      shifts
    };
  }

  // Update shift hours for a specific day and shift
  async updateShiftHours(weekStart, day, shiftId, startTime, endTime) {
    try {
      console.log(`💾 Updating shift hours: ${weekStart} ${day} ${shiftId} ${startTime}-${endTime}`);

      const docRef = doc(db, 'weekly_shift_hours', weekStart);
      const docSnap = await getDoc(docRef);

      let weeklyData;
      if (docSnap.exists()) {
        weeklyData = docSnap.data();
      } else {
        weeklyData = this.createDefaultWeeklyHours(weekStart);
      }

      // Update the specific shift hours
      if (!weeklyData.shifts[day]) {
        weeklyData.shifts[day] = {};
      }
      weeklyData.shifts[day][shiftId] = { startTime, endTime };
      weeklyData.updatedAt = new Date();

      await setDoc(docRef, weeklyData);

      console.log('✅ Shift hours updated successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating shift hours:', error);
      throw error;
    }
  }

  // Get shift display label with hours
  getShiftLabel(shiftType, day, weeklyHours) {
    const hours = weeklyHours?.shifts?.[day]?.[shiftType.id];
    const startTime = hours?.startTime || shiftType.defaultStartTime;
    const endTime = hours?.endTime || shiftType.defaultEndTime;

    return `${shiftType.name_he} ${startTime}-${endTime}`;
  }

  // Cleanup all listeners
  cleanup() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];
  }
}

// Export singleton instance
export const shiftTypesService = new ShiftTypesService();

export default shiftTypesService;
