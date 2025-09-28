import { MIN_SHIFTS_PER_WEEK } from '../config/app';
import { LONG_SHIFTS, DAYS } from '../config/shifts';

export const validateShiftSubmission = (submission) => {
  const errors = [];
  const warnings = [];
  const totalShifts = Object.values(submission.shifts).flat().length;
  if (totalShifts < MIN_SHIFTS_PER_WEEK) {
    errors.push(`נדרשות לפחות ${MIN_SHIFTS_PER_WEEK} משמרות. נבחרו ${totalShifts}.`);
  }
  const hasLongShift = Object.values(submission.shifts).flat().some(shift => LONG_SHIFTS.includes(shift));
  if (!hasLongShift) {
    errors.push("יש לבחור לפחות משמרת ארוכה אחת (גבולות).");
  }
  if (totalShifts > 8) {
    warnings.push(`נבחרו ${totalShifts} משמרות. זה מעל הממוצע השבועי.`);
  }
  const consecutiveDays = findConsecutiveDays(submission.shifts);
  if (consecutiveDays.length > 3) {
    warnings.push("נבחרו משמרות ביותר מ-3 ימים רצופים.");
  }
  return { isValid: errors.length === 0, errors, warnings };
};

const findConsecutiveDays = (shifts) => {
  const daysWithShifts = DAYS.filter(day => shifts[day] && shifts[day].length > 0);
  const consecutive = [];
  let currentStreak = [];
  for (let i = 0; i < daysWithShifts.length; i++) {
    const currentDayIndex = DAYS.indexOf(daysWithShifts[i]);
    const prevDayIndex = i > 0 ? DAYS.indexOf(daysWithShifts[i - 1]) : -1;
    if (prevDayIndex === -1 || currentDayIndex === prevDayIndex + 1) {
      currentStreak.push(daysWithShifts[i]);
    } else {
      if (currentStreak.length > consecutive.length) {
        consecutive.splice(0, consecutive.length, ...currentStreak);
      }
      currentStreak = [daysWithShifts[i]];
    }
  }
  if (currentStreak.length > consecutive.length) {
    consecutive.splice(0, consecutive.length, ...currentStreak);
  }
  return consecutive;
};

export const validateSoldierAssignment = (soldierId, currentAssignments, maxWeeklyShifts = 6) => {
  const errors = [];
  const warnings = [];
  const currentCount = currentAssignments[soldierId] || 0;
  if (currentCount >= maxWeeklyShifts) {
    errors.push(`החייל כבר משובץ ל-${currentCount} משמרות השבוע (מקסימום ${maxWeeklyShifts}).`);
  } else if (currentCount >= maxWeeklyShifts - 1) {
    warnings.push(`החייל קרוב למגבלת המשמרות השבועיות (${currentCount}/${maxWeeklyShifts}).`);
  }
  return { isValid: errors.length === 0, errors, warnings };
};

export const validateScheduleCompleteness = (schedule, requirements) => {
  const errors = [];
  const warnings = [];
  for (const day of DAYS) {
    for (const [shiftKey, shiftData] of Object.entries(schedule[day] || {})) {
      const requirement = requirements[shiftKey];
      if (!requirement) continue;
      const assigned = (shiftData.soldiers || []).length;
      const required = requirement.required;
      if (assigned < required) {
        errors.push(`${day} - ${shiftKey}: חסרים ${required - assigned} חיילים (${assigned}/${required}).`);
      } else if (assigned > required + 2) {
        warnings.push(`${day} - ${shiftKey}: יותר מדי חיילים (${assigned}/${required}).`);
      }
    }
  }
  return { isValid: errors.length === 0, errors, warnings };
};


