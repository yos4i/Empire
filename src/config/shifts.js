export const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

export const SHIFT_TYPES = {
  "קריית_חינוך": ["בוקר_07_1430", "ערב_1530_1930"],
  "גבולות": ["בוקר_07_1530"]
};

export const SHIFT_NAMES = {
  "קריית_חינוך_בוקר_07_1430": "ק.חינוך בוקר (07:00-14:30)",
  "קריית_חינוך_ערב_1530_1930": "ק.חינוך ערב (15:30-19:30)",
  "גבולות_בוקר_07_1530": "גבולות בוקר (07:00-15:30)"
};

export const SHIFT_TYPES_HE = {
  "קריית_חינוך_בוקר_07_1430": { name: "ק.חינוך בוקר", type: "בוקר", isLong: false },
  "קריית_חינוך_ערב_1530_1930": { name: "ק.חינוך ערב", type: "ערב", isLong: false },
  "גבולות_בוקר_07_1530": { name: "גבולות בוקר", type: "ארוכה", isLong: true }
};

export const SHIFT_REQUIREMENTS = {
  "קריית_חינוך_בוקר_07_1430": { required: 18},
  "קריית_חינוך_ערב_1530_1930": { required: 6},
  "גבולות_בוקר_07_1530": { required: 6}
};

export const LONG_SHIFTS = ["גבולות_בוקר_07_1530"];


