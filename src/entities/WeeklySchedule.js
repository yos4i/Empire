// Mock WeeklySchedule entity for demo purposes
export class WeeklySchedule {
  static async getCurrentWeek() {
    return {
      week_start: new Date().toISOString().split('T')[0],
      week_end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      shifts: [
        { id: "1", date: new Date().toISOString().split('T')[0], shift_type: "קריית_חינוך_בוקר_07_1430", assigned_user_id: "1", status: "confirmed" }
      ],
      schedule: {},
      is_published: true,
      created_at: new Date().toISOString()
    };
  }

  static async getWeek(weekStart) { console.log("Getting week:", weekStart); return this.getCurrentWeek(); }
  static async create(data) { console.log("Creating weekly schedule:", data); return Promise.resolve({ id: "new_schedule", ...data }); }
  static async update(id, data) { console.log("Updating weekly schedule:", id, data); return Promise.resolve(); }
  static async publish(id) { console.log("Publishing weekly schedule:", id); return Promise.resolve(); }
  static async getShiftCoverage(weekStart) {
    console.log("Getting shift coverage for week:", weekStart);
    return { total_shifts: 21, covered_shifts: 18, uncovered_shifts: 3, coverage_percentage: 85.7 };
  }
  static async filter(filters) { console.log("Filtering weekly schedules:", filters); return [await this.getCurrentWeek()]; }
}


