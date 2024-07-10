// src/components/Calendar.js
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

const appointments = [
  { id: 1, tech: 'Technician 1', startTime: '09:00', endTime: '10:00', description: 'Full Service' },
  { id: 2, tech: 'Technician 1', startTime: '11:00', endTime: '12:00', description: 'Brake Check' },
  { id: 3, tech: 'Technician 2', startTime: '10:30', endTime: '12:00', description: 'Wheel Alignment' },
  { id: 4, tech: 'Technician 2', startTime: '13:00', endTime: '14:00', description: 'Oil Change' },
  { id: 5, tech: 'Technician 3', startTime: '09:00', endTime: '10:00', description: 'Engine Diagnostic' },
  { id: 6, tech: 'Technician 3', startTime: '10:30', endTime: '11:30', description: 'Transmission Check' },
  { id: 7, tech: 'Technician 4', startTime: '11:00', endTime: '12:00', description: 'Tire Replacement' },
  { id: 8, tech: 'Technician 4', startTime: '14:00', endTime: '15:00', description: 'Battery Replacement' },
];

const getGridRowSpan = (startTime, endTime) => {
  const start = timeSlots.indexOf(startTime);
  const end = timeSlots.indexOf(endTime);
  return end - start + 1;
};

const Calendar = () => {
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
              <div key={index} className="time-slot">
                {appointments
                  .filter(app => app.tech === tech && app.startTime === time)
                  .map(app => (
                    <div
                      key={app.id}
                      className="appointment"
                      style={{ gridRow: `span ${getGridRowSpan(app.startTime, app.endTime)}` }}
                    >
                      {app.description}
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
