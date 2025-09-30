import { db } from '../config/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';

export class ShiftSubmission {
  static async list() {
    try {
      const submissionsSnapshot = await getDocs(collection(db, 'shift_submissions'));
      return submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('ShiftSubmission.list: Error loading:', error);
      return [];
    }
  }

  static async filter(filters) {
    try {
      console.log("ShiftSubmission.filter: Filtering with:", filters);
      let q = collection(db, 'shift_submissions');
      
      if (filters.user_id) {
        q = query(q, where('uid', '==', filters.user_id)); // Use uid for querying
      }
      if (filters.week_start) {
        q = query(q, where('week_start', '==', filters.week_start));
      }
      
      const submissionsSnapshot = await getDocs(q);
      const results = submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log("ShiftSubmission.filter: Found submissions:", results);
      return results;
    } catch (error) {
      console.error('ShiftSubmission.filter: Error filtering:', error);
      return [];
    }
  }

  static async create(data) {
    try {
      console.log("ShiftSubmission.create: Creating submission:", data);
      
      // Prepare data with server timestamp
      const submissionData = {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      
      // Store submission in both places:
      // 1. In shift_submissions collection (for admin queries)
      const docRef = await addDoc(collection(db, 'shift_submissions'), submissionData);
      console.log("ShiftSubmission.create: Successfully created in shift_submissions with ID:", docRef.id);
      
      // 2. In user document (for easier access) - use uid for consistent identification
      if (data.uid) {
        try {
          const userDoc = doc(db, 'users', data.uid);
          const weeklyShifts = {};
          weeklyShifts[`weekly_shifts.${data.week_start}`] = {
            shifts: data.shifts,
            submitted_at: serverTimestamp()
          };
          
          await updateDoc(userDoc, weeklyShifts);
          console.log("ShiftSubmission.create: Also saved to user document:", data.uid);
        } catch (userError) {
          console.error('ShiftSubmission.create: Error updating user document:', userError);
          // Continue even if user update fails
        }
      }
      
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error('ShiftSubmission.create: Error creating:', error);
      throw error;
    }
  }

  static async update(id, data) {
    try {
      console.log("ShiftSubmission.update: Updating submission:", id, data);
      
      // Update in shift_submissions collection
      const docRef = doc(db, 'shift_submissions', id);
      await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp()
      });
      console.log("ShiftSubmission.update: Successfully updated in shift_submissions");
      
      // Also update in user document if we have uid - use uid for consistent identification
      if (data.uid && data.week_start) {
        try {
          const userDoc = doc(db, 'users', data.uid);
          const weeklyShifts = {};
          weeklyShifts[`weekly_shifts.${data.week_start}`] = {
            shifts: data.shifts,
            submitted_at: serverTimestamp()
          };
          
          await updateDoc(userDoc, weeklyShifts);
          console.log("ShiftSubmission.update: Also updated user document:", data.uid);
        } catch (userError) {
          console.error('ShiftSubmission.update: Error updating user document:', userError);
        }
      }
      
      return Promise.resolve();
    } catch (error) {
      console.error('ShiftSubmission.update: Error updating:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      console.log("ShiftSubmission.delete: Deleting submission:", id);
      await deleteDoc(doc(db, 'shift_submissions', id));
      console.log("ShiftSubmission.delete: Successfully deleted");
      return Promise.resolve();
    } catch (error) {
      console.error('ShiftSubmission.delete: Error deleting:', error);
      throw error;
    }
  }
}


