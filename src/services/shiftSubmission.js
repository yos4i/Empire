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
  static async submitPreferences(userId, userName, weekStart, preferences, longShiftDays = {}) {
    try {
      console.log('ShiftSubmissionService: Submitting preferences for user:', userId);
      console.log('ShiftSubmissionService: Week:', weekStart);
      console.log('ShiftSubmissionService: Preferences:', preferences);
      console.log('ShiftSubmissionService: Long shift days:', longShiftDays);

      // Create a unique document ID based on user and week
      const docId = `${userId}_${weekStart}`;

      const submissionData = {
        userId: userId,
        weekStart: weekStart,
        days: preferences, // Object with days as keys and shift arrays as values
        longShiftDays: longShiftDays, // Store which days have long shift preference
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
}

export default ShiftSubmissionService;