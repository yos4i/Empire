// Utility script to update shift times in existing weekly schedules
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAlI1JKBEwXRAvUZOcw4WHtFojLturOIJA",
  authDomain: "empire-2fcae.firebaseapp.com",
  databaseURL: "https://empire-2fcae-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "empire-2fcae",
  storageBucket: "empire-2fcae.firebasestorage.app",
  messagingSenderId: "668796620812",
  appId: "1:668796620812:web:8c15c21cd880bfe6505e29",
  measurementId: "G-QT9YZ87T8P"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

async function updateWeeklySchedules() {
  try {
    console.log('🔄 Updating weekly schedules...\n');

    // Get all weekly schedules
    const schedulesRef = collection(db, 'weekly_schedules');
    const snapshot = await getDocs(schedulesRef);

    console.log(`📋 Found ${snapshot.size} weekly schedules\n`);

    let updatedCount = 0;

    for (const scheduleDoc of snapshot.docs) {
      const scheduleData = scheduleDoc.data();
      let hasChanges = false;
      const updates = {};

      console.log(`\n📅 Processing schedule: ${scheduleDoc.id}`);
      console.log(`   Week: ${scheduleData.weekStart?.toDate?.() || 'unknown'}`);

      // Check each day
      for (const day of DAYS) {
        if (scheduleData.schedule && scheduleData.schedule[day]) {
          const daySchedule = scheduleData.schedule[day];

          // Update קריית_חינוך_בוקר times (except Friday)
          if (daySchedule['קריית_חינוך_בוקר']) {
            const shift = daySchedule['קריית_חינוך_בוקר'];

            // For Friday, keep 07:00-12:00
            if (day === 'friday') {
              if (shift.customStartTime !== '07:00' || shift.customEndTime !== '12:00') {
                updates[`schedule.${day}.קריית_חינוך_בוקר.customStartTime`] = '07:00';
                updates[`schedule.${day}.קריית_חינוך_בוקר.customEndTime`] = '12:00';
                hasChanges = true;
                console.log(`   ✏️  ${day}: Updated קריית_חינוך_בוקר to 07:00-12:00`);
              }
            } else {
              // For other days, set to 07:00-14:30
              if (shift.customStartTime !== '07:00' || shift.customEndTime !== '14:30') {
                updates[`schedule.${day}.קריית_חינוך_בוקר.customStartTime`] = '07:00';
                updates[`schedule.${day}.קריית_חינוך_בוקר.customEndTime`] = '14:30';
                hasChanges = true;
                console.log(`   ✏️  ${day}: Updated קריית_חינוך_בוקר to 07:00-14:30`);
              }
            }
          }

          // Update קריית_חינוך_ערב times
          if (daySchedule['קריית_חינוך_ערב']) {
            const shift = daySchedule['קריית_חינוך_ערב'];
            if (shift.customStartTime !== '13:30' || shift.customEndTime !== '19:30') {
              updates[`schedule.${day}.קריית_חינוך_ערב.customStartTime`] = '13:30';
              updates[`schedule.${day}.קריית_חינוך_ערב.customEndTime`] = '19:30';
              hasChanges = true;
              console.log(`   ✏️  ${day}: Updated קריית_חינוך_ערב to 13:30-19:30`);
            }
          }
        }
      }

      // Apply updates if there are any
      if (hasChanges) {
        await updateDoc(doc(db, 'weekly_schedules', scheduleDoc.id), updates);
        updatedCount++;
        console.log(`   ✅ Updated schedule ${scheduleDoc.id}`);
      } else {
        console.log(`   ℹ️  No changes needed for ${scheduleDoc.id}`);
      }
    }

    console.log(`\n✅ Updated ${updatedCount} out of ${snapshot.size} schedules`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateWeeklySchedules();
