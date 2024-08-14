import React, { useState } from 'react';
import Header from '../components/Header/Header';
import Calendar from '../components/Calendar/Calendar';
import AppointmentModal from '../components/AppointmentModal/AppointmentModal';

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

function AppointmentsPage() {
  const [appointments, setAppointments] = useState([
    { id: 1, tech: 'Technician 1', startTime: '09:00', endTime: '10:00', description: 'Full Service', details: { vehicleReg: 'ABC123', vehicleMake: 'Toyota', customerName: 'John Doe', customerPhone: '123-456-7890', comment: 'Check brakes as well', expectedTime: 2 } },
    // ...other appointments
  ]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTimeSlotClick = (time, tech) => {
    const appointment = appointments.find(app => app.startTime === time && app.tech === tech);
    if (appointment) {
      setSelectedAppointment(appointment);
    } else {
      setSelectedAppointment({ startTime: time, tech, endTime: getEndTime(time, 1), details: { expectedTime: 1 } });
    }
    setIsModalOpen(true);
  };

  const handleSaveAppointment = (newAppointment) => {
    newAppointment.endTime = getEndTime(newAppointment.startTime, newAppointment.details.expectedTime);
    setAppointments((prev) => {
      const existingAppointmentIndex = prev.findIndex(app => app.id === newAppointment.id);
      if (existingAppointmentIndex !== -1) {
        const updatedAppointments = [...prev];
        updatedAppointments[existingAppointmentIndex] = newAppointment;
        return updatedAppointments;
      }
      return [...prev, { ...newAppointment, id: prev.length + 1 }];
    });
    setIsModalOpen(false);
  };

  const getEndTime = (startTime, duration) => {
    const startIndex = timeSlots.indexOf(startTime);
    const endIndex = startIndex + duration;
    return timeSlots[endIndex] || timeSlots[timeSlots.length - 1];
  };

  const handleDeleteAppointment = (id) => {
    setAppointments((prev) => prev.filter(app => app.id !== id));
    setIsModalOpen(false);
  };

  return (
    <div>
      <Header />
      <h1>Appointments Page</h1>
      <Calendar
        appointments={appointments}
        onTimeSlotClick={handleTimeSlotClick}
      />
      {isModalOpen && (
        <AppointmentModal
          appointment={selectedAppointment}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

export default AppointmentsPage;
