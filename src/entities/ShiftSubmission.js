import { db } from '../config/firebase';
import { collection, getDocs, addDoc, updateDoc, setDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';

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
      
      return results;
    } catch (error) {
      console.error('ShiftSubmission.filter: Error filtering:', error);
      return [];
    }
  }

  static async create(data) {
    try {
      
      // Prepare data with server timestamp
      const submissionData = {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      
      // Store submission in both places:
      // 1. In shift_submissions collection (for admin queries)
      const docRef = await addDoc(collection(db, 'shift_submissions'), submissionData);
      
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
      
      // Upsert in shift_submissions collection. setDoc with merge avoids the
      // "No document to update" error when the id points at a non-existent
      // doc (e.g. an id that actually belongs to the shift_preferences
      // collection), while still behaving like a partial update otherwise.
      const docRef = doc(db, 'shift_submissions', id);
      await setDoc(
        docRef,
        {
          ...data,
          updated_at: serverTimestamp()
        },
        { merge: true }
      );
      
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
      await deleteDoc(doc(db, 'shift_submissions', id));
      return Promise.resolve();
    } catch (error) {
      console.error('ShiftSubmission.delete: Error deleting:', error);
      throw error;
    }
  }
}


