import React from 'react';
import './Calendar.css';

const timeSlots = [
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00', '17:30',
];

const lunchTimeSlots = ['12:30', '13:00']; // Define the lunch time slots

const technicians = [
  'Technician 1', 'Technician 2', 'Technician 3', 'Technician 4'
];

const Calendar = ({ appointments, onTimeSlotClick }) => {
  const getAppointmentDurationInSlots = (appointment) => {
    return appointment.details.expectedTime; // Expected time is in slots
  };

  const getAdjustedHeight = (duration) => {
    const totalBorderHeight = (duration - 1) * 1.75; // Border height (1px) times the number of internal borders
    return `calc(${duration * 100}% + ${totalBorderHeight}px)`;
  };

  const getAppointmentColor = (appointment) => {
    if (appointment.details.newTasksAdded) {
      return '#f44336'; // Red if new tasks were added after check-in
    }
    if (appointment.details.tasks.every(task => task.completed)) {
      return '#28a745'; // Green if all tasks are complete
    } else if (appointment.details.inProgress) {
      return '#ff9800'; // Yellow if in progress
    }
    return '#2297c2'; // Default blue for not checked-in
  };

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="time-header"></div>
        {technicians.map((tech) => (
          <div key={tech} className="tech-header">{tech}</div>
        ))}
      </div>
      <div className="calendar-body">
        {timeSlots.map((time) => (
          <div key={time} className="time-slot-row">
            <div className="time-label">{time}</div>
            {technicians.map((tech, index) => {
              const isLunchTime = lunchTimeSlots.includes(time);
              const appointment = appointments.find(app => app.startTime === time && app.tech === tech);

              return (
                <div
                  key={index}
                  className={`time-slot ${isLunchTime ? 'lunch-time-slot' : ''}`}
                  onClick={() => !isLunchTime && onTimeSlotClick(time, tech)} // Disable click during lunch
                >
                  {appointment && (
                    <div
                      key={appointment.id}
                      className="appointment"
                      style={{
                        backgroundColor: getAppointmentColor(appointment),
                        height: getAdjustedHeight(getAppointmentDurationInSlots(appointment)),
                        gridRow: `span ${getAppointmentDurationInSlots(appointment)}`,
                      }}
                    >
                      <div>{appointment.details.vehicleReg}</div>
                      <div>
                        {appointment.details.tasks && appointment.details.tasks.length > 0 
                          ? appointment.details.tasks[0].text.slice(0, 20) + '...' 
                          : 'No tasks available'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Calendar;
