import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ShiftAssignment } from '../../entities/ShiftAssignment';
import { ShiftSubmission } from '../../entities/ShiftSubmission';
import { ShiftSubmissionService } from '../../services/shiftSubmission';

// Data loaders shared by the admin overview and soldiers pages.

/** Active soldiers, normalized for the admin UI. */
export async function loadActiveSoldiers() {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        hebrew_name: data.displayName || data.hebrew_name || data.username || 'חייל חדש',
        full_name: data.displayName || data.hebrew_name || data.username || 'חייל חדש',
        personal_number: data.personal_number || 'לא מולא',
        unit: data.mission || data.unit || 'לא מולא', // mission (new) or unit (old)
        role: data.role === 'admin' ? 'admin' : 'user',
        is_active: data.is_active !== false,
        rank: data.rank || 'לא מולא',
        mission: data.mission,
        mother_unit: data.mother_unit,
        equipment_status: data.equipment_status || 'לא מולא',
        constraints: data.constraints || {},
        weekly_shifts: data.weekly_shifts || {},
        uid: data.uid,
        username: data.username,
        weapon_number: data.weapon_number,
        is_driver: data.is_driver,
        equipment: data.equipment,
        magazines: data.magazines,
        home_location: data.home_location,
        on_standby: data.on_standby || false,
        standby_reason: data.standby_reason || null,
        standby_updated_at: data.standby_updated_at || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    })
    .filter((user) => user.role === 'user' && user.is_active);
}

export async function loadSwapRequests() {
  const all = await ShiftAssignment.list();
  return all.filter((a) => a.status === 'swap_requested');
}

/**
 * Ids (uid or doc id) of soldiers who submitted a day-off for the week,
 * from both the new shift_preferences and legacy shift_submissions collections.
 */
export async function loadSubmittedIds(weekStartStr) {
  const [prefs, legacy] = await Promise.all([
    ShiftSubmissionService.getWeekPreferences(weekStartStr).catch(() => []),
    ShiftSubmission.filter({ week_start: weekStartStr }).catch(() => []),
  ]);
  const ids = new Set();
  prefs.forEach((p) => p.userId && ids.add(p.userId));
  legacy.forEach((s) => s.user_id && ids.add(s.user_id));
  return ids;
}

export const hasSubmitted = (soldier, submittedIds) =>
  submittedIds.has(soldier.uid) || submittedIds.has(soldier.id);
