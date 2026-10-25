import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User as UserEntity } from '../../entities/User';
import { useAuth } from '../../contexts/AuthContext';

// Loads the soldier's Firestore profile once for all soldier screens
// (name, mission, standby…) instead of every page calling User.me() itself.

const SoldierContext = createContext(null);

export function SoldierProvider({ children }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await UserEntity.me();
      setProfile(data);
    } catch (error) {
      console.error('SoldierProvider: failed to load profile', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const patchProfile = useCallback((patch) => {
    setProfile((prev) => ({ ...(prev || {}), ...patch }));
  }, []);

  const displayName = profile?.hebrew_name || user?.displayName || user?.username || '';
  const mission = profile?.mission || user?.mission || null;
  // Ids under which this soldier may appear in schedules (doc id and/or uid).
  const myIds = [profile?.id, profile?.uid, user?.uid].filter(Boolean);

  return (
    <SoldierContext.Provider
      value={{ profile, loading, refresh, patchProfile, displayName, mission, myIds }}
    >
      {children}
    </SoldierContext.Provider>
  );
}

export function useSoldier() {
  const ctx = useContext(SoldierContext);
  if (!ctx) throw new Error('useSoldier must be used inside <SoldierProvider>');
  return ctx;
}
