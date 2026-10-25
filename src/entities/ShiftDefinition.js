// src/entities/ShiftDefinition.js
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';

export class ShiftDefinition {
  
  // Default shifts if none exist in database
  static defaultShifts = [
    {
      id: 'morning',
      name: 'בוקר',
      name_en: 'morning',
      start_time: '06:00',
      end_time: '14:00',
      required_soldiers: 2,
      unit_specific: false,
      order: 1
    },
    {
      id: 'afternoon',
      name: 'צהריים',
      name_en: 'afternoon',
      start_time: '14:00',
      end_time: '22:00',
      required_soldiers: 2,
      unit_specific: false,
      order: 2
    },
    {
      id: 'night',
      name: 'לילה',
      name_en: 'night',
      start_time: '22:00',
      end_time: '06:00',
      required_soldiers: 1,
      unit_specific: false,
      order: 3
    }
  ];
  
  // Get all shift definitions
  static async list() {
    try {
      
      const shiftsRef = collection(db, 'shift_definitions');
      const q = query(shiftsRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      
      let shifts = [];
      
      if (snapshot.empty) {
        // Initialize with default shifts
        for (const shift of this.defaultShifts) {
          const docRef = await addDoc(shiftsRef, shift);
          shifts.push({ ...shift, id: docRef.id });
        }
      } else {
        shifts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }
      
      return shifts;
      
    } catch (error) {
      console.error('ShiftDefinition: Error fetching shifts:', error);
      // Return defaults on error
      return this.defaultShifts;
    }
  }
  
  // Create a new shift definition
  static async create(shiftData) {
    try {
      
      const shiftsRef = collection(db, 'shift_definitions');
      const docRef = await addDoc(shiftsRef, {
        ...shiftData,
        created_at: new Date()
      });
      
      return { id: docRef.id, ...shiftData };
      
    } catch (error) {
      console.error('ShiftDefinition: Error creating shift:', error);
      throw error;
    }
  }
  
  // Update a shift definition
  static async update(shiftId, updates) {
    try {
      
      const shiftRef = doc(db, 'shift_definitions', shiftId);
      await updateDoc(shiftRef, {
        ...updates,
        updated_at: new Date()
      });
      
      return { success: true };
      
    } catch (error) {
      console.error('ShiftDefinition: Error updating shift:', error);
      throw error;
    }
  }
  
  // Delete a shift definition
  static async delete(shiftId) {
    try {
      
      await deleteDoc(doc(db, 'shift_definitions', shiftId));
      
      return { success: true };
      
    } catch (error) {
      console.error('ShiftDefinition: Error deleting shift:', error);
      throw error;
    }
  }
  
  // Get shifts for a specific unit
  static async getUnitShifts(unit) {
    try {
      
      const allShifts = await this.list();
      
      // Filter shifts that are either not unit-specific or specific to this unit
      const unitShifts = allShifts.filter(shift => 
        !shift.unit_specific || shift.unit === unit
      );
      
      return unitShifts;
      
    } catch (error) {
      console.error('ShiftDefinition: Error fetching unit shifts:', error);
      return this.defaultShifts;
    }
  }
}

export default ShiftDefinition;