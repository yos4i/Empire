import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

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

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export default app;