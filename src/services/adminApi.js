// src/services/adminApi.js
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { format, parseISO, addDays } from 'date-fns';

export class AdminApiService {
  
  // Get all shift preferences for a given week
  static async getShiftPreferences(weekStart) {
    try {
      console.log('AdminApiService: Fetching preferences for week:', weekStart);
      
      // Calculate week end date
      const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');
      
      // Query the shift_preferences collection
      const preferencesRef = collection(db, 'shift_preferences');
      const q = query(
        preferencesRef,
        where('weekStart', '==', weekStart),
        orderBy('updatedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const preferences = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Get soldier details from users collection
        const soldierDoc = await getDocs(
          query(collection(db, 'users'), where('uid', '==', data.userId))
        );
        
        let soldierData = null;
        if (!soldierDoc.empty) {
          const soldier = soldierDoc.docs[0].data();
          soldierData = {
            name: soldier.displayName,
            unit: soldier.unit,
            rank: soldier.rank,
            personal_number: soldier.personal_number
          };
        }
        
        preferences.push({
          id: doc.id,
          soldier_id: data.userId,
          soldier_name: soldierData?.name || data.userName || 'Unknown',
          soldier_unit: soldierData?.unit || 'Unknown',
          soldier_rank: soldierData?.rank || '',
          weekStart: data.weekStart,
          days: data.days || {},
          updatedAt: data.updatedAt?.toDate() || new Date(),
          soldier: soldierData // Include full soldier data for compatibility
        });
      }
      
      console.log('AdminApiService: Found preferences:', preferences.length);
      return preferences;
      
    } catch (error) {
      console.error('AdminApiService: Error fetching preferences:', error);
      throw error;
    }
  }
  
  // Get all assignments for a date range
  static async getAssignments(startDate, endDate) {
    try {
      console.log('AdminApiService: Fetching assignments from', startDate, 'to', endDate);
      
      const assignmentsRef = collection(db, 'shift_assignments');
      const q = query(
        assignmentsRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date'),
        orderBy('shift_type')
      );
      
      const snapshot = await getDocs(q);
      const assignments = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Get soldier details
        const soldierDoc = await getDocs(
          query(collection(db, 'users'), where('uid', '==', data.soldier_id))
        );
        
        let soldierData = null;
        if (!soldierDoc.empty) {
          const soldier = soldierDoc.docs[0].data();
          soldierData = {
            name: soldier.displayName,
            unit: soldier.unit,
            rank: soldier.rank
          };
        }
        
        assignments.push({
          id: doc.id,
          soldier_id: data.soldier_id,
          soldier_name: soldierData?.name || 'Unknown',
          soldier_unit: soldierData?.unit || 'Unknown',
          date: data.date,
          shift_type: data.shift_type,
          assigned_by: data.assigned_by,
          created_at: data.created_at?.toDate() || new Date()
        });
      }
      
      console.log('AdminApiService: Found assignments:', assignments.length);
      return assignments;
      
    } catch (error) {
      console.error('AdminApiService: Error fetching assignments:', error);
      throw error;
    }
  }
  
  // Assign a soldier to a shift
  static async assignShift({ soldierId, date, shiftType, assignedBy }) {
    try {
      console.log('AdminApiService: Assigning shift:', { soldierId, date, shiftType });
      
      // Check if assignment already exists
      const existingQuery = query(
        collection(db, 'shift_assignments'),
        where('soldier_id', '==', soldierId),
        where('date', '==', date),
        where('shift_type', '==', shiftType)
      );
      
      const existing = await getDocs(existingQuery);
      if (!existing.empty) {
        console.log('AdminApiService: Assignment already exists');
        return { success: true, message: 'Assignment already exists' };
      }
      
      // Create new assignment
      const assignmentData = {
        soldier_id: soldierId,
        date: date,
        shift_type: shiftType,
        assigned_by: assignedBy,
        created_at: Timestamp.now(),
        status: 'assigned'
      };
      
      const docRef = await addDoc(collection(db, 'shift_assignments'), assignmentData);
      
      console.log('AdminApiService: Assignment created with ID:', docRef.id);
      return { success: true, id: docRef.id };
      
    } catch (error) {
      console.error('AdminApiService: Error assigning shift:', error);
      throw error;
    }
  }
  
