import { ShiftSubmission } from '../entities/ShiftSubmission';
import { ShiftAssignment } from '../entities/ShiftAssignment';
import { ShiftDefinition } from '../entities/ShiftDefinition';
import { toWeekStartISO } from '../utils/weekKey';

/**
 * Soldier API Service
 * Provides soldier-specific functionality for shift management
 */
export class SoldierApiService {
  
  /**
   * Submit shift preferences
   * @param {Object} data - Preference data
   */
  static async submitPreferences({ soldierId, date, preferences, priority = 3 }) {
    try {
      console.log('SoldierApi.submitPreferences:', { soldierId, date, preferences, priority });
      
      // Convert date to week start if needed
      const weekStart = toWeekStartISO(new Date(date));
      
      // Check if submission already exists
      const existing = await ShiftSubmission.filter({
        user_id: soldierId,
        week_start: weekStart
      });
      
      const submissionData = {
        uid: soldierId,
        user_id: soldierId,
        week_start: weekStart,
        shifts: preferences,
        priority: priority,
        updated_at: new Date()
      };
      
      let result;
      if (existing.length > 0) {
        // Update existing submission
        result = await ShiftSubmission.update(existing[0].id, submissionData);
        result = { id: existing[0].id, ...submissionData };
      } else {
        // Create new submission
        result = await ShiftSubmission.create(submissionData);
      }
      
      console.log('SoldierApi.submitPreferences: Success:', result.id);
      return result;
    } catch (error) {
      console.error('SoldierApi.submitPreferences: Error:', error);
      throw new Error(`Failed to submit preferences: ${error.message}`);
    }
  }

  /**
   * Get soldier's submitted preferences
   * @param {string} soldierId - Soldier ID
   * @param {string} date - Date (YYYY-MM-DD)
   */
  static async getMyPreferences(soldierId, date) {
    try {
      console.log('SoldierApi.getMyPreferences:', { soldierId, date });
      
      const weekStart = toWeekStartISO(new Date(date));
      
      const submissions = await ShiftSubmission.filter({
        user_id: soldierId,
        week_start: weekStart
      });
      
      if (submissions.length === 0) {
        return null;
      }
      
      const submission = submissions[0];
      return {
        id: submission.id,
        week_start: submission.week_start,
        preferences: submission.shifts || {},
        priority: submission.priority || 3,
        submitted_at: submission.created_at,
        updated_at: submission.updated_at
      };
    } catch (error) {
      console.error('SoldierApi.getMyPreferences: Error:', error);
      throw new Error(`Failed to fetch preferences: ${error.message}`);
    }
  }

  /**
   * Get soldier's assignments
   * @param {string} soldierId - Soldier ID
   * @param {string} date - Date (YYYY-MM-DD)
   */
  static async getMyAssignments(soldierId, date = null) {
    try {
      console.log('SoldierApi.getMyAssignments:', { soldierId, date });
      
      const filters = { soldier_id: soldierId };
      
      if (date) {
        // Get assignments for specific date or week
        const weekStart = toWeekStartISO(new Date(date));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        filters.start_date = weekStart;
        filters.end_date = weekEnd.toISOString().split('T')[0];
      }
      
      const assignments = await ShiftAssignment.filter(filters);
      
      // Get shift definitions for additional info
      const shifts = await ShiftDefinition.list();
      const shiftsMap = shifts.reduce((acc, shift) => {
        acc[shift.id] = shift;
        acc[shift.name_en] = shift;
        return acc;
      }, {});
      
      const enrichedAssignments = assignments.map(assignment => ({
        ...assignment,
        shift_definition: shiftsMap[assignment.shift_type],
        shift_display_name: shiftsMap[assignment.shift_type]?.name || assignment.shift_name || assignment.shift_type
      }));
      
      console.log('SoldierApi.getMyAssignments: Found', enrichedAssignments.length, 'assignments');
      return enrichedAssignments;
    } catch (error) {
      console.error('SoldierApi.getMyAssignments: Error:', error);
      throw new Error(`Failed to fetch assignments: ${error.message}`);
    }
  }

