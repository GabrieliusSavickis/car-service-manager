// src/components/Calendar/Calendar.js
import React from 'react';
import './Calendar.css';
import { FaEdit, FaFlag, FaBox, FaBoxOpen, FaTruck } from 'react-icons/fa';
import { PARTS_STATUS, getPartsStatus, getPartsStatusLabel } from '../../utils/partsStatus';
import {
  describeEntryWindow,
  entryCoversTime,
  getEntrySlotCount,
  getEntryWindow,
} from '../../utils/unavailability';
import { getTimetable } from '../../utils/timetable';
import { getLocationKey } from '../../utils/location';

// Parts state is shown as a badge so the block's background colour keeps meaning
// job progress rather than doubling up as a parts indicator.
const PARTS_BADGES = {
  [PARTS_STATUS.NEEDED]: { icon: FaBoxOpen, className: 'appointment-parts-badge--needed' },
  [PARTS_STATUS.ORDERED]: { icon: FaTruck, className: 'appointment-parts-badge--ordered' },
  [PARTS_STATUS.RECEIVED]: { icon: FaBox, className: 'appointment-parts-badge--received' },
};

// Every slot row is exactly --calendar-row-height tall and the lunch divider
// exactly --calendar-lunch-height, both set in Calendar.css. Heights are worked
// out from those rather than from a percentage of one slot, so a block always
// finishes flush on the last row's inner edge.
const ROW_HEIGHT = 'var(--calendar-row-height)';
const LUNCH_HEIGHT = 'var(--calendar-lunch-height)';