  // Remove an assignment
  static async removeAssignment(assignmentId) {
    try {
      console.log('AdminApiService: Removing assignment:', assignmentId);
      
      await deleteDoc(doc(db, 'shift_assignments', assignmentId));
      
      console.log('AdminApiService: Assignment removed');
      return { success: true };
      
    } catch (error) {
      console.error('AdminApiService: Error removing assignment:', error);
      throw error;
    }
  }
  
  // Auto-assign shifts based on preferences
  static async autoAssignShifts(weekStart, assignedBy) {
    try {
      console.log('AdminApiService: Starting auto-assignment for week:', weekStart);
      
      // Get all preferences for the week
      const preferences = await this.getShiftPreferences(weekStart);
      
      // Get existing assignments to avoid duplicates
      const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');
      const existingAssignments = await this.getAssignments(weekStart, weekEnd);
      
      const assignments = [];
      const conflicts = [];
      
      // Map days to dates
      const dayMapping = {
        'sunday': 0,
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6
      };
      
      // Process each preference
      for (const pref of preferences) {
        if (!pref.days) continue;
        
        for (const [day, shifts] of Object.entries(pref.days)) {
          if (!shifts || shifts.length === 0) continue;
          
          const dayIndex = dayMapping[day];
          if (dayIndex === undefined) continue;
          
          const shiftDate = format(addDays(parseISO(weekStart), dayIndex), 'yyyy-MM-dd');
          
          for (const shift of shifts) {
            // Check if already assigned
            const isAssigned = existingAssignments.some(
              a => a.soldier_id === pref.soldier_id && 
                   a.date === shiftDate && 
                   a.shift_type === shift
            );
            
            if (!isAssigned) {
              try {
                const result = await this.assignShift({
                  soldierId: pref.soldier_id,
                  date: shiftDate,
                  shiftType: shift,
                  assignedBy: assignedBy
                });
                
                assignments.push({
                  soldier: pref.soldier_name,
                  date: shiftDate,
                  shift: shift
                });
              } catch (error) {
                conflicts.push({
                  soldier: pref.soldier_name,
                  date: shiftDate,
                  shift: shift,
                  reason: error.message
                });
              }
            }
          }
        }
      }
      
      console.log('AdminApiService: Auto-assignment complete:', {
        assignments: assignments.length,
        conflicts: conflicts.length
      });
      
      return { assignments, conflicts };
      
    } catch (error) {
      console.error('AdminApiService: Error in auto-assignment:', error);
      throw error;
    }
  }
  
  // Get dashboard statistics
  static async getDashboardStats(weekStart) {
    try {
      console.log('AdminApiService: Fetching dashboard stats for week:', weekStart);
      
      // Get all soldiers
      const soldiersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'user')
      );
      const soldiersSnapshot = await getDocs(soldiersQuery);
      const totalSoldiers = soldiersSnapshot.size;
      
      // Get preferences for the week
      const preferences = await this.getShiftPreferences(weekStart);
      const submittedPreferences = preferences.length;
      
      // Calculate submission rate
      const submissionRate = totalSoldiers > 0 
        ? Math.round((submittedPreferences / totalSoldiers) * 100) 
        : 0;
      
      const stats = {
        total_soldiers: totalSoldiers,
        submitted_preferences: submittedPreferences,
        submission_rate: submissionRate,
        week: weekStart
      };
      
      console.log('AdminApiService: Dashboard stats:', stats);
      return stats;
      
    } catch (error) {
      console.error('AdminApiService: Error fetching stats:', error);
      return {
        total_soldiers: 0,
        submitted_preferences: 0,
        submission_rate: 0,
        week: weekStart
      };
    }
  }
  
  // Bulk assign shifts (for drag and drop)
  static async bulkAssignShifts(assignments, assignedBy) {
    try {
      console.log('AdminApiService: Bulk assigning shifts:', assignments.length);
      
      const results = {
        success: [],
        failed: []
      };
      
      for (const assignment of assignments) {
        try {
          const result = await this.assignShift({
            ...assignment,
            assignedBy
          });
          results.success.push(result);
        } catch (error) {
          results.failed.push({
            assignment,
            error: error.message
          });
        }
      }
      
      console.log('AdminApiService: Bulk assignment results:', results);
      return results;
      
    } catch (error) {
      console.error('AdminApiService: Error in bulk assignment:', error);
      throw error;
    }
  }
}

export default AdminApiService;