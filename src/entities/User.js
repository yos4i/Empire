import { db } from '../config/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

export class User {
  static async me() {
    try {
      // Get current user from localStorage (session)
      const savedUser = localStorage.getItem('authUser');
      if (!savedUser) {
        throw new Error('No authenticated user found');
      }

      const currentUser = JSON.parse(savedUser);
      const userUid = currentUser.uid;

      if (!userUid) {
        throw new Error('No UID found for user');
      }

      console.log('User.me: Loading user data for UID:', userUid);

      // Search for user document by uid field (not document ID)
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const userDoc = usersSnapshot.docs.find(doc => doc.data().uid === userUid);

      if (!userDoc) {
        console.warn('User.me: User document not found in Firestore');
        // Return basic user info from session
        return {
          id: userUid,
          uid: userUid,
          displayName: currentUser.displayName,
          hebrew_name: currentUser.displayName || '',
          equipment: { vest: false, helmet: false, radio: false, weapon: false }
        };
      }

      const userData = userDoc.data();
      console.log('User.me: Loaded user data:', userData);

      return {
        id: userDoc.id,
        uid: userUid,
        ...userData,
        hebrew_name: userData.displayName || userData.hebrew_name || '',
        equipment: userData.equipment || { vest: false, helmet: false, radio: false, weapon: false }
      };
    } catch (error) {
      console.error('User.me: Error loading user data:', error);
      throw error;
    }
  }

  static async list() {
    try {
      console.log('User.list: Loading users from Firestore...');
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        const user = {
          id: doc.id,
          ...data,
          hebrew_name: data.displayName || data.hebrew_name,
          full_name: data.displayName || data.full_name,
          constraints: data.constraints || {},
          weekly_shifts: data.weekly_shifts || {}
        };

        // CRITICAL: Ensure uid field exists for shift assignments
        // Without uid, soldiers won't be able to see their assigned shifts
        if (!user.uid) {
          console.warn(`⚠️ User ${doc.id} (${user.displayName || user.hebrew_name}) is missing 'uid' field!`);
          console.warn(`⚠️ This user won't be able to see shift assignments. Please add 'uid' field to Firestore.`);
          // Fallback: use document ID as uid if missing (NOT RECOMMENDED but prevents crashes)
          user.uid = doc.id;
        }

        return user;
      });
      console.log('User.list: Loaded users:', users);
      return users.filter(user => user.role === 'soldier' || user.role === 'user');
    } catch (error) {
      console.error('User.list: Error loading from Firestore:', error);
      return []; // Return empty array instead of mock data
    }
  }

  static async updateMyUserData(data) {
    try {
      // Get current user from session (not Firebase Auth)
      const savedUser = localStorage.getItem('authUser');
      if (!savedUser) {
        console.error("User.updateMyUserData: No user in session");
        throw new Error('לא נמצא משתמש מחובר. אנא התחבר מחדש.');
      }

      const currentUser = JSON.parse(savedUser);
      const userUid = currentUser.uid;

      if (!userUid) {
        console.error("User.updateMyUserData: No UID found for user");
        throw new Error('שגיאה: לא נמצא מזהה משתמש.');
      }

      console.log("User.updateMyUserData: Updating user data for UID:", userUid);
      console.log("User.updateMyUserData: Data to update:", data);

      // Clean the data - remove undefined values to prevent Firestore errors
      const cleanData = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) {
          cleanData[key] = data[key];
        }
      });

      console.log("User.updateMyUserData: Cleaned data:", cleanData);

      // Find the document in Firestore by UID field
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const userDoc = usersSnapshot.docs.find(doc => doc.data().uid === userUid);

      if (!userDoc) {
        console.error("User.updateMyUserData: User document not found with UID:", userUid);
        throw new Error('המסמך לא נמצא במסד הנתונים. אנא צור קשר עם המנהל.');
      }

      console.log("User.updateMyUserData: Found user document with ID:", userDoc.id);

      // Add updated timestamp
      cleanData.updated_at = new Date().toISOString();

      // Update the document
      const docRef = doc(db, 'users', userDoc.id);
      await updateDoc(docRef, cleanData);

      console.log("User.updateMyUserData: Successfully updated user data in Firestore");
      return Promise.resolve();
    } catch (error) {
      console.error("User.updateMyUserData: Error updating user data:", error);
      console.error("User.updateMyUserData: Error code:", error.code);
      console.error("User.updateMyUserData: Error message:", error.message);

      // Provide more specific error messages
      if (error.code === 'not-found') {
        throw new Error('המסמך לא נמצא במסד הנתונים. אנא צור קשר עם המנהל.');
      } else if (error.code === 'permission-denied') {
        throw new Error('אין לך הרשאה לעדכן נתונים אלה.');
      } else if (error.message) {
        throw new Error(`שגיאה בעדכון הפרטים: ${error.message}`);
      } else {
        throw error;
      }
    }
  }

  static async update(id, data) {
    try {
      console.log("User.update: Starting update for user:", id);
      console.log("User.update: Data to update:", data);
      console.log("User.update: Firebase db object:", db);
      
      const userDoc = doc(db, 'users', id);
      console.log("User.update: Created document reference:", userDoc);
      
      await updateDoc(userDoc, data);
      console.log("User.update: Successfully updated user in Firestore");
      return Promise.resolve();
    } catch (error) {
      console.error("User.update: Error updating user:", error);
      console.error("User.update: Error code:", error.code);
      console.error("User.update: Error message:", error.message);
      console.error("User.update: Full error:", error);
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  static async create(data) {
    console.log("Creating user:", data);
    return Promise.resolve({ id: "new_user", ...data });
  }

  static async filter(filters) {
    console.log("Filtering users:", filters);
    return this.list();
  }

  static async delete(id) {
    console.log("Deleting user:", id);
    return Promise.resolve();
  }
}


