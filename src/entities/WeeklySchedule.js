import { db } from '../config/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';

export class WeeklySchedule {
  static async getCurrentWeek() {
    const weekStart = new Date().toISOString().split('T')[0];
    const schedules = await this.filter({ week_start: weekStart });
    return schedules.length > 0 ? schedules[0] : null;
  }

  static async getWeek(weekStart) {
    const schedules = await this.filter({ week_start: weekStart });
    return schedules.length > 0 ? schedules[0] : null;
  }

  static async create(data) {
    try {
      const docRef = await addDoc(collection(db, 'weekly_schedules'), {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error("❌ Error creating weekly schedule:", error);
      throw error;
    }
  }

  static async update(id, data) {
    try {
      const docRef = doc(db, 'weekly_schedules', id);
      await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp()
      });
      return Promise.resolve();
    } catch (error) {
      console.error("❌ Error updating weekly schedule:", error);
      throw error;
    }
  }

  static async publish(id) {
    return this.update(id, { is_published: true, published_at: serverTimestamp() });
  }

  static async getShiftCoverage(weekStart) {
    return { total_shifts: 21, covered_shifts: 18, uncovered_shifts: 3, coverage_percentage: 85.7 };
  }

  static async filter(filters) {
    try {
      let q = collection(db, 'weekly_schedules');

      if (filters.week_start) {
        q = query(q, where('week_start', '==', filters.week_start));
      }

      const snapshot = await getDocs(q);
      const schedules = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return schedules;
    } catch (error) {
      console.error("Error filtering weekly schedules:", error);
      return [];
    }
  }

  static async delete(id) {
    try {
      await deleteDoc(doc(db, 'weekly_schedules', id));
      return Promise.resolve();
    } catch (error) {
      console.error("Error deleting weekly schedule:", error);
      throw error;
    }
  }
}


