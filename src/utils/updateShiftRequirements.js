import { db } from '../config/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

/**
 * Update shift requirements in the shift_definitions collection
 */

export async function updateShiftRequirements() {
  try {
    console.log('🔧 Updating shift requirements...');

    // Update קריית חינוך בוקר to require 12 soldiers (for Friday specifically, but this is global)
    // Note: The screenshot shows Friday needs 12, but the system uses a global requirement
    // If you need different requirements per day, we'll need a different approach

    const updates = [
      {
        shiftKey: 'קריית_חינוך_בוקר',
        required: 18, // Keep 18 for regular days
        name: 'קריית חינוך בוקר'
      }
    ];

    for (const update of updates) {
      const docRef = doc(db, 'shift_definitions', update.shiftKey);

      // First check if document exists
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await updateDoc(docRef, {
          required: update.required,
          updatedAt: new Date()
        });

        console.log(`✅ Updated ${update.name}: required = ${update.required}`);
      } else {
        console.warn(`⚠️ Document not found: ${update.shiftKey}`);
      }
    }

    console.log('✅ All shift requirements updated successfully!');
    return { success: true };

  } catch (error) {
    console.error('❌ Error updating shift requirements:', error);
    return { success: false, error: error.message };
  }
}

/**
 * For day-specific requirements (e.g., Friday needs 12 instead of 18)
 * This would need to be stored in weekly_schedules, not shift_definitions
 */
export async function createFridaySpecificRequirement(weekStart) {
  console.log('📝 Note: Day-specific requirements should be set in weekly_schedules');
  console.log('💡 The current system uses global requirements from shift_definitions');
  console.log('💡 If Friday always needs 12 for קריית חינוך, consider:');
  console.log('   1. Creating a separate shift type for Friday');
  console.log('   2. Or modifying the schedule board to show day-specific requirements');

  return {
    message: 'Day-specific requirements need architectural changes',
    suggestion: 'Use weekly_schedules to override requirements per week'
  };
}

/**
 * Preview current requirements
 */
export async function previewCurrentRequirements() {
  try {
    console.log('👀 Current shift requirements:');
    console.log('================================');

    const shifts = ['קריית_חינוך_בוקר', 'קריית_חינוך_ערב'];

    for (const shiftKey of shifts) {
      const docRef = doc(db, 'shift_definitions', shiftKey);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`📋 ${shiftKey}:`);
        console.log(`   - Required: ${data.required}`);
        console.log(`   - Display: ${data.displayName}`);
        console.log(`   - Times: ${data.startTime}-${data.endTime}`);
      } else {
        console.log(`❌ ${shiftKey}: Not found`);
      }
    }

    console.log('================================');
    return { success: true };

  } catch (error) {
    console.error('❌ Error previewing requirements:', error);
    return { success: false, error: error.message };
  }
}
