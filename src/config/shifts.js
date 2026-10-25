export const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

export const SHIFT_TYPES = {
  "קריית_חינוך": ["בוקר", "ערב"]
};

export const SHIFT_NAMES = {
  "קריית_חינוך_בוקר": "קריית חינוך בוקר",
  "קריית_חינוך_ערב": "קריית חינוך ערב 14:30-19:30"
};

export const SHIFT_TYPES_HE = {
  "קריית_חינוך_בוקר": { name: "קריית חינוך בוקר", type: "בוקר", isLong: false },
  "קריית_חינוך_ערב": { name: "קריית חינוך ערב", type: "ערב", isLong: false }
};

export const SHIFT_REQUIREMENTS = {
  "קריית_חינוך_בוקר": { required: 18 },
  "קריית_חינוך_ערב": { required: 6 }
};

export const LONG_SHIFTS = [];

// Default hours for the evening shift cell in the weekly schedule.
export const EVENING_DEFAULT_TIMES = { start: "14:30", end: "19:30" };

// Day-specific end times for morning shifts
export const DAY_END_TIMES = {
  sunday: "14:30",
  monday: "14:30",
  tuesday: "14:30",
  wednesday: "14:30",
  thursday: "14:30",
  friday: "12:00"
};

// Names always listed first in the team schedule (shift leads), before
// regular soldiers. Match is exact on the soldier's Hebrew name.
export const PINNED_SCHEDULE_NAMES = ['עידן איזיקסון', 'שלומי ממן'];
