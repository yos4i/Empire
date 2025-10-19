export const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

export const SHIFT_TYPES = {
  "קריית_חינוך": ["בוקר", "ערב"],
  "גבולות": ["בוקר"]
};

export const SHIFT_NAMES = {
  "קריית_חינוך_בוקר": "ק.חינוך בוקר",
  "קריית_חינוך_ערב": "ק.חינוך ערב (15:30-19:30)",
  "גבולות_בוקר": "גבולות בוקר"
};

export const SHIFT_TYPES_HE = {
  "קריית_חינוך_בוקר": { name: "ק.חינוך בוקר", type: "בוקר", isLong: false },
  "קריית_חינוך_ערב": { name: "ק.חינוך ערב", type: "ערב", isLong: false },
  "גבולות_בוקר": { name: "גבולות בוקר", type: "בוקר", isLong: false }
};

export const SHIFT_REQUIREMENTS = {
  "קריית_חינוך_בוקר": { required: 18},
  "קריית_חינוך_ערב": { required: 6},
  "גבולות_בוקר": { required: 6}
};

export const LONG_SHIFTS = [];

// Day-specific end times for morning shifts
export const DAY_END_TIMES = {
  sunday: "13:30",
  monday: "14:30",
  tuesday: "13:30",
  wednesday: "14:30",
  thursday: "13:30",
  friday: "12:00"
};
