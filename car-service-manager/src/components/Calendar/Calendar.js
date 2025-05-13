// src/components/Calendar/Calendar.js
import React from 'react';
import './Calendar.css';

// Define time slots excluding lunch
const timeSlots = [
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00',  // Morning ends at 12:00
  '13:30',  // After lunch resumes at 13:30
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00', '17:30',
];

const Calendar = ({ appointments, onTimeSlotClick, technicians }) => {

  const calculateAppointmentSpan = (appointment) => {
    const startTimeIndex = timeSlots.indexOf(appointment.startTime);
    let remainingSlots = appointment.details.expectedTime;
    let totalDuration = 0;

    for (let i = startTimeIndex; i < timeSlots.length; i++) {
      if (remainingSlots <= 0) break;

      const currentSlot = timeSlots[i];

      if (currentSlot === '12:00') {
        totalDuration += 1;  // Count the 12:00 slot
        remainingSlots -= 1;

        if (remainingSlots > 0) {
          totalDuration += 1;  // Add one slot for the lunch break divider
          i++; // Skip to 13:30
        }
      } else {
        totalDuration += 1;
        remainingSlots -= 1;
      }
    }

    return totalDuration;  // Total slots the appointment spans
  };

  const getAppointmentHeight = (duration) => {
    const totalBorderHeight = (duration - 1) * 1.75; // Adjust for border heights
    return `calc(${duration * 100}% + ${totalBorderHeight}px)`;
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

  // New helper to build a "09:00 – 12:00" label
  const getAppointmentTimeRange = (appointment) => {
    const start = appointment.startTime;
    const slots = appointment.details.expectedTime;
    const startIdx = timeSlots.indexOf(start);
    const endIdx = Math.min(startIdx + slots, timeSlots.length - 1);
    const end = timeSlots[endIdx];
    return `${start} – ${end}`;
  };

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
          <div key={tech} className="tech-header">{tech}</div>
        ))}
      </div>

      <div className="calendar-body">
        {timeSlots.map((time) => (
          <React.Fragment key={time}>
            {time === '13:30' && (
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
                  (app) => app.startTime === time && app.tech === tech
                );
                return (
                  <div
                    key={techIndex}
                    className="time-slot"
                    onClick={() => onTimeSlotClick(time, tech)}
                  >
                    {appointment && (
                      <div
                        className="appointment"
                        style={{
                          backgroundColor: getAppointmentColor(appointment),
                          height: getAppointmentHeight(
                            calculateAppointmentSpan(appointment)
                          ),
                          gridRow: `span ${calculateAppointmentSpan(appointment)}`,
                        }}
                      >
                        {/* Time range in bold */}
                        <div className="appointment-time">
                          <strong>{getAppointmentTimeRange(appointment)}</strong>
                        </div>
                        {/* Vehicle reg & tasks */}
                        <div>{appointment.details.vehicleReg}</div>
                        <div>
                          {getAppointmentTaskText(
                            appointment,
                            calculateAppointmentSpan(appointment)
                          )}
                        </div>
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
