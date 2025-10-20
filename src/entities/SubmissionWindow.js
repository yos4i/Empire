import { db } from '../config/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';

/**
 * SubmissionWindow Entity
 * Tracks which weeks are open or closed for shift preference submissions
 */
export class SubmissionWindow {
  /**
   * Get all submission windows
   */
  static async list() {
    try {
      const snapshot = await getDocs(collection(db, 'submission_windows'));
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('SubmissionWindow.list: Error loading:', error);
      return [];
    }
  }

  /**
   * Get submission window for a specific week
   * @param {string} weekStart - Week start date (YYYY-MM-DD)
   */
  static async getWeek(weekStart) {
    try {
      const q = query(
        collection(db, 'submission_windows'),
        where('week_start', '==', weekStart)
      );
      const snapshot = await getDocs(q);

      if (snapshot.docs.length === 0) {
        return null;
      }

      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };
    } catch (error) {
      console.error('SubmissionWindow.getWeek: Error loading:', error);
      return null;
    }
  }

  /**
   * Check if a week is open for submissions
   * @param {string} weekStart - Week start date (YYYY-MM-DD)
   * @returns {boolean} - true if open, false if closed or not found
   */
  static async isWeekOpen(weekStart) {
    try {
      const window = await this.getWeek(weekStart);

      // If no window exists, consider it closed by default
      if (!window) {
        return false;
      }

      return window.is_open === true;
    } catch (error) {
      console.error('SubmissionWindow.isWeekOpen: Error checking:', error);
      return false;
    }
  }

  /**
   * Open a week for submissions
   * @param {string} weekStart - Week start date (YYYY-MM-DD)
   */
  static async openWeek(weekStart) {
    try {
      const existing = await this.getWeek(weekStart);

      if (existing) {
        // Update existing window
        await updateDoc(doc(db, 'submission_windows', existing.id), {
          is_open: true,
          opened_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        console.log('SubmissionWindow.openWeek: Opened week', weekStart);
      } else {
        // Create new window
        await addDoc(collection(db, 'submission_windows'), {
          week_start: weekStart,
          is_open: true,
          opened_at: serverTimestamp(),
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        console.log('SubmissionWindow.openWeek: Created and opened week', weekStart);
      }

      return true;
    } catch (error) {
      console.error('SubmissionWindow.openWeek: Error:', error);
      throw error;
    }
  }

  /**
   * Close a week for submissions
   * @param {string} weekStart - Week start date (YYYY-MM-DD)
   */
  static async closeWeek(weekStart) {
    try {
      const existing = await this.getWeek(weekStart);

      if (existing) {
        // Update existing window
        await updateDoc(doc(db, 'submission_windows', existing.id), {
          is_open: false,
          closed_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        console.log('SubmissionWindow.closeWeek: Closed week', weekStart);
      } else {
        // Create new window as closed
        await addDoc(collection(db, 'submission_windows'), {
          week_start: weekStart,
          is_open: false,
          closed_at: serverTimestamp(),
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        console.log('SubmissionWindow.closeWeek: Created and closed week', weekStart);
      }

      return true;
    } catch (error) {
      console.error('SubmissionWindow.closeWeek: Error:', error);
      throw error;
    }
  }

  /**
   * Toggle a week's submission status
   * @param {string} weekStart - Week start date (YYYY-MM-DD)
   */
  static async toggleWeek(weekStart) {
    try {
      const existing = await this.getWeek(weekStart);

      if (existing) {
        const newStatus = !existing.is_open;
        await updateDoc(doc(db, 'submission_windows', existing.id), {
          is_open: newStatus,
          [newStatus ? 'opened_at' : 'closed_at']: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        console.log('SubmissionWindow.toggleWeek: Toggled week', weekStart, 'to', newStatus ? 'open' : 'closed');
        return newStatus;
      } else {
        // Create new window as open by default
        await addDoc(collection(db, 'submission_windows'), {
          week_start: weekStart,
          is_open: true,
          opened_at: serverTimestamp(),
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        console.log('SubmissionWindow.toggleWeek: Created and opened week', weekStart);
        return true;
      }
    } catch (error) {
      console.error('SubmissionWindow.toggleWeek: Error:', error);
      throw error;
    }
  }

  /**
   * Delete a submission window
   * @param {string} id - Window ID
   */
  static async delete(id) {
    try {
      await deleteDoc(doc(db, 'submission_windows', id));
      console.log('SubmissionWindow.delete: Deleted window', id);
    } catch (error) {
      console.error('SubmissionWindow.delete: Error:', error);
      throw error;
    }
  }
}
