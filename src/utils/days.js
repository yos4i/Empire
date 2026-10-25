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

/** Parse "yyyy-MM-dd" as a LOCAL date (new Date('yyyy-MM-dd') is UTC midnight). */
export const toLocalDate = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
};

/** Local "yyyy-MM-dd" */
export const toISODate = (value) => {
  const d = toLocalDate(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const dayKeyFromDate = (date) => DAY_KEYS[toLocalDate(date).getDay()];

/** "26/10" */
export const formatShortDate = (date) => {
  const d = toLocalDate(date);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/** "א׳ 26/10 – ו׳ 31/10" for a Sunday-based week (Sun–Fri work days) */
export const formatWeekRange = (weekStart, lastDayOffset = 5) => {
  const start = toLocalDate(weekStart);
  const end = new Date(start);
  end.setDate(start.getDate() + lastDayOffset);
  return `${DAY_LETTERS_HE[dayKeyFromDate(start)]} ${formatShortDate(start)} – ${DAY_LETTERS_HE[dayKeyFromDate(end)]} ${formatShortDate(end)}`;
};

export const isSameDay = (a, b) => {
  const x = toLocalDate(a);
  const y = toLocalDate(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};
