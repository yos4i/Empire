// src/services/shiftSubmission.js
import { 
  collection, 
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

export class ShiftSubmissionService {
  
  // Submit shift preferences for a soldier
  static async submitPreferences(userId, userName, weekStart, preferences, longShiftDays = {}, notes = '') {
    try {
      console.log('ShiftSubmissionService: Submitting preferences for user:', userId);
      console.log('ShiftSubmissionService: Week:', weekStart);
      console.log('ShiftSubmissionService: Preferences:', preferences);
      console.log('ShiftSubmissionService: Long shift days:', longShiftDays);
      console.log('ShiftSubmissionService: Notes:', notes);

      // Create a unique document ID based on user and week
      const docId = `${userId}_${weekStart}`;

      const submissionData = {
        userId: userId,
        weekStart: weekStart,
        days: preferences, // Object with days as keys and shift arrays as values
        longShiftDays: longShiftDays, // Store which days have long shift preference
        notes: notes || '', // Store soldier notes/comments
        updatedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        // Only include userName if it's defined
        ...(userName && { userName: userName })
      };

      // Use setDoc to create or update the document
      await setDoc(doc(db, 'shift_preferences', docId), submissionData);

      console.log('ShiftSubmissionService: Preferences saved successfully with long shift days');
      return { success: true, id: docId };

    } catch (error) {
      console.error('ShiftSubmissionService: Error submitting preferences:', error);
      throw error;
    }
  }
  
  // Get preferences for a specific soldier and week
  static async getPreferences(userId, weekStart) {
    try {
      console.log('ShiftSubmissionService: Getting preferences for:', userId, weekStart);
      
      const docId = `${userId}_${weekStart}`;
      const docRef = doc(db, 'shift_preferences', docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('ShiftSubmissionService: Found preferences:', data);
        return {
          id: docSnap.id,
          ...data,
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      } else {
        console.log('ShiftSubmissionService: No preferences found');
        return null;
      }
      
    } catch (error) {
      console.error('ShiftSubmissionService: Error getting preferences:', error);
      throw error;
    }
  }
  
  // Get all preferences for a specific week (admin use)
  static async getWeekPreferences(weekStart) {
    try {
      console.log('ShiftSubmissionService: Getting all preferences for week:', weekStart);
      
      const preferencesRef = collection(db, 'shift_preferences');
      const q = query(
        preferencesRef,
        where('weekStart', '==', weekStart)
      );
      
      const snapshot = await getDocs(q);
      const preferences = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      }));
      
      console.log('ShiftSubmissionService: Found preferences:', preferences.length);
      return preferences;
      
    } catch (error) {
      console.error('ShiftSubmissionService: Error getting week preferences:', error);
      throw error;
    }
  }
  
  // Check if a soldier has submitted preferences for a week
  static async hasSubmitted(userId, weekStart) {
    try {
      const preferences = await this.getPreferences(userId, weekStart);
      return preferences !== null;
    } catch (error) {
      console.error('ShiftSubmissionService: Error checking submission:', error);
      return false;
    }
  }
  
  // Get submission history for a soldier
  static async getSubmissionHistory(userId) {
    try {
      console.log('ShiftSubmissionService: Getting submission history for:', userId);

      const preferencesRef = collection(db, 'shift_preferences');
      const q = query(
        preferencesRef,
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      }));

      // Sort by week descending
      history.sort((a, b) => b.weekStart.localeCompare(a.weekStart));

      console.log('ShiftSubmissionService: Found history entries:', history.length);
      return history;

    } catch (error) {
      console.error('ShiftSubmissionService: Error getting submission history:', error);
      throw error;
    }
  }

  // ===== NEW: Day Off Request Methods =====

  /**
   * Submit a day-off request (one day per week)
   * @param {string} userId - User ID
   * @param {string} userName - User display name
   * @param {string} weekStart - Week start date (YYYY-MM-DD)
   * @param {string|null} dayOffRequest - The requested day off (e.g., "sunday", "monday", etc.) or null
   * @param {string} additionalNotes - Optional additional notes from soldier
   * @returns {Promise<{success: boolean, id: string}>}
   */
  static async submitDayOffRequest(userId, userName, weekStart, dayOffRequest, additionalNotes = '') {
    try {
      console.log('ShiftSubmissionService: Submitting day-off request for user:', userId);
      console.log('ShiftSubmissionService: Week:', weekStart);
      console.log('ShiftSubmissionService: Day off requested:', dayOffRequest);
      console.log('ShiftSubmissionService: Additional notes:', additionalNotes);

      const docId = `${userId}_${weekStart}`;

      // Build the notes field
      const dayNames = {
        sunday: 'ראשון',
        monday: 'שני',
        tuesday: 'שלישי',
        wednesday: 'רביעי',
        thursday: 'חמישי',
        friday: 'שישי',
        saturday: 'שבת'
      };

      let notes = '';
      if (dayOffRequest) {
        notes = `בקשה ליום חופש: יום ${dayNames[dayOffRequest]}`;
        if (additionalNotes.trim()) {
          notes += `\n\nהערות נוספות:\n${additionalNotes}`;
        }
      } else if (additionalNotes.trim()) {
        notes = additionalNotes;
      }

      const submissionData = {
        userId: userId,
        userName: userName || '',
        weekStart: weekStart,
        dayOffRequest: dayOffRequest || null,  // "sunday", "monday", etc. or null
        notes: notes,
        // Set old fields to null for backward compatibility
        days: null,
        longShiftDays: null,
        updatedAt: Timestamp.now(),
        createdAt: Timestamp.now()
      };

      await setDoc(doc(db, 'shift_preferences', docId), submissionData, { merge: true });

      console.log('ShiftSubmissionService: Day-off request saved successfully');
      return { success: true, id: docId };

    } catch (error) {
      console.error('ShiftSubmissionService: Error submitting day-off request:', error);
      throw error;
    }
  }

  /**
   * Get day-off request for a soldier
   * @param {string} userId - User ID
   * @param {string} weekStart - Week start date (YYYY-MM-DD)
   * @returns {Promise<{dayOffRequest: string|null, notes: string}|null>}
   */
  static async getDayOffRequest(userId, weekStart) {
    try {
      const preferences = await this.getPreferences(userId, weekStart);

      if (!preferences) return null;

      return {
        dayOffRequest: preferences.dayOffRequest || null,
        notes: preferences.notes || '',
        updatedAt: preferences.updatedAt
      };

    } catch (error) {
      console.error('ShiftSubmissionService: Error getting day-off request:', error);
      throw error;
    }
  }
}

export default ShiftSubmissionService;