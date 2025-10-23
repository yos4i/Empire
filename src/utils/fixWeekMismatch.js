import { db } from '../config/firebase';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

/**
 * Utility to fix the week mismatch bug where soldiers submitted preferences
 * with the wrong week_start date due to a UI bug.
 *
 * This script will:
 * 1. Find all submissions/assignments for the wrong week (2025-10-19)
 * 2. Update them to the correct week (2025-10-26)
 * 3. Update the dates by adding 7 days
 */

// CONFIGURE THESE VALUES BASED ON YOUR NEEDS
const WRONG_WEEK = '2025-10-19';  // The incorrect week that was saved
const CORRECT_WEEK = '2025-10-26'; // The correct week it should be

// Safety check - prevent accidental execution
let SAFETY_ENABLED = true;

export function disableSafety() {
  console.warn('⚠️ SAFETY DISABLED - Changes will now be made to the database!');
  SAFETY_ENABLED = false;
}

export function enableSafety() {
  console.log('✅ SAFETY ENABLED - No changes will be made to the database');
  SAFETY_ENABLED = true;
}

// Helper to add days to a date string (YYYY-MM-DD format)
function addDaysToDateStr(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Fix shift_preferences collection
 */
export async function fixShiftPreferences() {
  console.log('🔧 Starting to fix shift_preferences...');

  if (SAFETY_ENABLED) {
    console.error('❌ SAFETY MODE IS ON - No changes will be made!');
    console.log('💡 Run disableSafety() first, or use previewFixes() to see what would change');
    return { success: false, error: 'Safety mode is enabled' };
  }

  try {
    const preferencesRef = collection(db, 'shift_preferences');
    const q = query(preferencesRef, where('weekStart', '==', WRONG_WEEK));
    const snapshot = await getDocs(q);

    console.log(`📊 Found ${snapshot.docs.length} preferences with wrong week`);

    const updates = [];

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();

      // Update the week_start
      const updateData = {
        weekStart: CORRECT_WEEK
      };

      console.log(`  ✏️ Updating preference ${docSnapshot.id}:`, {
        old: WRONG_WEEK,
        new: CORRECT_WEEK,
        user: data.userName
      });

      updates.push(
        updateDoc(doc(db, 'shift_preferences', docSnapshot.id), updateData)
      );
    }

    await Promise.all(updates);
    console.log(`✅ Fixed ${updates.length} shift preferences`);

    return { success: true, fixed: updates.length };
  } catch (error) {
    console.error('❌ Error fixing shift_preferences:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fix shift_submissions collection
 */
export async function fixShiftSubmissions() {
  console.log('🔧 Starting to fix shift_submissions...');

  try {
    const submissionsRef = collection(db, 'shift_submissions');
    const q = query(submissionsRef, where('week_start', '==', WRONG_WEEK));
    const snapshot = await getDocs(q);

    console.log(`📊 Found ${snapshot.docs.length} submissions with wrong week`);

    const updates = [];

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();

      // Update the week_start
      const updateData = {
        week_start: CORRECT_WEEK
      };

      console.log(`  ✏️ Updating submission ${docSnapshot.id}:`, {
        old: WRONG_WEEK,
        new: CORRECT_WEEK
      });

      updates.push(
        updateDoc(doc(db, 'shift_submissions', docSnapshot.id), updateData)
      );
    }

    await Promise.all(updates);
    console.log(`✅ Fixed ${updates.length} shift submissions`);

    return { success: true, fixed: updates.length };
  } catch (error) {
    console.error('❌ Error fixing shift_submissions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fix shift_assignments collection
 * This is more complex because we need to update both week_start AND date fields
 */
export async function fixShiftAssignments() {
  console.log('🔧 Starting to fix shift_assignments...');

  try {
    const assignmentsRef = collection(db, 'shift_assignments');
    const q = query(assignmentsRef, where('week_start', '==', WRONG_WEEK));
    const snapshot = await getDocs(q);

    console.log(`📊 Found ${snapshot.docs.length} assignments with wrong week`);

    const updates = [];

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();

      // Update both week_start and date (add 7 days to date)
      const oldDate = data.date;
      const newDate = addDaysToDateStr(oldDate, 7);

      const updateData = {
        week_start: CORRECT_WEEK,
        date: newDate
      };

      console.log(`  ✏️ Updating assignment ${docSnapshot.id}:`, {
        soldier: data.soldier_name,
        oldWeek: WRONG_WEEK,
        newWeek: CORRECT_WEEK,
        oldDate: oldDate,
        newDate: newDate,
        shift: data.shift_type,
        day: data.day_name
      });

      updates.push(
        updateDoc(doc(db, 'shift_assignments', docSnapshot.id), updateData)
      );
    }

    await Promise.all(updates);
    console.log(`✅ Fixed ${updates.length} shift assignments`);

    return { success: true, fixed: updates.length };
  } catch (error) {
    console.error('❌ Error fixing shift_assignments:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete assignments for the wrong week instead of updating them
 * Use this if you prefer to start fresh
 */
export async function deleteWrongWeekAssignments() {
  console.log('🗑️ Starting to DELETE assignments for wrong week...');

  try {
    const assignmentsRef = collection(db, 'shift_assignments');
    const q = query(assignmentsRef, where('week_start', '==', WRONG_WEEK));
    const snapshot = await getDocs(q);

    console.log(`📊 Found ${snapshot.docs.length} assignments to delete`);

    const deletions = [];

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();

      console.log(`  🗑️ Deleting assignment ${docSnapshot.id}:`, {
        soldier: data.soldier_name,
        date: data.date,
        shift: data.shift_type
      });

      deletions.push(
        deleteDoc(doc(db, 'shift_assignments', docSnapshot.id))
      );
    }

    await Promise.all(deletions);
    console.log(`✅ Deleted ${deletions.length} shift assignments`);

    return { success: true, deleted: deletions.length };
  } catch (error) {
    console.error('❌ Error deleting shift_assignments:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Run all fixes in sequence
 */
export async function fixAllWeekMismatches() {
  console.log('🚀 Starting full week mismatch fix...');
  console.log(`📅 Fixing: ${WRONG_WEEK} → ${CORRECT_WEEK}`);

  const results = {
    preferences: await fixShiftPreferences(),
    submissions: await fixShiftSubmissions(),
    assignments: await fixShiftAssignments()
  };

  console.log('📊 Fix Summary:', results);

  return results;
}

/**
 * PREVIEW mode - just show what would be changed without actually changing it
 */
export async function previewFixes() {
  console.log('👀 PREVIEW MODE - No changes will be made');
  console.log('=====================================');

  // Preview shift_preferences
  const preferencesRef = collection(db, 'shift_preferences');
  const prefQuery = query(preferencesRef, where('weekStart', '==', WRONG_WEEK));
  const prefSnapshot = await getDocs(prefQuery);

  console.log(`\n📋 shift_preferences (${prefSnapshot.docs.length} documents):`);
  prefSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${data.userName} (${doc.id})`);
  });

  // Preview shift_submissions
  const submissionsRef = collection(db, 'shift_submissions');
  const subQuery = query(submissionsRef, where('week_start', '==', WRONG_WEEK));
  const subSnapshot = await getDocs(subQuery);

  console.log(`\n📋 shift_submissions (${subSnapshot.docs.length} documents):`);
  subSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${data.userId} (${doc.id})`);
  });

  // Preview shift_assignments
  const assignmentsRef = collection(db, 'shift_assignments');
  const assignQuery = query(assignmentsRef, where('week_start', '==', WRONG_WEEK));
  const assignSnapshot = await getDocs(assignQuery);

  console.log(`\n📋 shift_assignments (${assignSnapshot.docs.length} documents):`);
  assignSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const newDate = addDaysToDateStr(data.date, 7);
    console.log(`  - ${data.soldier_name}: ${data.date} → ${newDate} (${data.shift_type}, ${data.day_name})`);
  });

  console.log('\n=====================================');
  console.log('📊 Total documents that would be affected:');
  console.log(`  - Preferences: ${prefSnapshot.docs.length}`);
  console.log(`  - Submissions: ${subSnapshot.docs.length}`);
  console.log(`  - Assignments: ${assignSnapshot.docs.length}`);
  console.log(`  - TOTAL: ${prefSnapshot.docs.length + subSnapshot.docs.length + assignSnapshot.docs.length}`);

  return {
    preferences: prefSnapshot.docs.length,
    submissions: subSnapshot.docs.length,
    assignments: assignSnapshot.docs.length,
    total: prefSnapshot.docs.length + subSnapshot.docs.length + assignSnapshot.docs.length
  };
}
