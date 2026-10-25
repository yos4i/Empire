import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';

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
    password: 'orico123',
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
        }
        
        if (savedMockUsers) {
          const usersData = JSON.parse(savedMockUsers);
          // The admin credentials ALWAYS come from code (MOCK_USERS), never
          // from a possibly-stale localStorage copy. Otherwise a code-side
          // password change (see "עדכון סיסמת מנהל") never takes effect for
          // anyone whose browser cached the old admin entry. Cached soldiers
          // are still restored.
          setMockUsers({ ...usersData, admin: MOCK_USERS.admin });
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
    try {
      // First check mock users (admin)
      const mockUserData = mockUsers[username.toLowerCase()];
      if (mockUserData && mockUserData.password === password) {
        setUser(mockUserData);
        localStorage.setItem('authUser', JSON.stringify(mockUserData));
        return mockUserData;
      }
      
      // Then check Firestore for soldiers
      try {
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
            mission: firestoreUser.mission, // Include mission field for shift filtering
            constraints: firestoreUser.constraints || {}
          };

          setUser(userData);
          localStorage.setItem('authUser', JSON.stringify(userData));
          return userData;
        }
      } catch (firestoreError) {
        console.error('AuthContext: Error checking Firestore:', firestoreError);
      }
      
      throw new Error('שם משתמש או סיסמה שגויים');
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      // Clear localStorage on logout
      localStorage.removeItem('authUser');
    } catch (error) {
      throw error;
    }
  };


  const addSoldier = async (soldierData) => {
    try {

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


      // Save to Firestore database
      try {

        const docRef = await addDoc(collection(db, 'users'), newSoldier);

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

      return newSoldier;
    } catch (error) {
      console.error('AuthContext: Error in addSoldier', error);
      throw error;
    }
  };

  const deleteSoldier = async (soldier) => {
    try {

      // Delete from Firestore
      try {
        await deleteDoc(doc(db, 'users', soldier.id));
      } catch (firestoreError) {
        console.error('AuthContext: FAILED to delete from Firestore:', firestoreError);
        throw new Error(`Failed to delete from database: ${firestoreError.message}`);
      }

      // Remove from local mock users
      if (soldier.username) {
        const updatedMockUsers = { ...mockUsers };
        delete updatedMockUsers[soldier.username.toLowerCase()];
        setMockUsers(updatedMockUsers);

        // Save updated users to localStorage
        localStorage.setItem('mockUsers', JSON.stringify(updatedMockUsers));
      }

      return true;
    } catch (error) {
      console.error('AuthContext: Error in deleteSoldier', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    addSoldier,
    deleteSoldier,
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