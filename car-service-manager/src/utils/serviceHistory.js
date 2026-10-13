// Shared logic for reading a vehicle's service history: collapsing multi-day
// jobs, ordering them, and working out when a service last happened.

// A job counts as a service when any task mentions one of these. Task text is
// free typed, so this is a best guess rather than an exact record.
export const SERVICE_KEYWORDS = [
  'service',
  'oil change',
  'oil and filter',
  'oil & filter',
  'oil+filter',
];

// Most cars here are serviced yearly; change this to shift every estimate.
export const SERVICE_INTERVAL_MONTHS = 12;

// How far ahead a service can be before it counts as coming up.
export const SERVICE_DUE_SOON_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A sortable timestamp for an appointment, tolerant of records with no usable
 * start time.
 * @param {object} appointment - An appointment document
 * @returns {number} Milliseconds since epoch, or 0 when the date is unreadable
 */
export const getAppointmentSortTime = (appointment) => {
  const date = appointment?.date || '';
  const startTime = appointment?.startTime || '';

  const combined = new Date(`${date} ${startTime}`.trim());
  if (!Number.isNaN(combined.getTime())) return combined.getTime();

  const dateOnly = new Date(date);
  return Number.isNaN(dateOnly.getTime()) ? 0 : dateOnly.getTime();
};

/**
 * Collapse the segments of a multi-day job into one entry. Appointments saved
 * before group ids existed have none, so they key on their own doc id and can
 * never be merged with anything else. This only decides what is shown or
 * counted - nothing is written or deleted.
 * @param {Array} appointments - Appointment documents, each with a sortTime
 * @returns {Array} One entry per job, carrying a segmentCount
 */
export const dedupeAppointmentSegments = (appointments) => {
  const byGroup = new Map();

  appointments.forEach((appointment) => {
    const key = appointment.appointmentGroupId || appointment.id;
    const existing = byGroup.get(key);

    if (!existing) {
      byGroup.set(key, { ...appointment, segmentCount: 1 });
      return;
    }

    const segmentCount = existing.segmentCount + 1;

    // Show the first day of a split job: the anchor doc, else the earliest segment.
    const existingIsAnchor = existing.id === existing.appointmentGroupId;
    const candidateIsAnchor = appointment.id === appointment.appointmentGroupId;

    let kept = existing;
    if (candidateIsAnchor && !existingIsAnchor) {
      kept = appointment;
    } else if (!candidateIsAnchor && !existingIsAnchor && appointment.sortTime < existing.sortTime) {
      kept = appointment;
    }

    byGroup.set(key, { ...kept, segmentCount });
  });

  return [...byGroup.values()];
};

/**
 * Whether any task on an appointment looks like a service.
 * @param {object} appointment - An appointment document
 * @returns {boolean}
 */
export const isServiceAppointment = (appointment) => {
  const tasks = appointment?.details?.tasks || [];
  if (tasks.length === 0) return false;

  const taskText = tasks.map((task) => task?.text || '').join(' ').toLowerCase();
  return SERVICE_KEYWORDS.some((keyword) => taskText.includes(keyword));
};

/**
 * Add months to a date without rolling past the end of a shorter month.
 * @param {Date} date - Starting date
 * @param {number} months - Months to add
 * @returns {Date} A new date
 */
export const addMonths = (date, months) => {
  const result = new Date(date.getTime());
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);

  // Rolled into the next month (e.g. 31 Jan + 1 month), so step back to its end.
  if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(0);
  }

  return result;
};

/**
 * Whole months between two dates, rounded down.
 * @param {Date} from - Earlier date
 * @param {Date} to - Later date
 * @returns {number}
 */
export const monthsBetween = (from, to) => {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(months, 0);
};

/**
 * Summarise one vehicle's visits: how many, when, and when a service is next
 * likely due.
 * @param {Array} appointments - Every appointment for one registration
 * @param {Date} today - The date to measure against
 * @returns {object} Visit counts, key dates and service-due estimates
 */
export const summariseServiceHistory = (appointments, today = new Date()) => {
  const withSortTime = (appointments || []).map((appointment) => ({
    ...appointment,
    sortTime: getAppointmentSortTime(appointment),
  }));

  const jobs = dedupeAppointmentSegments(withSortTime)
    .filter((job) => job.sortTime > 0)
    .sort((a, b) => a.sortTime - b.sortTime);

  const serviceJobs = jobs.filter(isServiceAppointment);
  const lastService = serviceJobs.length > 0 ? serviceJobs[serviceJobs.length - 1] : null;

  const lastServiceDate = lastService ? new Date(lastService.sortTime) : null;
  const nextServiceDue = lastServiceDate
    ? addMonths(lastServiceDate, SERVICE_INTERVAL_MONTHS)
    : null;

  const dueSoon = Boolean(
    nextServiceDue
    && (nextServiceDue.getTime() - today.getTime()) <= SERVICE_DUE_SOON_DAYS * MS_PER_DAY
  );

  return {
    totalJobs: jobs.length,
    serviceCount: serviceJobs.length,
    firstVisitDate: jobs.length > 0 ? new Date(jobs[0].sortTime) : null,
    lastVisitDate: jobs.length > 0 ? new Date(jobs[jobs.length - 1].sortTime) : null,
    lastServiceDate,
    monthsSinceService: lastServiceDate ? monthsBetween(lastServiceDate, today) : null,
    nextServiceDue,
    dueSoon,
    isOverdue: Boolean(nextServiceDue && nextServiceDue.getTime() < today.getTime()),
    jobs,
  };
};
