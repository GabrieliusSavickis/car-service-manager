import React, { useState, useEffect } from 'react';
import Header from '../components/Header/Header';
import Calendar from '../components/Calendar/Calendar';
import AppointmentModal from '../components/AppointmentModal/AppointmentModal';
import { firestore } from '../firebase'; // Import Firestore
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, setDoc, onSnapshot } from 'firebase/firestore';
import DatePicker from '../components/DatePicker/DatePicker';
import './AppointmentsPage.css';

function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userRole, setUserRole] = useState('');
  const [warningMessage, setWarningMessage] = useState(''); // For showing warnings to users

  const staticBankHolidays = [
    '01/01', '17/03', '25/12', '26/12', // Fixed date holidays
  ];

  // Function to calculate dynamic holidays
  const getDynamicBankHolidays = (year) => {
    const getFirstMonday = (month) => {
      const firstDay = new Date(year, month, 1);
      const dayOfWeek = firstDay.getDay();
      return new Date(year, month, 1 + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek));
    };

    const getLastMonday = (month) => {
      const lastDay = new Date(year, month + 1, 0);
      const dayOfWeek = lastDay.getDay();
      return new Date(year, month, lastDay.getDate() - (dayOfWeek + 6) % 7);
    };

    return [
      getFirstMonday(1).toLocaleDateString('en-IE'), // February
      getFirstMonday(4).toLocaleDateString('en-IE'), // May
      getFirstMonday(5).toLocaleDateString('en-IE'), // June
      getFirstMonday(7).toLocaleDateString('en-IE'), // August
      getLastMonday(9).toLocaleDateString('en-IE')  // October
    ];
  };

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

    const fetchAppointments = () => {
      const q = query(collection(firestore, 'appointments'), where('date', '==', selectedDate.toDateString()));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedAppointments = [];
        querySnapshot.forEach(doc => {
          fetchedAppointments.push({ id: doc.id, ...doc.data() });
        });
        setAppointments(fetchedAppointments);
      });

      return () => unsubscribe(); // Clean up listener on component unmount
    };

    const unsubscribe = fetchAppointments();
    return () => unsubscribe(); // Clean up the real-time listener when the date changes or component unmounts
  }, [selectedDate]);

  const isNonWorkingDay = (date) => {
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    const formattedDate = date.toLocaleDateString('en-IE').substring(0, 5); // Format MM/DD
    const year = date.getFullYear();
    const dynamicBankHolidays = getDynamicBankHolidays(year);

    return day === 0 || day === 6 || staticBankHolidays.includes(formattedDate) || dynamicBankHolidays.includes(date.toLocaleDateString('en-IE'));
  };

  const handleTimeSlotClick = (time, tech) => {
    const selectedDay = new Date(selectedDate);

    if (isNonWorkingDay(selectedDay)) {
      setWarningMessage('This date is a bank holiday or weekend. Appointments cannot be made.');
      return;
    }

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

    if (checkOverlap(newAppointment)) {
      alert('This appointment overlaps with an existing appointment for this technician.');
      return; // Prevent saving if overlap is detected
    }

    const workdayEndIndex = timeSlots.indexOf(endOfWorkDay);
    const startTimeIndex = timeSlots.indexOf(newAppointment.startTime);
    const totalSlotsNeeded = newAppointment.details.expectedTime;

    // Calculate available slots on the first day
    const availableSlotsToday = workdayEndIndex - startTimeIndex; // Only up to the end of the day

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

      // Get the next working day
      let nextDay = getNextWorkingDay(new Date(newAppointment.date));

      // Ensure no additional appointments are created if not needed
      if (remainingSlots > 0) {
        // Create the second part of the appointment (next available working day)
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
      }
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

  const checkOverlap = (newAppointment) => {
    const { startTime, details, tech, date } = newAppointment;
    const startIndex = timeSlots.indexOf(startTime);
    const endIndex = startIndex + details.expectedTime;

    const appointmentDate = new Date(date);

    for (let app of appointments) {
      if (app.tech === tech) {
        const appDate = new Date(app.date);
        const existingStartIndex = timeSlots.indexOf(app.startTime);
        const existingEndIndex = existingStartIndex + app.details.expectedTime;

        // Check for same-day overlap
        if (appDate.toDateString() === appointmentDate.toDateString()) {
          if (startIndex < existingEndIndex && endIndex > existingStartIndex) {
            return true; // Overlap detected
          }
        }

        // Check for multi-day appointment overlap
        let remainingSlots = details.expectedTime - (timeSlots.length - startIndex);
        let nextAppointmentDate = new Date(appointmentDate);
        nextAppointmentDate.setDate(nextAppointmentDate.getDate() + 1);

        while (remainingSlots > 0 && !isNonWorkingDay(nextAppointmentDate)) {
          const nextDayAppointments = appointments.filter(app =>
            app.tech === tech && new Date(app.date).toDateString() === nextAppointmentDate.toDateString()
          );

          for (let nextDayApp of nextDayAppointments) {
            const nextDayStartIndex = timeSlots.indexOf(nextDayApp.startTime);
            const nextDayEndIndex = nextDayStartIndex + nextDayApp.details.expectedTime;

            const spanStartIndex = 0;
            const spanEndIndex = Math.min(remainingSlots, timeSlots.length);

            if (spanStartIndex < nextDayEndIndex && spanEndIndex > nextDayStartIndex) {
              return true; // Overlap detected on the next day
            }
          }

          remainingSlots -= timeSlots.length;
          nextAppointmentDate.setDate(nextAppointmentDate.getDate() + 1);
        }
      }
    }
    return false; // No overlap detected
  };

  const getNextWorkingDay = (currentDate) => {
    let nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);

    while (isNonWorkingDay(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }

    return nextDay;
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
      {warningMessage && <p className="warning-message">{warningMessage}</p>}
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
          checkOverlap={checkOverlap} // Check for overlapping appointments
        />
      )}
    </div>
  );
}

export default AppointmentsPage;
