// Single source of truth for day names used across the UI.

export const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const DAY_NAMES_HE = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי',
  saturday: 'שבת',
};

export const DAY_LETTERS_HE = {
  sunday: 'א׳',
  monday: 'ב׳',
  tuesday: 'ג׳',
  wednesday: 'ד׳',
  thursday: 'ה׳',
  friday: 'ו׳',
  saturday: 'ש׳',
};

export const dayKeyFromDate = (date) => DAY_KEYS[new Date(date).getDay()];

/** "26/10" */
export const formatShortDate = (date) => {
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/** "א׳ 26/10 – ו׳ 31/10" for a Sunday-based week (Sun–Fri work days) */
export const formatWeekRange = (weekStart, lastDayOffset = 5) => {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(start.getDate() + lastDayOffset);
  return `${DAY_LETTERS_HE[dayKeyFromDate(start)]} ${formatShortDate(start)} – ${DAY_LETTERS_HE[dayKeyFromDate(end)]} ${formatShortDate(end)}`;
};

export const isSameDay = (a, b) => {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};
