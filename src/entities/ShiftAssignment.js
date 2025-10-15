import { db } from '../config/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

export class ShiftAssignment {
  static async list() {
    try {
      const assignmentsSnapshot = await getDocs(collection(db, 'shift_assignments'));
      return assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('ShiftAssignment.list: Error loading:', error);
      return [];
    }
  }

  static async filter(filters) {
    try {
      console.log("🔍 ShiftAssignment.filter: Filtering with:", filters);
      let q = collection(db, 'shift_assignments');

      if (filters.soldier_id) {
        q = query(q, where('soldier_id', '==', filters.soldier_id));
        console.log("📌 ShiftAssignment.filter: Added soldier_id filter:", filters.soldier_id);
      }
      if (filters.date) {
        q = query(q, where('date', '==', filters.date));
        console.log("📌 ShiftAssignment.filter: Added date filter:", filters.date);
      }
      if (filters.shift_type) {
        q = query(q, where('shift_type', '==', filters.shift_type));
        console.log("📌 ShiftAssignment.filter: Added shift_type filter:", filters.shift_type);
      }
      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
        console.log("📌 ShiftAssignment.filter: Added status filter:", filters.status);
      }
      if (filters.start_date && filters.end_date) {
        q = query(q, where('date', '>=', filters.start_date), where('date', '<=', filters.end_date));
        console.log("📌 ShiftAssignment.filter: Added date range:", filters.start_date, "to", filters.end_date);
      }

      // Try with orderBy first, fallback to no orderBy if it fails (missing index)
      try {
        q = query(q, orderBy('date', 'desc'), orderBy('created_at', 'desc'));
        console.log("🔎 ShiftAssignment.filter: Executing Firestore query with orderBy...");
        const assignmentsSnapshot = await getDocs(q);
        console.log("📊 ShiftAssignment.filter: Query returned", assignmentsSnapshot.docs.length, "documents");

        const results = assignmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log("✅ ShiftAssignment.filter: Processed results:", results);
        return results;
      } catch (orderByError) {
        console.warn("⚠️ ShiftAssignment.filter: orderBy failed (likely missing index), trying without orderBy:", orderByError.message);

        // Retry without orderBy
        q = collection(db, 'shift_assignments');

        if (filters.soldier_id) {
          q = query(q, where('soldier_id', '==', filters.soldier_id));
        }
        if (filters.date) {
          q = query(q, where('date', '==', filters.date));
        }
        if (filters.shift_type) {
          q = query(q, where('shift_type', '==', filters.shift_type));
        }
        if (filters.status) {
          q = query(q, where('status', '==', filters.status));
        }
        if (filters.start_date && filters.end_date) {
          q = query(q, where('date', '>=', filters.start_date), where('date', '<=', filters.end_date));
        }

        console.log("🔎 ShiftAssignment.filter: Executing Firestore query WITHOUT orderBy...");
        const assignmentsSnapshot = await getDocs(q);
        console.log("📊 ShiftAssignment.filter: Query returned", assignmentsSnapshot.docs.length, "documents");

        const results = assignmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort manually in JavaScript
        results.sort((a, b) => {
          if (a.date > b.date) return -1;
          if (a.date < b.date) return 1;
          return 0;
        });

        console.log("✅ ShiftAssignment.filter: Processed and sorted results:", results);
        return results;
      }
    } catch (error) {
      console.error('❌ ShiftAssignment.filter: Error filtering:', error);
      console.error('❌ Full error:', error);
      return [];
    }
  }

  static async create(data) {
    try {
      console.log("ShiftAssignment.create: Creating assignment:", data);
      
      // Check for conflicts - same soldier, same date, overlapping time
      const existingAssignments = await this.filter({
        soldier_id: data.soldier_id,
        date: data.date
      });
      
      if (existingAssignments.length > 0) {
        console.warn("ShiftAssignment.create: Found existing assignment for same date");
        // Could implement time conflict checking here
      }
      
      const assignmentData = {
        ...data,
        status: data.status || 'assigned',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'shift_assignments'), assignmentData);
      console.log("ShiftAssignment.create: Successfully created with ID:", docRef.id);
      
      return { id: docRef.id, ...assignmentData };
    } catch (error) {
      console.error('ShiftAssignment.create: Error creating:', error);
      throw error;
    }
  }

  static async update(id, data) {
    try {
      console.log("ShiftAssignment.update: Updating assignment:", id, data);
      
      const docRef = doc(db, 'shift_assignments', id);
      await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp()
      });
      console.log("ShiftAssignment.update: Successfully updated");
      
      return Promise.resolve();
    } catch (error) {
      console.error('ShiftAssignment.update: Error updating:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      console.log("ShiftAssignment.delete: Deleting assignment:", id);
      await deleteDoc(doc(db, 'shift_assignments', id));
      console.log("ShiftAssignment.delete: Successfully deleted");
      return Promise.resolve();
    } catch (error) {
      console.error('ShiftAssignment.delete: Error deleting:', error);
      throw error;
    }
  }

  // Bulk assignment for drag-and-drop operations
  static async bulkCreate(assignments) {
    try {
      console.log("ShiftAssignment.bulkCreate: Creating bulk assignments:", assignments);
      
      const results = [];
      for (const assignment of assignments) {
        const result = await this.create(assignment);
        results.push(result);
      }
      
      console.log("ShiftAssignment.bulkCreate: Successfully created", results.length, "assignments");
      return results;
    } catch (error) {
      console.error('ShiftAssignment.bulkCreate: Error creating bulk assignments:', error);
      throw error;
    }
  }

  // Get assignments for a specific week
  static async getWeekAssignments(weekStart) {
    try {
      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6);
      
      return await this.filter({
        start_date: weekStart,
        end_date: endDate.toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('ShiftAssignment.getWeekAssignments: Error:', error);
      return [];
    }
  }

  // Check for conflicts
  static async checkConflicts(soldierIds, date, shiftType) {
    try {
      const conflicts = [];
      
      for (const soldierId of soldierIds) {
        const existing = await this.filter({
          soldier_id: soldierId,
          date: date,
          status: 'assigned'
        });
        
        if (existing.length > 0) {
          conflicts.push({
            soldier_id: soldierId,
            existing_assignments: existing
          });
        }
      }
      
      return conflicts;
    } catch (error) {
      console.error('ShiftAssignment.checkConflicts: Error:', error);
      return [];
    }
  }
}