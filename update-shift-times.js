// Utility script to update shift times in Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDoc } = require('firebase/firestore');

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

const shiftsToUpdate = {
  "קריית_חינוך_בוקר": {
    startTime: "07:00",
    endTime: "14:30"
  },
  "קריית_חינוך_ערב": {
    startTime: "13:30",
    endTime: "19:30"
  }
};

async function updateShiftTimes() {
  try {
    console.log('🔄 Updating shift times...\n');

    for (const [shiftKey, times] of Object.entries(shiftsToUpdate)) {
      // First, get the existing document
      const docRef = doc(db, 'shift_definitions', shiftKey);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.log(`⚠️  Shift "${shiftKey}" not found, skipping...`);
        continue;
      }

      const existingData = docSnap.data();
      console.log(`📝 Found shift: ${shiftKey}`);
      console.log(`   Old times: ${existingData.startTime}-${existingData.endTime}`);
      console.log(`   New times: ${times.startTime}-${times.endTime}`);

      // Update the document with new times
      const updatedData = {
        ...existingData,
        startTime: times.startTime,
        endTime: times.endTime,
        displayName: `${existingData.name} ${times.startTime}-${times.endTime}`,
        updatedAt: new Date()
      };

      await setDoc(docRef, updatedData);
      console.log(`✅ Updated ${shiftKey}\n`);
    }

    console.log('✅ All shift times updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateShiftTimes();
