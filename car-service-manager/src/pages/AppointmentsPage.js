import React, { useState, useEffect } from 'react';
import Header from '../components/Header/Header';
import Calendar from '../components/Calendar/Calendar';
import AppointmentModal from '../components/AppointmentModal/AppointmentModal';
import { firestore } from '../firebase'; // Import Firestore
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, setDoc } from 'firebase/firestore';
import DatePicker from '../components/DatePicker/DatePicker';
import './AppointmentsPage.css';

function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userRole, setUserRole] = useState('');

  // Define the time slots here
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00',
  ];

  const endOfWorkDay = '18:00'; // End of working hours
  const workdayStart = '09:00'; // Start of working hours

  useEffect(() => {
    const role = sessionStorage.getItem('userRole');
    setUserRole(role);

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
    if (userRole !== 'admin') return; // Restrict saving for non-admin users

    const workdayEndIndex = timeSlots.indexOf(endOfWorkDay);
    const startTimeIndex = timeSlots.indexOf(newAppointment.startTime);
    const totalSlotsNeeded = newAppointment.details.expectedTime;

    // Calculate available slots on the first day
    const availableSlotsToday = workdayEndIndex - startTimeIndex; // Exclude the end slot

    if (totalSlotsNeeded > availableSlotsToday) {
      // Appointment spans into the next day
      const remainingSlots = totalSlotsNeeded - availableSlotsToday;

      // Create the first part of the appointment (today)
      const updatedAppointment = {
        ...newAppointment,
        details: {
          ...newAppointment.details,
          expectedTime: availableSlotsToday, // Only fill the available slots today
        },
      };

      // Save the first part
      if (updatedAppointment.id) {
        const appointmentRef = doc(firestore, 'appointments', updatedAppointment.id);
        await updateDoc(appointmentRef, updatedAppointment);
      } else {
        const docRef = await addDoc(collection(firestore, 'appointments'), updatedAppointment);
        updatedAppointment.id = docRef.id;
      }

      // Create the second part of the appointment (next day)
      const nextDay = new Date(newAppointment.date);
      nextDay.setDate(nextDay.getDate() + 1);

      const nextDayAppointment = {
        ...newAppointment,
        date: nextDay.toDateString(),
        startTime: workdayStart,
        details: {
          ...newAppointment.details,
          expectedTime: remainingSlots, // Remaining time that spans into the next day
        },
      };

      // Save the second part
      await addDoc(collection(firestore, 'appointments'), nextDayAppointment);
    } else {
      // Save normally if it doesn't span into the next day
      if (newAppointment.id) {
        const appointmentRef = doc(firestore, 'appointments', newAppointment.id);
        await updateDoc(appointmentRef, newAppointment);
      } else {
        const docRef = await addDoc(collection(firestore, 'appointments'), newAppointment);
        newAppointment.id = docRef.id; // Set the ID of the new appointment
      }
    }

    // Update accounts
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
    if (userRole !== 'admin') return; // Restrict deletion for non-admin users

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

  const handleTodayClick = () => {
    setSelectedDate(new Date()); // Set the date to today's date
  };

  const handleCheckIn = (appointmentId) => {
    setAppointments((prevAppointments) =>
      prevAppointments.map((app) =>
        app.id === appointmentId
          ? {
              ...app,
              details: {
                ...app.details,
                inProgress: true,
                newTasksAdded: false,  // Reset any previous flags
              },
            }
          : app
      )
    );
  };

  return (
    <div>
      <Header />
      <h1>Appointments</h1>
      <div className="top-controls">
        <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
        <button className="today-button" onClick={handleTodayClick}>
          Today
        </button>
      </div>
      <Calendar
        appointments={appointments}
        onTimeSlotClick={handleTimeSlotClick}
      />
      {isModalOpen && (
        <AppointmentModal
          appointment={selectedAppointment}
          startTime={selectedAppointment?.startTime}  // Pass the startTime prop
          onSave={userRole === 'admin' ? handleSaveAppointment : null}
          onDelete={userRole === 'admin' ? handleDeleteAppointment : null}
          onClose={() => setIsModalOpen(false)}
          onCheckIn={handleCheckIn}  // Pass the check-in handler
        />
      )}
    </div>
  );
}

export default AppointmentsPage;
