import { db } from '../config/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';

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

      // Simple query - just filter by soldier_id to avoid needing composite index
      let q = collection(db, 'shift_assignments');

      if (filters.soldier_id) {
        q = query(q, where('soldier_id', '==', filters.soldier_id));
      }

      // IMPORTANT: Only add ONE additional where clause to Firestore query
      // Multiple where clauses require composite indexes which may not exist
      // We'll filter the rest in JavaScript to avoid index requirements

      // For single exact date match (no range) - only add if no shift_type and no status
      // This prevents composite index requirements
      if (filters.date && !filters.start_date && !filters.end_date && !filters.shift_type && !filters.status) {
        q = query(q, where('date', '==', filters.date));
      }

      const assignmentsSnapshot = await getDocs(q);

      let results = assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter exact date in JavaScript if we have shift_type or status (to avoid composite index)
      if (filters.date && !filters.start_date && !filters.end_date && (filters.shift_type || filters.status)) {
        results = results.filter(assignment => assignment.date === filters.date);
      }

      // Filter date range in JavaScript (to avoid needing composite index)
      if (filters.start_date && filters.end_date) {
        results = results.filter(assignment => {
          const assignmentDate = assignment.date;
          return assignmentDate >= filters.start_date && assignmentDate <= filters.end_date;
        });
      }

      // Filter by shift_type in JavaScript (to avoid composite index)
      if (filters.shift_type) {
        results = results.filter(assignment => assignment.shift_type === filters.shift_type);
      }

      // Filter by status in JavaScript (to avoid composite index)
      if (filters.status) {
        results = results.filter(assignment => assignment.status === filters.status);
      }

      // Sort by date (descending) in JavaScript
      results.sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        return 0;
      });

      return results;
    } catch (error) {
      console.error('❌ ShiftAssignment.filter: Error filtering:', error);
      console.error('❌ Full error:', error);
      return [];
    }
  }

  static async create(data) {
    try {
      
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
      
      return { id: docRef.id, ...assignmentData };
    } catch (error) {
      console.error('ShiftAssignment.create: Error creating:', error);
      throw error;
    }
  }

  static async update(id, data) {
    try {
      
      const docRef = doc(db, 'shift_assignments', id);
      await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp()
      });
      
      return Promise.resolve();
    } catch (error) {
      console.error('ShiftAssignment.update: Error updating:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      await deleteDoc(doc(db, 'shift_assignments', id));
      return Promise.resolve();
    } catch (error) {
      console.error('ShiftAssignment.delete: Error deleting:', error);
      throw error;
    }
  }

  // Atomic bulk-create via Firestore writeBatch — single round-trip, all-or-nothing.
  // Firestore caps a batch at 500 operations; chunk if we exceed that.
  static async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;

    const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = writeBatch(db);
      ids.slice(i, i + CHUNK).forEach((id) => batch.delete(doc(db, 'shift_assignments', id)));
      await batch.commit();
    }
  }

  static async bulkCreate(assignments) {
    if (!Array.isArray(assignments) || assignments.length === 0) return [];

    const CHUNK = 500;
    const results = [];

    for (let i = 0; i < assignments.length; i += CHUNK) {
      const slice = assignments.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      const refs = slice.map((a) => {
        const ref = doc(collection(db, 'shift_assignments'));
        batch.set(ref, {
          ...a,
          status: a.status || 'assigned',
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
        return { id: ref.id, ...a };
      });
      await batch.commit();
      results.push(...refs);
    }

    return results;
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