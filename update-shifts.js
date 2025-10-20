// Utility script to update shift definitions in Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');

// Your Firebase config (from src/config/firebase.js)
const firebaseConfig = {
  // Add your config here from firebase.js
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const newShifts = {
  "קריית_חינוך_בוקר_ארוך": {
    key: "קריית_חינוך_בוקר_ארוך",
    displayName: "ק.חינוך בוקר ארוך 07:00-15:30",
    mission: "קריית_חינוך",
    shiftType: "בוקר_ארוך",
    startTime: "07:00",
    endTime: "15:30",
    required: 5,
    isLong: true,
    type: "בוקר_ארוך",
    name: "ק.חינוך בוקר ארוך",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  "גבולות_בוקר_ארוך": {
    key: "גבולות_בוקר_ארוך",
    displayName: "גבולות בוקר ארוך 07:00-15:30",
    mission: "גבולות",
    shiftType: "בוקר_ארוך",
    startTime: "07:00",
    endTime: "15:30",
    required: 2,
    isLong: true,
    type: "בוקר_ארוך",
    name: "גבולות בוקר ארוך",
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

async function updateShifts() {
  try {
    for (const [shiftKey, shiftData] of Object.entries(newShifts)) {
      await setDoc(doc(db, 'shift_definitions', shiftKey), shiftData);
      console.log('Added shift:', shiftKey);
    }
    console.log('✅ All shifts updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateShifts();
