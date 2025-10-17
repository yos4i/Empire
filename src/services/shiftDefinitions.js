// src/services/shiftDefinitions.js
import {
  collection,
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';

// This service manages dynamic shift definitions stored in Firestore
// and provides real-time synchronization across all components

class ShiftDefinitionsService {
  constructor() {
    this.listeners = [];
    this.cachedShifts = null;
    this.isInitialized = false;
  }

  // Initialize shift definitions from static config
  async initializeFromConfig(staticConfig) {
    try {
      console.log('ShiftDefinitionsService: Initializing from config...');

      const shiftsRef = collection(db, 'shift_definitions');

      // Check if we already have definitions
      const existingSnapshot = await getDocs(shiftsRef);
      if (!existingSnapshot.empty) {
        console.log('ShiftDefinitionsService: Definitions already exist, skipping initialization');
        return;
      }

      // Convert static config to Firestore documents
      for (const [shiftKey, displayName] of Object.entries(staticConfig.SHIFT_NAMES)) {
        const requirements = staticConfig.SHIFT_REQUIREMENTS[shiftKey] || {};
        const typeInfo = staticConfig.SHIFT_TYPES_HE[shiftKey] || {};

        // Extract times from display name
        const timeMatch = displayName.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
        const startTime = timeMatch ? timeMatch[1] : '07:00';
        const endTime = timeMatch ? timeMatch[2] : '15:00';

        // Extract mission and type from key
        const parts = shiftKey.split('_');
        const mission = parts[0];
        const shiftType = parts.slice(1, parts.length - 2).join('_'); // Get middle parts

        const shiftData = {
          key: shiftKey,
          displayName: displayName,
          mission: mission,
          shiftType: shiftType,
          startTime: startTime,
          endTime: endTime,
          required: requirements.required || 0,
          isLong: typeInfo.isLong || false,
          type: typeInfo.type || 'בוקר',
          name: typeInfo.name || displayName,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Use shiftKey as document ID for easy lookup
        await setDoc(doc(db, 'shift_definitions', shiftKey), shiftData);
        console.log('ShiftDefinitionsService: Initialized shift:', shiftKey);
      }

      console.log('ShiftDefinitionsService: Initialization complete');
      this.isInitialized = true;

    } catch (error) {
      console.error('ShiftDefinitionsService: Error initializing:', error);
      throw error;
    }
  }

  // Get all shift definitions (one-time fetch)
  async getShiftDefinitions() {
    try {
      const shiftsRef = collection(db, 'shift_definitions');
      const q = query(shiftsRef, orderBy('mission', 'asc'));
      const snapshot = await getDocs(q);

      const shifts = {};
      const shiftNames = {};
      const shiftRequirements = {};
      const shiftTypesHe = {};
      const shiftTypes = {};
      const longShifts = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const key = data.key || doc.id;

        shifts[key] = data;
        shiftNames[key] = data.displayName;
        shiftRequirements[key] = {
          required: data.required,

        };
        shiftTypesHe[key] = {
          name: data.name,
          type: data.type,
          isLong: data.isLong
        };

        if (data.isLong) {
          longShifts.push(key);
        }

        // Build SHIFT_TYPES structure (mission -> shift types)
        if (!shiftTypes[data.mission]) {
          shiftTypes[data.mission] = [];
        }
        const shiftTypeKey = key.replace(`${data.mission}_`, '');
        if (!shiftTypes[data.mission].includes(shiftTypeKey)) {
          shiftTypes[data.mission].push(shiftTypeKey);
        }
      });

      this.cachedShifts = {
        SHIFT_NAMES: shiftNames,
        SHIFT_REQUIREMENTS: shiftRequirements,
        SHIFT_TYPES_HE: shiftTypesHe,
        SHIFT_TYPES: shiftTypes,
        LONG_SHIFTS: longShifts,
        rawShifts: shifts
      };

      return this.cachedShifts;

    } catch (error) {
      console.error('ShiftDefinitionsService: Error fetching shifts:', error);
      throw error;
    }
  }

  // Subscribe to real-time updates
  subscribeToShiftDefinitions(callback) {
    try {
      const shiftsRef = collection(db, 'shift_definitions');
      const q = query(shiftsRef, orderBy('mission', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('ShiftDefinitionsService: Real-time update received');

        const shifts = {};
        const shiftNames = {};
        const shiftRequirements = {};
        const shiftTypesHe = {};
        const shiftTypes = {};
        const longShifts = [];

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const key = data.key || doc.id;

          shifts[key] = data;
          shiftNames[key] = data.displayName;
          shiftRequirements[key] = {
            required: data.required,

          };
          shiftTypesHe[key] = {
            name: data.name,
            type: data.type,
            isLong: data.isLong
          };

          if (data.isLong) {
            longShifts.push(key);
          }

          // Build SHIFT_TYPES structure
          if (!shiftTypes[data.mission]) {
            shiftTypes[data.mission] = [];
          }
          const shiftTypeKey = key.replace(`${data.mission}_`, '');
          if (!shiftTypes[data.mission].includes(shiftTypeKey)) {
            shiftTypes[data.mission].push(shiftTypeKey);
          }
        });

        const updatedShifts = {
          SHIFT_NAMES: shiftNames,
          SHIFT_REQUIREMENTS: shiftRequirements,
          SHIFT_TYPES_HE: shiftTypesHe,
          SHIFT_TYPES: shiftTypes,
          LONG_SHIFTS: longShifts,
          rawShifts: shifts
        };

        this.cachedShifts = updatedShifts;
        callback(updatedShifts);
      });

      this.listeners.push(unsubscribe);
      return unsubscribe;

    } catch (error) {
      console.error('ShiftDefinitionsService: Error subscribing:', error);
      throw error;
    }
  }

  // Update shift definitions
  async updateShiftDefinitions(editedShifts) {
    try {
      console.log('ShiftDefinitionsService: Updating shifts:', editedShifts);

      const updatePromises = [];

      for (const [shiftKey, shiftData] of Object.entries(editedShifts)) {
        // Reconstruct display name with updated times
        let baseDisplayName = shiftData.displayName || shiftData.name || shiftKey;
        // Remove old time pattern
        baseDisplayName = baseDisplayName.replace(/\(\d{2}:\d{2}-\d{2}:\d{2}\)/, '').trim();
        const newDisplayName = `${baseDisplayName} (${shiftData.startTime}-${shiftData.endTime})`;

        const updatedData = {
          key: shiftKey,
          displayName: newDisplayName,
          mission: shiftData.mission,
          shiftType: shiftData.shiftType,
          startTime: shiftData.startTime,
          endTime: shiftData.endTime,
          required: shiftData.required || 0,
          isLong: shiftData.isLong || false,
          type: shiftData.type || shiftData.shiftType,
          name: shiftData.name || baseDisplayName,
          updatedAt: new Date()
        };

        console.log('ShiftDefinitionsService: Updating shift in Firestore:', shiftKey, updatedData);

        const docRef = doc(db, 'shift_definitions', shiftKey);
        updatePromises.push(setDoc(docRef, updatedData, { merge: true }));
      }

      await Promise.all(updatePromises);
      console.log('✅ ShiftDefinitionsService: All shifts updated successfully in Firestore');

      // Refresh cache
      await this.getShiftDefinitions();

      return { success: true };

    } catch (error) {
      console.error('❌ ShiftDefinitionsService: Error updating shifts:', error);
      throw error;
    }
  }

  // Cleanup all listeners
  cleanup() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];
    this.cachedShifts = null;
  }

  // Get cached shifts (or fetch if not cached)
  async getCachedShifts() {
    if (this.cachedShifts) {
      return this.cachedShifts;
    }
    return await this.getShiftDefinitions();
  }
}

// Export singleton instance
export const shiftDefinitionsService = new ShiftDefinitionsService();

export default shiftDefinitionsService;
