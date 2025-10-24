/**
 * Browser-compatible test file for shift system
 * No Jest required - runs directly in browser
 */

import { AdminApiService } from '../services/adminApi';
import { SoldierApiService } from '../services/soldierApi';
import { ShiftDefinition } from '../entities/ShiftDefinition';

// Simple test framework for browser
const createTestRunner = () => {
  const results = [];

  const expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined || actual === null) {
        throw new Error(`Expected value to be defined, got ${actual}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    }
  });

  const runTest = async (name, testFn) => {
    try {
      console.log(`🧪 Running: ${name}`);
      await testFn();
      console.log(`✅ PASSED: ${name}`);
      results.push({ name, status: 'PASSED' });
      return true;
    } catch (error) {
      console.error(`❌ FAILED: ${name}`, error.message);
      results.push({ name, status: 'FAILED', error: error.message });
      return false;
    }
  };

  return { expect, runTest, results };
};

// Test constants
const TEST_WEEK_START = '2025-10-05';
const TEST_SOLDIER_ID = 'test_soldier_001';
const TEST_ADMIN_ID = 'admin-001';

// Individual test functions
export const shiftSystemTests = {
  
  async testSoldierSubmitPreferences() {
    const { expect } = createTestRunner();
    
    const preferences = {
      sunday: ['morning'],
      monday: ['afternoon'],
      tuesday: ['evening'],
      wednesday: [],
      thursday: ['morning'],
      friday: [],
      saturday: []
    };

    const result = await SoldierApiService.submitPreferences({
      soldierId: TEST_SOLDIER_ID,
      date: TEST_WEEK_START,
      preferences: preferences,
      priority: 3
    });

    expect(result).toBeDefined();
    expect(result.uid || result.user_id).toBe(TEST_SOLDIER_ID);
    return result;
  },

  async testAdminViewPreferences() {
    const { expect } = createTestRunner();
    
    const preferences = await AdminApiService.getShiftPreferences(TEST_WEEK_START);
    
    expect(Array.isArray(preferences)).toBe(true);
    
    // Should find our test soldier's preferences
    const soldierPref = preferences.find(p => p.soldier_id === TEST_SOLDIER_ID);
    expect(soldierPref).toBeDefined();
    
    return preferences;
  },

  async testAdminAssignShift() {
    const { expect } = createTestRunner();
    
    const assignment = await AdminApiService.assignShift({
      soldierId: TEST_SOLDIER_ID,
      date: TEST_WEEK_START,
      shiftType: 'morning',
      assignedBy: TEST_ADMIN_ID
    });

    expect(assignment).toBeDefined();
    expect(assignment.soldier_id).toBe(TEST_SOLDIER_ID);
    expect(assignment.shift_type).toBe('morning');
    
    return assignment;
  },

  async testSoldierViewAssignments() {
    const { expect } = createTestRunner();
    
    const assignments = await SoldierApiService.getMyAssignments(TEST_SOLDIER_ID, TEST_WEEK_START);
    
    expect(Array.isArray(assignments)).toBe(true);
    expect(assignments.length).toBeGreaterThan(0);
    
    const assignment = assignments[0];
    expect(assignment.soldier_id).toBe(TEST_SOLDIER_ID);
    
    return assignments;
  },

  async testSoldierConfirmAssignment() {
    const { expect } = createTestRunner();
    
    const assignments = await SoldierApiService.getMyAssignments(TEST_SOLDIER_ID, TEST_WEEK_START);
    if (assignments.length === 0) {
      throw new Error('No assignments found to confirm');
    }
    
    const assignment = assignments[0];
    const result = await SoldierApiService.confirmAssignment(assignment.id);
    expect(result).toBe(true);
    
    return result;
  },

  async testDashboardStats() {
    const { expect } = createTestRunner();
    
    const stats = await AdminApiService.getDashboardStats(TEST_WEEK_START);
    
    expect(stats).toBeDefined();
    expect(typeof stats.total_soldiers).toBe('number');
    expect(typeof stats.submitted_preferences).toBe('number');
    expect(typeof stats.total_assignments).toBe('number');
    
    return stats;
  },

  async testInitializeShiftDefinitions() {
    const { expect } = createTestRunner();
    
    await ShiftDefinition.initializeDefaults();
    const shifts = await ShiftDefinition.list();
    
    expect(Array.isArray(shifts)).toBe(true);
    expect(shifts.length).toBeGreaterThan(0);
    
    return shifts;
  }
};

// Main test runner
export const runShiftSystemTests = async () => {
  console.log('🚀 Starting Shift System Tests...');
  
  const { runTest, results } = createTestRunner();
  let passed = 0;
  let failed = 0;

  // Initialize shift definitions first
  await runTest('Initialize Shift Definitions', shiftSystemTests.testInitializeShiftDefinitions);

  // Run core tests
  const testSuccess1 = await runTest('Soldier Submit Preferences', shiftSystemTests.testSoldierSubmitPreferences);
  if (testSuccess1) passed++; else failed++;

  const testSuccess2 = await runTest('Admin View Preferences', shiftSystemTests.testAdminViewPreferences);
  if (testSuccess2) passed++; else failed++;

  const testSuccess3 = await runTest('Admin Assign Shift', shiftSystemTests.testAdminAssignShift);
  if (testSuccess3) passed++; else failed++;

  const testSuccess4 = await runTest('Soldier View Assignments', shiftSystemTests.testSoldierViewAssignments);
  if (testSuccess4) passed++; else failed++;

  const testSuccess5 = await runTest('Soldier Confirm Assignment', shiftSystemTests.testSoldierConfirmAssignment);
  if (testSuccess5) passed++; else failed++;

  const testSuccess6 = await runTest('Dashboard Stats', shiftSystemTests.testDashboardStats);
  if (testSuccess6) passed++; else failed++;

  // Summary
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Shift management system is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Check the logs above for details.');
  }

  return { passed, failed, results, success: failed === 0 };
};

// Quick test function
export const quickTest = async () => {
  try {
    console.log('🔥 Quick Test: Submit → View → Assign → Confirm');
    
    // 1. Submit preference
    console.log('Step 1: Submitting preference...');
    await shiftSystemTests.testSoldierSubmitPreferences();
    
    // 2. Admin views preferences  
    console.log('Step 2: Admin viewing preferences...');
    const prefs = await shiftSystemTests.testAdminViewPreferences();
    
    // 3. Admin assigns shift
    console.log('Step 3: Admin assigning shift...');
    await shiftSystemTests.testAdminAssignShift();
    
    // 4. Soldier views assignments
    console.log('Step 4: Soldier viewing assignments...');
    await shiftSystemTests.testSoldierViewAssignments();
    
    console.log('✅ Quick test completed successfully!');
    return { success: true, preferences: prefs.length };
    
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return { success: false, error: error.message };
  }
};

// Manual test functions for browser console
export const manualTests = {
  async testSubmission() {
    console.log('Testing submission...');
    const result = await SoldierApiService.submitPreferences({
      soldierId: TEST_SOLDIER_ID,
      date: TEST_WEEK_START,
      preferences: {
        sunday: ['morning'],
        monday: ['afternoon']
      },
      priority: 3
    });
    console.log('Submission result:', result);
    return result;
  },

  async testAssignment() {
    console.log('Testing assignment...');
    const result = await AdminApiService.assignShift({
      soldierId: TEST_SOLDIER_ID,
      date: TEST_WEEK_START,
      shiftType: 'morning',
      assignedBy: TEST_ADMIN_ID
    });
    console.log('Assignment result:', result);
    return result;
  },

  async testFullFlow() {
    return await quickTest();
  },

  async runAllTests() {
    return await runShiftSystemTests();
  }
};

// Make available in browser console
if (typeof window !== 'undefined') {
  window.shiftTests = manualTests;
  window.runShiftTests = runShiftSystemTests;
  window.quickShiftTest = quickTest;
  console.log('🧪 Shift tests loaded:');
  console.log('- window.shiftTests.* - Individual test functions');
  console.log('- window.runShiftTests() - Run all tests');
  console.log('- window.quickShiftTest() - Quick validation test');
}