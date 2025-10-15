import { db } from '../config/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

export class User {
  static async me() {
    return {
      id: "1",
      username: "demo_soldier",
      hebrew_name: "חייל דמו",
      full_name: "Demo Soldier",
      personal_number: "1234567",
      weapon_number: "123456",
      radio_number: "789",
      unit: "קריית_חינוך",
      rank: "חייל",
      role: "user",
      is_active: true,
      is_driver: false,
      equipment: { vest: true, helmet: true, radio: false, weapon: true },
      vacation_days_used: 3,
      constraints: {}
    };
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
    console.log("Updating user data:", data);
    return Promise.resolve();
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


