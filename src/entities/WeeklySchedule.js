import { db } from '../config/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';

export class WeeklySchedule {
  static async getCurrentWeek() {
    const weekStart = new Date().toISOString().split('T')[0];
    const schedules = await this.filter({ week_start: weekStart });
    return schedules.length > 0 ? schedules[0] : null;
  }

  static async getWeek(weekStart) {
    console.log("Getting week:", weekStart);
    const schedules = await this.filter({ week_start: weekStart });
    return schedules.length > 0 ? schedules[0] : null;
  }

  static async create(data) {
    try {
      console.log("💾 Creating weekly schedule in Firestore:", data);
      const docRef = await addDoc(collection(db, 'weekly_schedules'), {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      console.log("✅ Weekly schedule created with ID:", docRef.id);
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error("❌ Error creating weekly schedule:", error);
      throw error;
    }
  }

  static async update(id, data) {
    try {
      console.log("💾 Updating weekly schedule in Firestore:", id, data);
      const docRef = doc(db, 'weekly_schedules', id);
      await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp()
      });
      console.log("✅ Weekly schedule updated successfully");
      return Promise.resolve();
    } catch (error) {
      console.error("❌ Error updating weekly schedule:", error);
      throw error;
    }
  }

  static async publish(id) {
    console.log("Publishing weekly schedule:", id);
    return this.update(id, { is_published: true, published_at: serverTimestamp() });
  }

  static async getShiftCoverage(weekStart) {
    console.log("Getting shift coverage for week:", weekStart);
    return { total_shifts: 21, covered_shifts: 18, uncovered_shifts: 3, coverage_percentage: 85.7 };
  }

  static async filter(filters) {
    try {
      console.log("Filtering weekly schedules:", filters);
      let q = collection(db, 'weekly_schedules');

      if (filters.week_start) {
        q = query(q, where('week_start', '==', filters.week_start));
      }

      const snapshot = await getDocs(q);
      const schedules = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log("Found schedules:", schedules);
      return schedules;
    } catch (error) {
      console.error("Error filtering weekly schedules:", error);
      return [];
    }
  }

  static async delete(id) {
    try {
      console.log("Deleting weekly schedule:", id);
      await deleteDoc(doc(db, 'weekly_schedules', id));
      console.log("Weekly schedule deleted successfully");
      return Promise.resolve();
    } catch (error) {
      console.error("Error deleting weekly schedule:", error);
      throw error;
    }
  }
}