const Calendar = ({
  appointments,
  onTimeSlotClick,
  technicians,
  onEditTechnician,
  unavailabilityByTechId = {},
  // Which slots exist, and where lunch falls, for the day being shown. Lunch
  // differs between the garages and changed on a date, so this comes from the
  // page rather than being fixed here. Defaulted so the grid still draws if a
  // caller forgets to pass it.
  timetable = getTimetable(getLocationKey(), new Date()),
}) => {
  const { slots: timeSlots, slotEndTimes, lunchAfterIndex } = timetable;

  const getFlagReasonText = (reasonValue) => {
    if (!reasonValue) return '';
    return reasonValue;
  };

  const getAppointmentDurationSlots = (appointment) => (
    appointment.details.segmentExpectedTime ?? appointment.details.expectedTime
  );

  /**
   * Work out which rows a block covers: how many bookable slots, and whether the
   * lunch divider sits inside it. The divider is its own row of a different
   * height, so it is kept separate from the slot count rather than counted as
   * another slot.
   * @param {string} startTime - The slot the block starts in
   * @param {number} slots - How many half hour slots the job is booked for
   * @returns {{slotCount: number, crossesLunch: boolean, span: number}}
   */
  const getAppointmentLayout = (startTime, slots) => {
    const startIndex = timeSlots.indexOf(startTime);
    if (startIndex === -1) return { slotCount: 0, crossesLunch: false, span: 0 };

    // Never run past the end of the day, and treat a missing duration as one
    // slot rather than letting it spill down the whole column.
    const slotCount = Math.min(
      Math.max(Number(slots) || 1, 1),
      timeSlots.length - startIndex
    );

    const lastIndex = startIndex + slotCount - 1;
    const crossesLunch = startIndex <= lunchAfterIndex && lastIndex > lunchAfterIndex;

    return { slotCount, crossesLunch, span: slotCount + (crossesLunch ? 1 : 0) };
  };

  /**
   * The exact height for a block. It starts 1px inside its first slot, so the
   * two slot borders at either end come off the total - otherwise the block
   * stops short of the last row's border and leaves a gap.
   * @param {{slotCount: number, crossesLunch: boolean}} layout - From getAppointmentLayout
   * @returns {string} A CSS height
   */
  const getAppointmentHeight = ({ slotCount, crossesLunch }) => {
    const lunchRow = crossesLunch ? ` + ${LUNCH_HEIGHT}` : '';
    return `calc(${slotCount} * ${ROW_HEIGHT}${lunchRow} - 2px)`;
  };

  const getAppointmentColor = (appointment) => {
    if (appointment.details.needsValidation) {
      return '#f44336';  // Red if the appointment needs validation
    }
    if (appointment.details.newTasksAdded) {
      return '#f44336';  // Red if new tasks were added after check-in
    }
    if (appointment.details.newCommentsAdded) {
      return '#f44336'; // Red if a new comment was added
    }
    if (appointment.details.tasks.every(task => task.completed)) {
      return '#28a745';  // Green if all tasks are complete
    } else if (appointment.details.inProgress) {
      return '#ff9800';  // Yellow if in progress
    }
    return '#2297c2';  // Default blue for not checked-in
  };

  const getAppointmentTaskText = (appointment, span) => {
    const taskText = appointment.details.tasks && appointment.details.tasks.length > 0 
      ? appointment.details.tasks.map(task => task.text).join(", ") 
      : 'No tasks available';

    const baseLimit = 20; // Adjust this number as needed
    const characterLimit = baseLimit * span;

    if (taskText.length > characterLimit) {
      return taskText.slice(0, characterLimit) + '...';
    }
    return taskText;
  };

  /**
   * Build a "09:00 – 12:00" label for a block. The end is the time its last slot
   * finishes, not the time the following slot starts, so a job up to lunch reads
   * 12:30 rather than 13:30 and the last job of the day reads 18:00.
   * @param {object} appointment - An appointment document
   * @returns {string} e.g. '17:00 – 18:00'
   */
  const getAppointmentTimeRange = (appointment) => {
    const start = appointment.startTime;
    const startIdx = timeSlots.indexOf(start);
    const { slotCount } = getAppointmentLayout(start, getAppointmentDurationSlots(appointment));

    // slotCount is already capped at the end of the day, so this stays in range.
    if (startIdx === -1 || slotCount === 0) return start;
    return `${start} – ${slotEndTimes[startIdx + slotCount - 1]}`;
  };

  // Unavailable blocks are measured the same way as appointments so they line up
  // with the grid, including the lunch break divider.
  const getUnavailabilityLayout = (entry) => getAppointmentLayout(
    getEntryWindow(entry, timetable).startTime,
    getEntrySlotCount(entry, timetable)
  );

  return (
    <div
      className="calendar-container"
      style={{
        gridTemplateColumns: `100px repeat(${technicians.length}, 1fr)`,
      }}
    >
      <div className="calendar-header">
        <div className="time-header"></div>
        {technicians.map((tech) => (
          <div key={tech.id} className="tech-header">
            <span className="tech-name">{tech.name}</span>
            {onEditTechnician && (
              <FaEdit
                className="tech-edit-icon"
                title={`Edit ${tech.name}`}
                onClick={(e) => { e.stopPropagation(); onEditTechnician(tech.id, tech.name); }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="calendar-body">
        {timeSlots.map((time, slotIndex) => (
          <React.Fragment key={time}>
            {slotIndex === lunchAfterIndex + 1 && (
              <div
                className="lunch-break-divider"
                style={{ gridColumn: `1 / span ${technicians.length + 1}` }}
              >
                <div className="lunch-break-label">Lunch Break</div>
              </div>
            )}
            <div className="time-slot-row">
              <div className="time-label">{time}</div>
              {technicians.map((tech, techIndex) => {
                const appointment = appointments.find(
                  (app) => app.startTime === time && (app.techId === tech.id || app.tech === tech.id || app.tech === tech.name)
                );
                const techUnavailability = unavailabilityByTechId[tech.id] || [];
                // A slot is blocked by any entry covering it; the block itself is
                // only drawn in the slot where that entry starts.
                const coveringEntry = techUnavailability.find(
                  (entry) => entryCoversTime(entry, time, timetable)
                );
                const startingEntry = techUnavailability.find(
                  (entry) => getEntryWindow(entry, timetable).startTime === time
                );
                const isUnavailable = Boolean(coveringEntry);
                const isFlagged = appointment?.accountFlagged === true;
                const flaggedReason = getFlagReasonText(appointment?.accountFlaggedReason);
                const flagTooltip = flaggedReason
                  ? `Flagged account: ${flaggedReason}`
                  : 'Flagged account';
                const appointmentLayout = appointment
                  ? getAppointmentLayout(appointment.startTime, getAppointmentDurationSlots(appointment))
                  : null;
                const partsStatus = getPartsStatus(appointment?.details);
                const partsBadge = PARTS_BADGES[partsStatus];
                const PartsIcon = partsBadge?.icon;
                const partsTooltip = partsBadge ? `Parts: ${getPartsStatusLabel(partsStatus)}` : '';
                const blockTooltip = [isFlagged ? flagTooltip : '', partsTooltip]
                  .filter(Boolean)
                  .join(' · ') || undefined;
                return (
                  <div
                    key={techIndex}
                    className={`time-slot ${isUnavailable ? 'unavailable-slot' : ''}`}
                    onClick={() => onTimeSlotClick(time, tech.id)}
                  >
                    {appointment && (
                      <div
                        className={`appointment${isFlagged ? ' appointment--flagged' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTimeSlotClick(time, tech.id);
                        }}
                        style={{
                          backgroundColor: getAppointmentColor(appointment),
                          height: getAppointmentHeight(appointmentLayout),
                        }}
                        title={blockTooltip}
                      >
                        {isFlagged && (
                          <span className="appointment-flag-badge" aria-label={flagTooltip}>
                            <FaFlag />
                          </span>
                        )}
                        {partsBadge && (
                          <span
                            className={`appointment-parts-badge ${partsBadge.className}`}
                            aria-label={partsTooltip}
                          >
                            <PartsIcon />
                          </span>
                        )}
                        {/* Time range in bold */}
                        <div className="appointment-time">
                          <strong>{getAppointmentTimeRange(appointment)}</strong>
                        </div>
                        {/* Vehicle reg, make & tasks */}
                        <div className="appointment-vehicle">
                          {appointment.details.vehicleReg}
                          {appointment.details.vehicleMake && (
                            <span className="appointment-vehicle-make"> · {appointment.details.vehicleMake}</span>
                          )}
                        </div>
                        <div>
                          {getAppointmentTaskText(appointment, appointmentLayout.span)}
                        </div>
                      </div>
                    )}
                    {!appointment && startingEntry && (
                      <div
                        className="appointment unavailable-appointment"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTimeSlotClick(time, tech.id);
                        }}
                        style={{
                          height: getAppointmentHeight(getUnavailabilityLayout(startingEntry)),
                        }}
                        title={`${startingEntry.reason || 'Unavailable'} · ${describeEntryWindow(startingEntry, timetable)}`}
                      >
                        <div className="appointment-time">
                          <strong>{describeEntryWindow(startingEntry, timetable)}</strong>
                        </div>
                        <div>{startingEntry.reason || 'Unavailable'}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Calendar;
