import { db } from '../config/firebase';
import { collection, getDocs, deleteDoc, doc, addDoc } from 'firebase/firestore';

/**
 * Database Utility Functions
 * Helper functions for managing Firestore collections
 */

/**
 * Clear all shift assignments from the database
 * Useful for starting fresh or cleaning up old data
 */
export async function clearAllShiftAssignments() {
  try {
    console.log('🗑️ Clearing all shift assignments...');

    const assignmentsRef = collection(db, 'shift_assignments');
    const snapshot = await getDocs(assignmentsRef);

    console.log(`📊 Found ${snapshot.docs.length} assignments to delete`);

    if (snapshot.docs.length === 0) {
      console.log('✅ No assignments to delete - collection is already empty or does not exist');
      return { deleted: 0, message: 'No assignments found' };
    }

    let deletedCount = 0;
    for (const document of snapshot.docs) {
      await deleteDoc(doc(db, 'shift_assignments', document.id));
      deletedCount++;
      console.log(`🗑️ Deleted assignment ${deletedCount}/${snapshot.docs.length}: ${document.id}`);
    }

    console.log(`✅ Successfully deleted ${deletedCount} shift assignments`);
    return { deleted: deletedCount, message: `Deleted ${deletedCount} assignments` };
  } catch (error) {
    console.error('❌ Error clearing shift assignments:', error);
    throw new Error(`Failed to clear assignments: ${error.message}`);
  }
}

/**
 * Initialize the shift_assignments collection
 * Creates the collection if it doesn't exist by adding a dummy document and removing it
 */
export async function initializeShiftAssignmentsCollection() {
  try {
    console.log('🔧 Initializing shift_assignments collection...');

    // Try to read the collection
    const assignmentsRef = collection(db, 'shift_assignments');
    const snapshot = await getDocs(assignmentsRef);

    if (snapshot.docs.length > 0) {
      console.log('✅ Collection already exists with', snapshot.docs.length, 'documents');
      return { exists: true, count: snapshot.docs.length };
    }

    // Collection doesn't exist or is empty - create a dummy document to initialize it
    console.log('📝 Creating dummy document to initialize collection...');
    const dummyDoc = await addDoc(assignmentsRef, {
      _dummy: true,
      created_at: new Date(),
      message: 'This is a dummy document to initialize the collection'
    });

    // Delete the dummy document
    console.log('🗑️ Removing dummy document...');
    await deleteDoc(doc(db, 'shift_assignments', dummyDoc.id));

    console.log('✅ shift_assignments collection initialized successfully');
    return { exists: true, count: 0, initialized: true };
  } catch (error) {
    console.error('❌ Error initializing collection:', error);
    throw new Error(`Failed to initialize collection: ${error.message}`);
  }
}

/**
 * Get statistics about shift assignments
 */
export async function getShiftAssignmentsStats() {
  try {
    const assignmentsRef = collection(db, 'shift_assignments');
    const snapshot = await getDocs(assignmentsRef);

    const stats = {
      total: snapshot.docs.length,
      byStatus: {},
      bySoldier: {},
      byWeek: {}
    };

    snapshot.docs.forEach(doc => {
      const data = doc.data();

      // Count by status
      const status = data.status || 'unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // Count by soldier
      const soldierId = data.soldier_id || 'unknown';
      stats.bySoldier[soldierId] = (stats.bySoldier[soldierId] || 0) + 1;

      // Count by week
      const week = data.week_start || 'unknown';
      stats.byWeek[week] = (stats.byWeek[week] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    return { total: 0, error: error.message };
  }
}

/**
 * Create a test shift assignment
 * This will initialize the collection and create a test document
 */
export async function createTestAssignment() {
  try {
    console.log('🧪 Creating test shift assignment...');

    const testAssignment = {
      soldier_id: 'test-soldier-123',
      soldier_name: 'Test Soldier',
      date: '2025-10-19',
      day_name: 'sunday',
      shift_type: 'test_shift',
      shift_name: 'Test Shift',
      start_time: '08:00',
      end_time: '16:00',
      week_start: '2025-10-13',
      status: 'assigned',
      created_at: new Date(),
      updated_at: new Date(),
      _test: true
    };

    const assignmentsRef = collection(db, 'shift_assignments');
    const docRef = await addDoc(assignmentsRef, testAssignment);

    console.log('✅ Test assignment created with ID:', docRef.id);
    return { success: true, id: docRef.id, data: testAssignment };
  } catch (error) {
    console.error('❌ Error creating test assignment:', error);
    throw new Error(`Failed to create test assignment: ${error.message}`);
  }
}
