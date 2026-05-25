// Persistence layer for the daily auto-scheduler.
// Each day's solved schedule is stored as one Firestore document keyed by
// ISO date — `daily_schedules/{YYYY-MM-DD}`.

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DaySchedule } from '../types/scheduling';

const COLLECTION = 'daily_schedules';

export async function loadDaySchedule(date: string): Promise<DaySchedule | null> {
  const ref = doc(db, COLLECTION, date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  // The Firestore representation matches DaySchedule 1:1 modulo timestamps.
  return {
    date: data.date as string,
    day: data.day as DaySchedule['day'],
    slotAssignments: (data.slotAssignments as Record<string, string[]>) || {},
    specialStates: (data.specialStates as DaySchedule['specialStates']) || {},
    unfilledSlots: (data.unfilledSlots as DaySchedule['unfilledSlots']) || [],
    staffHours: (data.staffHours as Record<string, number>) || {},
    generatedAt: data.generatedAt as string,
  };
}

export async function saveDaySchedule(schedule: DaySchedule): Promise<void> {
  const ref = doc(collection(db, COLLECTION), schedule.date);
  await setDoc(ref, {
    ...schedule,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDaySchedule(date: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, date));
}
