import React, { useState, useEffect } from 'react';
import Header from '../components/Header/Header';
import Calendar from '../components/Calendar/Calendar';
import AppointmentModal from '../components/AppointmentModal/AppointmentModal';
import { firestore } from '../firebase'; 
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, setDoc } from 'firebase/firestore';
import DatePicker from '../components/DatePicker/DatePicker';
import './AppointmentsPage.css'; // Add a CSS file for styling

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
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date()); // State to manage the selected date

  useEffect(() => {
    const fetchAppointments = async () => {
      const q = query(collection(firestore, 'appointments'), where('date', '==', selectedDate.toDateString()));
      const querySnapshot = await getDocs(q);
      const fetchedAppointments = [];
      querySnapshot.forEach(doc => {
        fetchedAppointments.push({ id: doc.id, ...doc.data() });
      });
      setAppointments(fetchedAppointments);
    };
    fetchAppointments();
  }, [selectedDate]);

  const handleTimeSlotClick = (time, tech) => {
    const appointment = appointments.find(app => app.startTime === time && app.tech === tech);
    if (appointment) {
      setSelectedAppointment(appointment);
    } else {
      setSelectedAppointment({ startTime: time, tech, endTime: getEndTime(time), date: selectedDate.toDateString() });
    }
    setIsModalOpen(true);
  };

  const handleSaveAppointment = async (newAppointment) => {
    if (newAppointment.id) {
      const appointmentRef = doc(firestore, 'appointments', newAppointment.id);
      await updateDoc(appointmentRef, newAppointment);
    } else {
      const docRef = await addDoc(collection(firestore, 'appointments'), newAppointment);
      newAppointment.id = docRef.id;
    }

    const accountRef = doc(firestore, 'accounts', newAppointment.details.vehicleReg);
    const accountData = {
      vehicleReg: newAppointment.details.vehicleReg,
      customerName: newAppointment.details.customerName,
      customerPhone: newAppointment.details.customerPhone,
      vehicleMake: newAppointment.details.vehicleMake,
    };
    await setDoc(accountRef, accountData, { merge: true });

    setAppointments((prev) => {
      const existingAppointmentIndex = prev.findIndex(app => app.id === newAppointment.id);
      if (existingAppointmentIndex !== -1) {
        const updatedAppointments = [...prev];
        updatedAppointments[existingAppointmentIndex] = newAppointment;
        return updatedAppointments;
      }
      return [...prev, newAppointment];
    });
    setIsModalOpen(false);
  };

  const handleDeleteAppointment = async (id) => {
    await deleteDoc(doc(firestore, 'appointments', id));
    setAppointments((prev) => prev.filter(app => app.id !== id));
    setIsModalOpen(false);
  };

  const getEndTime = (startTime) => {
    const index = timeSlots.indexOf(startTime);
    return timeSlots[index + 2] || timeSlots[timeSlots.length - 1];
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  // Function to set selected date to today
  const handleTodayClick = () => {
    setSelectedDate(new Date());
  };

  return (
    <div>
      <Header />
      <h1>Appointments</h1>
      <div className="top-controls">
        <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
        <button className="today-button" onClick={handleTodayClick}>Today</button>
      </div>
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
