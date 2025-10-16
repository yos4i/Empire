import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Keep only admin user for system access
const MOCK_USERS = {
  'admin': {
    username: 'admin',
    password: 'admin123',
    displayName: 'מנהל המערכת',
    role: 'admin',
    uid: 'admin-001'
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading true for auth restoration
  const [mockUsers, setMockUsers] = useState(MOCK_USERS);

  // Restore authentication state on app load
  useEffect(() => {
    const restoreAuthState = () => {
      try {
        const savedUser = localStorage.getItem('authUser');
        const savedMockUsers = localStorage.getItem('mockUsers');
        
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          console.log('AuthContext: Restored user from localStorage:', userData);
        }
        
        if (savedMockUsers) {
          const usersData = JSON.parse(savedMockUsers);
          setMockUsers(usersData);
          console.log('AuthContext: Restored mock users from localStorage');
        }
      } catch (error) {
        console.error('AuthContext: Error restoring auth state:', error);
        localStorage.removeItem('authUser');
        localStorage.removeItem('mockUsers');
      } finally {
        setLoading(false);
      }
    };

    // Small delay to prevent flash
    setTimeout(restoreAuthState, 100);
  }, []);

  const signIn = async (username, password) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      
      // First check mock users (admin)
      const mockUserData = mockUsers[username.toLowerCase()];
      if (mockUserData && mockUserData.password === password) {
        setUser(mockUserData);
        localStorage.setItem('authUser', JSON.stringify(mockUserData));
        console.log('AuthContext: Admin user logged in');
        return mockUserData;
      }
      
      // Then check Firestore for soldiers
      try {
        console.log('AuthContext: Checking Firestore for soldier login...');
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const firestoreUser = usersSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .find(user => 
            user.username?.toLowerCase() === username.toLowerCase() && 
            user.password === password &&
            user.role === 'soldier'
          );
        
        if (firestoreUser) {
          const userData = {
            username: firestoreUser.username,
            displayName: firestoreUser.displayName,
            role: 'soldier',
            uid: firestoreUser.uid || firestoreUser.id, // Use Firebase Auth UID, fallback to doc ID
            rank: firestoreUser.rank,
            unit: firestoreUser.unit,
            constraints: firestoreUser.constraints || {}
          };
          
          setUser(userData);
          localStorage.setItem('authUser', JSON.stringify(userData));
          console.log('AuthContext: Soldier logged in from Firestore:', userData);
          return userData;
        }
      } catch (firestoreError) {
        console.error('AuthContext: Error checking Firestore:', firestoreError);
      }
      
      throw new Error('שם משתמש או סיסמה שגויים');
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      setUser(null);
      // Clear localStorage on logout
      localStorage.removeItem('authUser');
      console.log('AuthContext: User logged out and removed from localStorage');
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };


  const addSoldier = async (soldierData) => {
    setLoading(true);
    try {
      console.log('AuthContext: Starting addSoldier with', soldierData);

      // Check if username already exists in local storage
      if (mockUsers[soldierData.username.toLowerCase()]) {
        throw new Error('שם משתמש כבר קיים במערכת');
      }

      // Generate unique ID
      const uid = `soldier-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create new soldier data with ONLY the required fields
      // The soldier will fill in the rest in "פרטים אישיים"
      const newSoldier = {
        username: soldierData.username.toLowerCase(),
        password: soldierData.password,
        role: 'soldier',
        is_active: true,
        created_at: new Date().toISOString(),
        uid: uid,
        // Optional fields - only include if provided
        ...(soldierData.displayName && { displayName: soldierData.displayName }),
        ...(soldierData.rank && { rank: soldierData.rank }),
        ...(soldierData.unit && { unit: soldierData.unit }),
        ...(soldierData.personal_number && { personal_number: soldierData.personal_number })
      };

      console.log('AuthContext: Prepared soldier data (minimal fields)', newSoldier);

      // Save to Firestore database
      try {
        console.log('AuthContext: Attempting to save to Firestore...');
        console.log('AuthContext: Firebase db object:', db);
        console.log('AuthContext: Data to save:', newSoldier);

        const docRef = await addDoc(collection(db, 'users'), newSoldier);
        console.log('AuthContext: SUCCESS! Soldier saved to Firestore with ID:', docRef.id);

        // Update the soldier with the Firestore document ID
        newSoldier.firestoreId = docRef.id;
      } catch (firestoreError) {
        console.error('AuthContext: FAILED to save to Firestore:', firestoreError);
        console.error('AuthContext: Error details:', {
          code: firestoreError.code,
          message: firestoreError.message,
          stack: firestoreError.stack
        });
        // Continue with local storage even if Firestore fails
        throw new Error(`Failed to save to database: ${firestoreError.message}`);
      }

      // Add to local mock users (for backward compatibility and offline support)
      const updatedMockUsers = {
        ...mockUsers,
        [soldierData.username.toLowerCase()]: newSoldier
      };
      setMockUsers(updatedMockUsers);

      // Save updated users to localStorage
      localStorage.setItem('mockUsers', JSON.stringify(updatedMockUsers));

      console.log('AuthContext: Added soldier to local storage and Firestore, returning soldier', newSoldier);
      return newSoldier;
    } catch (error) {
      console.error('AuthContext: Error in addSoldier', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    addSoldier,
    isAdmin: user?.role === 'admin',
    isSoldier: user?.role === 'soldier',
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};