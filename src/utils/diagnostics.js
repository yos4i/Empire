/**
 * Diagnostic utilities for debugging shift management system
 * Run these in browser console to test data flow
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AdminApiService } from '../services/adminApi';
import { format, addDays, startOfWeek } from 'date-fns';
import { toWeekStartISO } from './weekKey';

export const diagnostics = {
  // Test 1: Check raw Firestore data
  async checkFirestoreCollections() {
    console.log('=== 🔍 DIAGNOSTIC: Firestore Collections ===');
    
    try {
      // Check shift_preferences
      const prefsSnapshot = await getDocs(collection(db, 'shift_preferences'));
      console.log('📋 shift_preferences count:', prefsSnapshot.size);
      
      if (prefsSnapshot.size > 0) {
        console.log('📋 Sample preferences:');
        prefsSnapshot.docs.slice(0, 3).forEach(doc => {
          console.log(`  - ${doc.id}:`, doc.data());
        });
      } else {
        console.log('⚠️ No shift preferences found in database');
      }
      
      // Check users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      console.log('👥 users count:', usersSnapshot.size);
      
      // Check shift_assignments
      const assignSnapshot = await getDocs(collection(db, 'shift_assignments'));
      console.log('📅 shift_assignments count:', assignSnapshot.size);
      
      return {
        preferences: prefsSnapshot.size,
        users: usersSnapshot.size,
        assignments: assignSnapshot.size
      };
      
    } catch (error) {
      console.error('❌ Error checking collections:', error);
      throw error;
    }
  },
  
  // Test 2: Test AdminApiService
  async testAdminService() {
    console.log('=== 🧪 DIAGNOSTIC: Admin API Service ===');
    
    try {
      const nextWeek = toWeekStartISO(addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7));
      console.log('📅 Testing week:', nextWeek);
      
      const preferences = await AdminApiService.getShiftPreferences(nextWeek);
      console.log('📋 Preferences found:', preferences.length);
      
      if (preferences.length > 0) {
        console.log('📋 Sample preference:', preferences[0]);
      }
      
      const stats = await AdminApiService.getDashboardStats(nextWeek);
      console.log('📊 Stats:', stats);
      
      return { preferences, stats };
      
    } catch (error) {
      console.error('❌ Error testing admin service:', error);
      throw error;
    }
  },
  
  // Test 3: Check specific week data
  async checkWeekData(weekStart) {
    console.log(`=== 📅 DIAGNOSTIC: Week ${weekStart} Data ===`);
    
    try {
      // Direct Firestore query
      const q = query(
        collection(db, 'shift_preferences'),
        where('weekStart', '==', weekStart)
      );
      const snapshot = await getDocs(q);
      
      console.log(`📋 Preferences for week ${weekStart}:`, snapshot.size);
      snapshot.forEach(doc => {
        console.log(`  - ${doc.id}:`, doc.data());
      });
      
      // Test admin service for same week
      const adminPrefs = await AdminApiService.getShiftPreferences(weekStart);
      console.log('🔧 Admin service result:', adminPrefs.length);
      
      return { direct: snapshot.size, service: adminPrefs.length };
      
    } catch (error) {
      console.error('❌ Error checking week data:', error);
      throw error;
    }
  },
  
  // Test 4: Submit test preference
  async submitTestPreference() {
    console.log('=== 🧪 DIAGNOSTIC: Test Submission ===');
    
    try {
      const { ShiftSubmissionService } = await import('../services/shiftSubmission');
      const nextWeek = toWeekStartISO(addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7));
      
      const testPrefs = {
        sunday: ['morning'],
        monday: ['afternoon'],
        tuesday: [],
        wednesday: ['night'],
        thursday: [],
        friday: [],
        saturday: []
      };
      
      console.log('📝 Submitting test preferences for week:', nextWeek);
      
      const result = await ShiftSubmissionService.submitPreferences(
        'test-soldier-001',
        'Test Soldier',
        nextWeek,
        testPrefs
      );
      
      console.log('✅ Test submission result:', result);
      
      // Verify it appears in admin view
      const adminPrefs = await AdminApiService.getShiftPreferences(nextWeek);
      const testPref = adminPrefs.find(p => p.soldier_id === 'test-soldier-001');
      
      if (testPref) {
        console.log('✅ Test preference visible in admin view:', testPref);
      } else {
        console.log('❌ Test preference NOT visible in admin view');
      }
      
      return { submitted: result, visible: !!testPref };
      
    } catch (error) {
      console.error('❌ Error testing submission:', error);
      throw error;
    }
  },
  
  // Run all diagnostics
  async runAll() {
    console.log('🚀 Running full diagnostic suite...\n');
    
    try {
      const collections = await this.checkFirestoreCollections();
      console.log('\n');
      
      const adminService = await this.testAdminService();
      console.log('\n');
      
      const nextWeek = toWeekStartISO(addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7));
      const weekData = await this.checkWeekData(nextWeek);
      console.log('\n');
      
      const submission = await this.submitTestPreference();
      console.log('\n');
      
      const summary = {
        collections,
        adminService: adminService.preferences.length,
        weekData,
        submission
      };
      
      console.log('📊 DIAGNOSTIC SUMMARY:', summary);
      
      // Overall health check
      if (collections.preferences > 0 && adminService.preferences.length > 0) {
        console.log('✅ System appears to be working correctly!');
      } else {
        console.log('⚠️ Potential issues detected - check individual test results');
      }
      
      return summary;
      
    } catch (error) {
      console.error('💥 Diagnostic suite failed:', error);
      throw error;
    }
  }
};

// Make available in browser console
if (typeof window !== 'undefined') {
  window.shiftDiagnostics = diagnostics;
  console.log('🔍 Shift diagnostics loaded:');
  console.log('- window.shiftDiagnostics.runAll() - Run all tests');
  console.log('- window.shiftDiagnostics.checkFirestoreCollections() - Check raw data');
  console.log('- window.shiftDiagnostics.testAdminService() - Test admin API');
  console.log('- window.shiftDiagnostics.submitTestPreference() - Test submission flow');
}

export default diagnostics;