  /**
   * Confirm assignment
   * @param {string} assignmentId - Assignment ID
   */
  static async confirmAssignment(assignmentId) {
    try {
      console.log('SoldierApi.confirmAssignment:', assignmentId);
      
      await ShiftAssignment.update(assignmentId, {
        status: 'confirmed',
        confirmed_at: new Date()
      });
      
      console.log('SoldierApi.confirmAssignment: Success');
      return true;
    } catch (error) {
      console.error('SoldierApi.confirmAssignment: Error:', error);
      throw new Error(`Failed to confirm assignment: ${error.message}`);
    }
  }

  /**
   * Request shift swap
   * @param {string} assignmentId - Assignment ID
   * @param {string} reason - Swap reason
   */
  static async requestSwap(assignmentId, reason) {
    try {
      console.log('SoldierApi.requestSwap:', { assignmentId, reason });
      
      await ShiftAssignment.update(assignmentId, {
        status: 'swap_requested',
        swap_reason: reason,
        swap_requested_at: new Date()
      });
      
      console.log('SoldierApi.requestSwap: Success');
      return true;
    } catch (error) {
      console.error('SoldierApi.requestSwap: Error:', error);
      throw new Error(`Failed to request swap: ${error.message}`);
    }
  }

  /**
   * Get available shifts for soldier's unit
   * @param {string} unit - Soldier's unit
   */
  static async getAvailableShifts(unit) {
    try {
      console.log('SoldierApi.getAvailableShifts:', unit);
      
      const shifts = await ShiftDefinition.getByUnit(unit);
      
      console.log('SoldierApi.getAvailableShifts: Found', shifts.length, 'shifts');
      return shifts;
    } catch (error) {
      console.error('SoldierApi.getAvailableShifts: Error:', error);
      throw new Error(`Failed to fetch available shifts: ${error.message}`);
    }
  }

  /**
   * Get soldier's statistics
   * @param {string} soldierId - Soldier ID
   * @param {string} startDate - Start date for stats
   * @param {string} endDate - End date for stats
   */
  static async getMyStats(soldierId, startDate, endDate) {
    try {
      console.log('SoldierApi.getMyStats:', { soldierId, startDate, endDate });
      
      const assignments = await ShiftAssignment.filter({
        soldier_id: soldierId,
        start_date: startDate,
        end_date: endDate
      });
      
      const stats = {
        total_shifts: assignments.length,
        confirmed_shifts: assignments.filter(a => a.status === 'confirmed').length,
        pending_shifts: assignments.filter(a => a.status === 'assigned').length,
        swap_requests: assignments.filter(a => a.status === 'swap_requested').length,
        completed_shifts: assignments.filter(a => a.status === 'completed').length
      };
      
      // Calculate shift type breakdown
      const shiftTypeBreakdown = {};
      assignments.forEach(assignment => {
        const type = assignment.shift_type;
        shiftTypeBreakdown[type] = (shiftTypeBreakdown[type] || 0) + 1;
      });
      
      stats.shift_breakdown = shiftTypeBreakdown;
      
      console.log('SoldierApi.getMyStats:', stats);
      return stats;
    } catch (error) {
      console.error('SoldierApi.getMyStats: Error:', error);
      throw new Error(`Failed to fetch stats: ${error.message}`);
    }
  }

  /**
   * Check for scheduling conflicts
   * @param {string} soldierId - Soldier ID
   * @param {string} date - Date to check
   */
  static async checkConflicts(soldierId, date) {
    try {
      console.log('SoldierApi.checkConflicts:', { soldierId, date });
      
      const conflicts = await ShiftAssignment.checkConflicts([soldierId], date, null);
      
      console.log('SoldierApi.checkConflicts: Found', conflicts.length, 'conflicts');
      return conflicts;
    } catch (error) {
      console.error('SoldierApi.checkConflicts: Error:', error);
      throw new Error(`Failed to check conflicts: ${error.message}`);
    }
  }
}