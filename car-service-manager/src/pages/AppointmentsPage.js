import React, { useState, useEffect } from 'react';
import Header from '../components/Header/Header';
import Calendar from '../components/Calendar/Calendar';
import AppointmentModal from '../components/AppointmentModal/AppointmentModal';
import { firestore } from '../firebase'; // Import Firestore
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, setDoc, onSnapshot, getDocs } from 'firebase/firestore';
import DatePicker from '../components/DatePicker/DatePicker';
import './AppointmentsPage.css';

function AppointmentsPage() {
  // Determine the domain
  const hostname = window.location.hostname;
  let locationSuffix = '';

  if (hostname.includes('asgennislive.ie')) {
    locationSuffix = '_ennis'; // Ennis site
  } else if (hostname.includes('asglive.ie')) {
    locationSuffix = ''; // Main site
  }

  // Define the collection names
  const appointmentsCollectionName = 'appointments' + locationSuffix;
  const accountsCollectionName = 'accounts' + locationSuffix;

   // Define the technicians array based on the domain
   const technicians = hostname.includes('asgennislive.ie')
   ? ['Zenia', 'Nick', 'Vova', 'Vladik', 'Audrius']
   : ['Audrius', 'Adomas', 'Igor', 'Vitalik', 'Valera'];

  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userRole, setUserRole] = useState('');
  const [warningMessage, setWarningMessage] = useState(''); // For showing warnings to users

  const staticBankHolidays = [
    '01/01', '17/03', '25/12', '26/12', // Fixed date holidays
  ];

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
      const q = query(collection(firestore, appointmentsCollectionName), where('date', '==', selectedDate.toDateString()));
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
  }, [selectedDate, appointmentsCollectionName]);

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
    // Allow technicians to save only if the appointment already exists (has an ID)
    if (userRole !== 'admin' && !newAppointment.id) {
      alert('Technicians cannot create new appointments. Please contact an admin.');
      return;
    }

    const sameDayOverlap = checkOverlap(newAppointment);

    if (sameDayOverlap) {
      alert('This appointment overlaps with an existing appointment for this technician.');
      return; // Prevent saving if overlap is detected
    }

    // Determine if the appointment spans multiple days
    const workdayEndIndex = timeSlots.indexOf(endOfWorkDay);
    const startTimeIndex = timeSlots.indexOf(newAppointment.startTime);
    const totalSlotsNeeded = newAppointment.details.expectedTime;

    const availableSlotsToday = workdayEndIndex - startTimeIndex;

    if (totalSlotsNeeded > availableSlotsToday) {
      // Handle multi-day appointments
      const remainingSlots = totalSlotsNeeded - availableSlotsToday;
      const nextDay = getNextWorkingDay(new Date(newAppointment.date));
      const nextDayOverlap = await checkNextDayOverlap(nextDay, remainingSlots, newAppointment.tech);

      if (nextDayOverlap) {
        alert('The appointment would overlap with an existing appointment on the next working day.');
        return; // Prevent saving if overlap is detected on the next day
      }

      // Split the appointment into two parts (today and next working day)
      const updatedAppointment = {
        ...newAppointment,
        details: {
          ...newAppointment.details,
          expectedTime: availableSlotsToday,
        },
      };

      if (updatedAppointment.id) {
        const appointmentRef = doc(firestore, appointmentsCollectionName, updatedAppointment.id);
        await updateDoc(appointmentRef, updatedAppointment);
      } else {
        const docRef = await addDoc(collection(firestore, appointmentsCollectionName), updatedAppointment);
        updatedAppointment.id = docRef.id;
      }

      if (remainingSlots > 0) {
        const nextDayAppointment = {
          ...newAppointment,
          date: nextDay.toDateString(),
          startTime: workdayStart,
          details: {
            ...newAppointment.details,
            expectedTime: remainingSlots,
          },
        };

        await addDoc(collection(firestore, appointmentsCollectionName), nextDayAppointment);
      }
    } else {
      // Save normally if it doesn't span into the next day
      if (newAppointment.id) {
        const appointmentRef = doc(firestore, appointmentsCollectionName, newAppointment.id);
        await updateDoc(appointmentRef, newAppointment);
      } else {
        const docRef = await addDoc(collection(firestore, appointmentsCollectionName), newAppointment);
        newAppointment.id = docRef.id;
      }
    }

    // Update the associated account information
    const accountRef = doc(firestore, accountsCollectionName, newAppointment.details.vehicleReg);
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



  const checkOverlap = (newAppointment) => {
    const { startTime, details, tech, date, id } = newAppointment; // Get the appointment ID
    const startIndex = timeSlots.indexOf(startTime);
    const appointmentDate = new Date(date);
    const totalSlotsNeeded = details.expectedTime;

    let remainingSlots = totalSlotsNeeded;
    let currentDate = new Date(appointmentDate); // Use a copy of the date
    let iterationCount = 0; // Safeguard to prevent infinite loop

    // Helper function to check overlap for a specific day
    const checkDayOverlap = (currentDate, startIndex, remainingSlots) => {
      const isSameDay = currentDate.toDateString() === appointmentDate.toDateString();
      const appointmentsOnCurrentDay = appointments.filter(app => {
        // Exclude the current appointment by checking the ID
        return app.tech === tech && new Date(app.date).toDateString() === currentDate.toDateString() && app.id !== id;
      });

      if (isSameDay) {
        // Calculate the available slots on the current day
        const availableSlotsToday = timeSlots.length - startIndex;
        const endIndex = startIndex + Math.min(availableSlotsToday, remainingSlots);

        // Check for overlap on the same day
        for (let app of appointmentsOnCurrentDay) {
          const existingStartIndex = timeSlots.indexOf(app.startTime);
          const existingEndIndex = existingStartIndex + app.details.expectedTime;

          if (startIndex < existingEndIndex && endIndex > existingStartIndex) {
            return true; // Overlap detected
          }
        }

        // No overlap detected on the same day, return the number of slots used today
        return Math.min(availableSlotsToday, remainingSlots);
      } else {
        // Check for overlap on subsequent days
        for (let app of appointmentsOnCurrentDay) {
          const existingStartIndex = timeSlots.indexOf(app.startTime);
          const existingEndIndex = existingStartIndex + app.details.expectedTime;

          const spanStartIndex = 0;
          const spanEndIndex = Math.min(remainingSlots, timeSlots.length);

          if (spanStartIndex < existingEndIndex && spanEndIndex > existingStartIndex) {
            return true; // Overlap detected on the next day
          }
        }

        // No overlap detected on the next day, return the number of slots used on this day
        return Math.min(remainingSlots, timeSlots.length);
      }
    };

    // Check each day the appointment spans
    while (remainingSlots > 0) {
      iterationCount += 1;

      if (iterationCount > 100) { // Safeguard: prevent infinite loop
        console.error("Potential infinite loop detected in checkOverlap");
        return false;
      }

      // Check for overlap on the current date
      const usedSlotsToday = checkDayOverlap(currentDate, startIndex, remainingSlots);
      if (usedSlotsToday === true) {
        console.log("Overlap detected on:", currentDate);
        return true; // Overlap detected
      }

      // Decrement the remaining slots by the number of slots used today
      remainingSlots -= usedSlotsToday;

      // Move to the next working day
      const nextWorkingDay = getNextWorkingDay(new Date(currentDate));
      if (nextWorkingDay <= currentDate) {
        console.error("getNextWorkingDay did not return a valid future date.");
        break; // Prevent infinite loop if next day is not progressing
      }
      currentDate = nextWorkingDay;
    }

    return false; // No overlap detected
  };

  const checkNextDayOverlap = async (nextDay, remainingSlots, tech) => {
    const q = query(collection(firestore, appointmentsCollectionName), where('date', '==', nextDay.toDateString()));
    const querySnapshot = await getDocs(q);

    const appointmentsOnNextDay = [];
    querySnapshot.forEach(doc => {
      appointmentsOnNextDay.push({ id: doc.id, ...doc.data() });
    });

    const spanStartIndex = 0;
    const spanEndIndex = Math.min(remainingSlots, timeSlots.length);

    for (let app of appointmentsOnNextDay) {
      if (app.tech === tech) {
        const existingStartIndex = timeSlots.indexOf(app.startTime);
        const existingEndIndex = existingStartIndex + app.details.expectedTime;

        if (spanStartIndex < existingEndIndex && spanEndIndex > existingStartIndex) {
          return true; // Overlap detected
        }
      }
    }

    return false;
  };

  const getNextWorkingDay = (currentDate) => {
    let nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Safeguard: Log to check the date progression
    console.log("Initial nextDay:", nextDay);

    while (isNonWorkingDay(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);

      // Add a safeguard to prevent the infinite loop
      if (nextDay.getDate() === currentDate.getDate()) {
        console.error("Infinite loop detected in getNextWorkingDay. The date is not progressing.");
        break;
      }

      console.log("Adjusted nextDay:", nextDay);
    }

    return nextDay;
  };

  const handleDeleteAppointment = async (id) => {
    if (userRole !== 'admin') return; // Restrict deletion for non-admin users

    await deleteDoc(doc(firestore, appointmentsCollectionName, id));
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
      {warningMessage && <p className="warning-message">{warningMessage}</p>}
      <Calendar
        appointments={appointments}
        onTimeSlotClick={handleTimeSlotClick}
        technicians={technicians}
      />
      {isModalOpen && (
        <AppointmentModal
          appointment={selectedAppointment}
          startTime={selectedAppointment?.startTime}  // Pass the startTime prop
          onSave={handleSaveAppointment} // Allow both admin and technicians to save appointments
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
