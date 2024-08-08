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

const technicians = [
  'Technician 1', 'Technician 2', 'Technician 3', 'Technician 4'
];

const getGridRowSpan = (startTime, endTime) => {
  const start = timeSlots.indexOf(startTime);
  const end = timeSlots.indexOf(endTime);
  return end - start + 1;
};

const Calendar = ({ appointments, onTimeSlotClick }) => {
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
            {technicians.map((tech, index) => (
              <div
                key={index}
                className="time-slot"
                onClick={() => onTimeSlotClick(time, tech)}
              >
                {appointments
                  .filter(app => app.tech === tech && app.startTime === time)
                  .map(app => (
                    <div
                      key={app.id}
                      className="appointment"
                      style={{ gridRow: `span ${getGridRowSpan(app.startTime, app.endTime)}` }}
                    >
                      <div>{app.details.vehicleReg}</div>
                      <div>{app.details.comment.slice(0, 20)}...</div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Calendar;
