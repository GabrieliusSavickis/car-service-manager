import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from '../components/Header/Header';
import Calendar from '../components/Calendar/Calendar';
import AppointmentModal from '../components/AppointmentModal/AppointmentModal';
import MechanicUnavailabilityModal from '../components/MechanicUnavailabilityModal/MechanicUnavailabilityModal';
import { firestore } from '../firebase'; // Import Firestore
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, setDoc, onSnapshot, getDocs, getDoc, deleteField, Timestamp, limit } from 'firebase/firestore';
import DatePicker from '../components/DatePicker/DatePicker';
import './AppointmentsPage.css';
import { getTechnicians, clearTechniciansCache } from '../utils/technicianUtils';
import { describeEntryWindow, entryCoversTime } from '../utils/unavailability';
import { getLocationKey, getLocationSuffix } from '../utils/location';
import { DAY_END, getTimetable } from '../utils/timetable';
import { describeNonWorkingDay, getNextWorkingDay, isNonWorkingDay } from '../utils/workingDays';

function AppointmentsPage() {
  const locationSuffix = getLocationSuffix();
  const locationKey = getLocationKey();

  // Define the collection names
  const appointmentsCollectionName = 'appointments' + locationSuffix;
  const accountsCollectionName = 'accounts' + locationSuffix;
  const unavailabilityCollectionName = 'mechanicUnavailability' + locationSuffix;

  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userRole, setUserRole] = useState('');
  const [warningMessage, setWarningMessage] = useState(''); // For showing warnings to users
  const [technicians, setTechnicians] = useState([]);
  const [unavailability, setUnavailability] = useState([]);
  const [isUnavailabilityModalOpen, setIsUnavailabilityModalOpen] = useState(false);
  const accountFlagCacheRef = useRef(new Map());
  const accountFlagInFlightRef = useRef(new Map());

  useEffect(() => {
    accountFlagCacheRef.current.clear();
    accountFlagInFlightRef.current.clear();
  }, [accountsCollectionName]);

  const fetchAccountFlagMeta = useCallback(async (vehicleReg) => {
    if (!vehicleReg) {
      return { flagged: false, flaggedReason: '' };
    }

    const reasonMap = {
      payment_overdue: 'Payment overdue',
      payment_issues: 'Payment issues',
      problematic_client: 'Problematic client',
    };

    if (accountFlagCacheRef.current.has(vehicleReg)) {
      return accountFlagCacheRef.current.get(vehicleReg);
    }

    if (accountFlagInFlightRef.current.has(vehicleReg)) {
      return accountFlagInFlightRef.current.get(vehicleReg);
    }

    const loadPromise = (async () => {
      let accountData = null;

      // Primary lookup: account doc id is normalized vehicle registration.
      const accountByIdSnapshot = await getDoc(doc(firestore, accountsCollectionName, vehicleReg));
      if (accountByIdSnapshot.exists()) {
        accountData = accountByIdSnapshot.data();
      } else {
        // Legacy fallback for older records where doc id was not the registration.
        const fallbackQuery = query(
          collection(firestore, accountsCollectionName),
          where('vehicleReg', '==', vehicleReg),
          limit(1)
        );
        const fallbackSnapshot = await getDocs(fallbackQuery);
        if (!fallbackSnapshot.empty) {
          accountData = fallbackSnapshot.docs[0].data();
        }
      }

      const flagMeta = {
        flagged: accountData?.flagged === true,
        flaggedReason: reasonMap[accountData?.flaggedReason] || accountData?.flaggedReason || '',
      };

      accountFlagCacheRef.current.set(vehicleReg, flagMeta);
      return flagMeta;
    })();

    accountFlagInFlightRef.current.set(vehicleReg, loadPromise);

    try {
      return await loadPromise;
    } finally {
      accountFlagInFlightRef.current.delete(vehicleReg);
    }
  }, [accountsCollectionName]);

  const enrichAppointmentsWithFlagMeta = useCallback(async (appointmentList) => {
    if (!appointmentList || appointmentList.length === 0) {
      return [];
    }

    const uniqueRegs = [...new Set(
      appointmentList
        .map((appointment) => appointment.details?.vehicleReg)
        .filter(Boolean)
    )];

    await Promise.all(uniqueRegs.map((vehicleReg) => fetchAccountFlagMeta(vehicleReg)));

    return appointmentList.map((appointment) => {
      const vehicleReg = appointment.details?.vehicleReg;
      const flagMeta = vehicleReg ? accountFlagCacheRef.current.get(vehicleReg) : null;

      return {
        ...appointment,
        accountFlagged: Boolean(flagMeta?.flagged),
        accountFlaggedReason: flagMeta?.flaggedReason || '',
      };
    });
  }, [fetchAccountFlagMeta]);
  

  // Which slots are bookable on a given day. Lunch differs between the two
  // garages and changed on a date, so this is looked up per day rather than
  // fixed. The end of the working day stays appended to the list, because every
  // index calculation below counts slots against it.
  const slotsForDate = useCallback((date) => {
    const day = date instanceof Date ? date : new Date(date);
    // An unreadable date falls back to the day on screen rather than to the
    // oldest lunch hour, which would be the wrong one for Ennis.
    const usable = Number.isNaN(day.getTime()) ? selectedDate : day;
    return [...getTimetable(locationKey, usable).slots, DAY_END];
  }, [locationKey, selectedDate]);

  // The day on screen, for the calendar and the pickers.
  const timetable = useMemo(
    () => getTimetable(locationKey, selectedDate),
    [locationKey, selectedDate]
  );

  const endOfWorkDay = DAY_END; // End of working hours
  const workdayStart = timetable.slots[0]; // Start of working hours

  useEffect(() => {
    const role = sessionStorage.getItem('userRole');
    setUserRole(role);

    const fetchAppointments = () => {
      const q = query(collection(firestore, appointmentsCollectionName), where('date', '==', selectedDate.toDateString()));
      const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const fetchedAppointments = [];
        querySnapshot.forEach(doc => {
          fetchedAppointments.push({ ...doc.data(), id: doc.id });
        });
        const enrichedAppointments = await enrichAppointmentsWithFlagMeta(fetchedAppointments);
        setAppointments(enrichedAppointments);
      });

      return () => unsubscribe(); // Clean up listener on component unmount
    };

    const unsubscribe = fetchAppointments();
    return () => unsubscribe(); // Clean up the real-time listener when the date changes or component unmounts
  }, [selectedDate, appointmentsCollectionName, enrichAppointmentsWithFlagMeta]);

  // Load technicians from Firestore
  useEffect(() => {
    const loadTechnicians = async () => {
      try {
        const fetchedTechnicians = await getTechnicians(locationSuffix);
        setTechnicians(fetchedTechnicians);
      } catch (error) {
        console.error('Error loading technicians:', error);
      }
    };

    loadTechnicians();
  }, [locationSuffix]);

  // Load mechanic unavailability ranges that include the selected date
  useEffect(() => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const q = query(
      collection(firestore, unavailabilityCollectionName),
      where('endDay', '>=', Timestamp.fromDate(dayStart))
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetched = [];

      querySnapshot.forEach((unavailableDoc) => {
        const data = unavailableDoc.data();
        const start = data.startDay?.toDate ? data.startDay.toDate() : new Date(data.startDay);
        const end = data.endDay?.toDate ? data.endDay.toDate() : new Date(data.endDay);

        if (start <= dayEnd && end >= dayStart) {
          fetched.push({ id: unavailableDoc.id, ...data });
        }
      });

      setUnavailability(fetched);
    });

    return () => unsubscribe();
  }, [selectedDate, unavailabilityCollectionName]);

  // Allow inline editing of technician names from the calendar
  const handleEditTechnician = async (techId, currentName) => {
    // Only allow admins to rename technicians
    const role = sessionStorage.getItem('userRole');
    if (role !== 'admin') {
      alert('Only admins can rename mechanics.');
      return;
    }

    const newName = window.prompt('Enter new name for mechanic:', currentName);
    if (!newName) return;
    const trimmed = newName.trim();
    if (trimmed === '' || trimmed === currentName) return;

    try {
      const techDocRef = doc(firestore, `technicians${locationSuffix}`, techId);
      await updateDoc(techDocRef, { name: trimmed });
      // Clear cached technicians and reload
      clearTechniciansCache();
      const refreshed = await getTechnicians(locationSuffix);
      setTechnicians(refreshed);
    } catch (error) {
      console.error('Error updating technician name:', error);
      alert('Failed to update mechanic name.');
    }
  };

  const getMechanicUnavailabilityForSlot = (techId, time) => {
    return unavailability.find(
      (entry) => entry.mechanic === techId && entryCoversTime(entry, time, timetable)
    );
  };

  const unavailabilityByTechId = unavailability.reduce((acc, entry) => {
    if (entry.mechanic) {
      acc[entry.mechanic] = [...(acc[entry.mechanic] || []), entry];
    }
    return acc;
  }, {});

  const handleTimeSlotClick = (time, techId) => {
    const selectedDay = new Date(selectedDate);

    if (isNonWorkingDay(selectedDay)) {
      setWarningMessage(`This date is ${describeNonWorkingDay(selectedDay)}. Appointments cannot be made.`);
      return;
    }

    const mechanicUnavailability = getMechanicUnavailabilityForSlot(techId, time);
    if (mechanicUnavailability) {
      const mechanicName = technicians.find((t) => t.id === techId)?.name || 'This mechanic';
      const reason = mechanicUnavailability.reason || 'Unavailable';
      const window = describeEntryWindow(mechanicUnavailability, timetable);
      setWarningMessage(`${mechanicName} is marked unavailable (${reason} - ${window}) on this date.`);
      return;
    }

    setWarningMessage('');

    // Get the technician name for matching old appointments created before switching to IDs
    const technicianName = technicians.find(t => t.id === techId)?.name;
    
    const appointment = appointments.find(app => 
      app.startTime === time && (
        app.techId === techId || 
        app.tech === techId ||
        app.tech === technicianName
      )
    );
    if (appointment) {
      setSelectedAppointment(appointment);
    } else {
      setSelectedAppointment({ startTime: time, techId, endTime: getEndTime(time), date: selectedDate.toDateString() });
    }
    setIsModalOpen(true);
  };

  const handleSaveAppointment = async (newAppointment) => {
    // Allow technicians to save only if the appointment already exists (has an ID)
    if (userRole !== 'admin' && !newAppointment.id) {
      alert('Technicians cannot create new appointments. Please contact an admin.');
      return;
    }

    // Clean the appointment: remove tech field if we have a techId (migrate to new format)
    let appointmentToSave = { ...newAppointment };
    let appointmentGroupId = appointmentToSave.appointmentGroupId || appointmentToSave.id;
    
    // For new appointments, delete the tech field completely
    if (!newAppointment.id && appointmentToSave.tech !== undefined) {
      delete appointmentToSave.tech;
    }
    // For existing appointments, we'll handle tech field deletion separately using deleteField()

    const sameDayOverlap = checkOverlap(appointmentToSave);

    if (sameDayOverlap) {
      alert('This appointment overlaps with an existing appointment for this technician.');
      return; // Prevent saving if overlap is detected
    }

    // Determine if the appointment spans multiple days
    const saveDaySlots = slotsForDate(appointmentToSave.date);
    const workdayEndIndex = saveDaySlots.indexOf(endOfWorkDay);
    const startTimeIndex = saveDaySlots.indexOf(appointmentToSave.startTime);
    const totalSlotsNeeded = appointmentToSave.details.expectedTime;

    const availableSlotsToday = workdayEndIndex - startTimeIndex;

    if (totalSlotsNeeded > availableSlotsToday) {
      // Handle multi-day appointments
      const remainingSlots = totalSlotsNeeded - availableSlotsToday;
      const nextDay = getNextWorkingDay(new Date(appointmentToSave.date));
      const nextDayOverlap = await checkNextDayOverlap(nextDay, remainingSlots, appointmentToSave.techId, appointmentToSave.appointmentGroupId);

      if (nextDayOverlap) {
        alert('The appointment would overlap with an existing appointment on the next working day.');
        return; // Prevent saving if overlap is detected on the next day
      }

      // Split the appointment into two parts (today and next working day)
      const updatedAppointment = {
        ...appointmentToSave,
        details: {
          ...appointmentToSave.details,
          expectedTime: totalSlotsNeeded,
          segmentExpectedTime: availableSlotsToday,
        },
      };
      if (appointmentGroupId !== undefined) {
        updatedAppointment.appointmentGroupId = appointmentGroupId;
      }

      if (updatedAppointment.id) {
        const appointmentRef = doc(firestore, appointmentsCollectionName, updatedAppointment.id);
        // For existing appointments, convert tech: undefined to deleteField()
        const updateData = { ...updatedAppointment };
        if (!appointmentGroupId) {
          appointmentGroupId = updatedAppointment.id;
          updateData.appointmentGroupId = appointmentGroupId;
          updatedAppointment.appointmentGroupId = appointmentGroupId;
        }
        if (updatedAppointment.tech === undefined) {
          updateData.tech = deleteField();
        }
        await updateDoc(appointmentRef, updateData);
      } else {
        // For new appointments, ensure tech field is not included
        const dataToAdd = { ...updatedAppointment };
        delete dataToAdd.tech;
        if (dataToAdd.appointmentGroupId === undefined) {
          delete dataToAdd.appointmentGroupId;
        }
        const docRef = await addDoc(collection(firestore, appointmentsCollectionName), dataToAdd);
        updatedAppointment.id = docRef.id;
        appointmentGroupId = docRef.id;
        updatedAppointment.appointmentGroupId = appointmentGroupId;
        await updateDoc(doc(firestore, appointmentsCollectionName, docRef.id), { appointmentGroupId });
      }

      appointmentToSave.id = updatedAppointment.id;
      appointmentToSave.appointmentGroupId = appointmentGroupId;
      // Day2 creation/update is handled by the group sync block below.
      // Do NOT addDoc here for existing appointments — that would create a duplicate.
    } else {
      // Save normally if it doesn't span into the next day
      if (appointmentToSave.id) {
        const appointmentRef = doc(firestore, appointmentsCollectionName, appointmentToSave.id);
        // For existing appointments, convert tech: undefined to deleteField()
        const updateData = { ...appointmentToSave };
        if (!appointmentGroupId) {
          appointmentGroupId = appointmentToSave.id;
        }
        updateData.appointmentGroupId = appointmentGroupId;
        appointmentToSave.appointmentGroupId = appointmentGroupId;
        if (appointmentToSave.tech === undefined) {
          updateData.tech = deleteField();
        }
        await updateDoc(appointmentRef, updateData);
      } else {
        // For new appointments, ensure tech field is not included
        const dataToAdd = { ...appointmentToSave };
        delete dataToAdd.tech;
        if (dataToAdd.appointmentGroupId === undefined) {
          delete dataToAdd.appointmentGroupId;
        }
        const docRef = await addDoc(collection(firestore, appointmentsCollectionName), dataToAdd);
        appointmentToSave.id = docRef.id;
        appointmentGroupId = docRef.id;
        appointmentToSave.appointmentGroupId = appointmentGroupId;
        await updateDoc(doc(firestore, appointmentsCollectionName, docRef.id), { appointmentGroupId });
      }
    }

    // Keep grouped appointment segments in sync and normalize segment durations
    if (appointmentToSave.id && appointmentToSave.appointmentGroupId) {
      const groupedQuery = query(
        collection(firestore, appointmentsCollectionName),
        where('appointmentGroupId', '==', appointmentToSave.appointmentGroupId)
      );
      const groupedSnapshot = await getDocs(groupedQuery);

      const groupedDocs = groupedSnapshot.docs
        .map((groupedDoc) => ({ ...groupedDoc.data(), id: groupedDoc.id }));

      if (groupedDocs.length > 0) {
        // The anchor is always the doc whose id equals appointmentGroupId
        // (it was set to the first created segment's doc ID at creation time)
        // The anchor is always the doc whose own id equals its appointmentGroupId
        // (appointmentGroupId is set to the first-created segment's Firestore ID)
        const anchorDoc =
          groupedDocs.find(d => d.id === d.appointmentGroupId) ||
          groupedDocs.find(d => d.id === appointmentToSave.appointmentGroupId) ||
          [...groupedDocs].sort((a, b) => {
            const ad = new Date(a.date), bd = new Date(b.date);
            if (!isNaN(ad) && !isNaN(bd) && ad - bd !== 0) return ad - bd;
            const daySlots = slotsForDate(a.date);
            return daySlots.indexOf(a.startTime) - daySlots.indexOf(b.startTime);
          })[0];
        if (!anchorDoc) return;
        const anchorId = anchorDoc.id;
        const anchorDate = anchorDoc.date;
        const anchorStartTime = anchorDoc.startTime;
        const anchorDaySlots = slotsForDate(anchorDate);
        const anchorStartIndex = anchorDaySlots.indexOf(anchorStartTime);
        const totalExpectedSlots = appointmentToSave.details.expectedTime;
        const slotsAvailableOnAnchorDay = anchorDaySlots.indexOf(endOfWorkDay) - anchorStartIndex;
        const anchorSegmentSlots = Math.min(totalExpectedSlots, slotsAvailableOnAnchorDay);
        const remainingSlots = Math.max(totalExpectedSlots - anchorSegmentSlots, 0);

        const sharedDetails = {
          ...appointmentToSave.details,
          expectedTime: totalExpectedSlots,
        };

        const anchorUpdate = {
          techId: appointmentToSave.techId,
          appointmentGroupId: appointmentToSave.appointmentGroupId,
          details: {
            ...sharedDetails,
            segmentExpectedTime: anchorSegmentSlots,
          },
        };

        if (appointmentToSave.tech === undefined) {
          anchorUpdate.tech = deleteField();
        }

        await updateDoc(doc(firestore, appointmentsCollectionName, anchorId), anchorUpdate);

        const nonAnchorDocs = groupedDocs.filter((groupedDoc) => groupedDoc.id !== anchorId);

        if (remainingSlots > 0) {
          const nextDay = getNextWorkingDay(new Date(anchorDate));
          const nextDayDateString = nextDay.toDateString();
          const secondSegment = nonAnchorDocs.find((groupedDoc) => groupedDoc.date === nextDayDateString)
            || nonAnchorDocs[0];

          const secondSegmentPayload = {
            date: nextDayDateString,
            startTime: workdayStart,
            techId: appointmentToSave.techId,
            appointmentGroupId: appointmentToSave.appointmentGroupId,
            details: {
              ...sharedDetails,
              segmentExpectedTime: remainingSlots,
            },
          };

          if (secondSegment) {
            if (appointmentToSave.tech === undefined) {
              secondSegmentPayload.tech = deleteField();
            }
            await updateDoc(doc(firestore, appointmentsCollectionName, secondSegment.id), secondSegmentPayload);
          } else {
            // addDoc does not support deleteField() — strip the tech field entirely
            const newSegmentData = { ...secondSegmentPayload };
            delete newSegmentData.tech;
            await addDoc(collection(firestore, appointmentsCollectionName), newSegmentData);
          }

          const keepIds = new Set([anchorId, secondSegment?.id].filter(Boolean));
          const extraDocs = groupedDocs.filter((groupedDoc) => !keepIds.has(groupedDoc.id));
          await Promise.all(
            extraDocs.map((groupedDoc) =>
              deleteDoc(doc(firestore, appointmentsCollectionName, groupedDoc.id))
            )
          );
        } else {
          await Promise.all(
            nonAnchorDocs.map((groupedDoc) =>
              deleteDoc(doc(firestore, appointmentsCollectionName, groupedDoc.id))
            )
          );
        }
      }
    }

    // Update the associated account information
    const accountRef = doc(firestore, accountsCollectionName, appointmentToSave.details.vehicleReg);
    const accountData = {
      vehicleReg: appointmentToSave.details.vehicleReg,
      customerName: appointmentToSave.details.customerName,
      customerPhone: appointmentToSave.details.customerPhone,
      vehicleMake: appointmentToSave.details.vehicleMake,
    };

    await setDoc(accountRef, accountData, { merge: true });

    setAppointments((prev) => {
      const existingAppointmentIndex = prev.findIndex(app => app.id === appointmentToSave.id);
      if (existingAppointmentIndex !== -1) {
        const updatedAppointments = [...prev];
        updatedAppointments[existingAppointmentIndex] = appointmentToSave;
        return updatedAppointments;
      }
      return [...prev, appointmentToSave];
    });

    setIsModalOpen(false);
  };



  const checkOverlap = (newAppointment) => {
    const { startTime, details, techId, date, id, tech, appointmentGroupId: groupId } = newAppointment;
    // Resolve technician name: prefer lookup by techId, otherwise fall back to the appointment's `tech` field
    const technicianFromId = techId ? technicians.find(t => t.id === techId)?.name : undefined;
    const technicianName = technicianFromId || tech || undefined;
    
    const appointmentDate = new Date(date);
    const startIndex = slotsForDate(appointmentDate).indexOf(startTime);
    const totalSlotsNeeded = details.segmentExpectedTime ?? details.expectedTime;

    let remainingSlots = totalSlotsNeeded;
    let currentDate = new Date(appointmentDate);
    let iterationCount = 0;

    // Helper function to check overlap for a specific day
    const checkDayOverlap = (currentDate, startIndex, remainingSlots) => {
      const isSameDay = currentDate.toDateString() === appointmentDate.toDateString();
      const appointmentsOnCurrentDay = appointments.filter(app => {
        // Exclude the current appointment by ID first
        if (app.id === id) return false;
        // Exclude siblings in the same appointment group
        if (groupId && app.appointmentGroupId === groupId) return false;
        
        // Only check same day appointments
        const sameDay = new Date(app.date).toDateString() === currentDate.toDateString();
        if (!sameDay) return false;

        // Match by ID: either app.techId or app.tech equals the new appointment's techId
        const matchById = techId ? (app.techId === techId || app.tech === techId) : false;
        
        // Match by name: app.tech equals the resolved technician name
        const matchByName = technicianName ? (app.tech === technicianName) : false;

        return matchById || matchByName;
      });
      const daySlots = slotsForDate(currentDate);

      if (isSameDay) {
        // Calculate the available slots on the current day
        const availableSlotsToday = daySlots.length - startIndex;
        const endIndex = startIndex + Math.min(availableSlotsToday, remainingSlots);

        // Check for overlap on the same day
        for (let app of appointmentsOnCurrentDay) {
          const existingStartIndex = daySlots.indexOf(app.startTime);
          const existingDuration = app.details.segmentExpectedTime ?? app.details.expectedTime;
          const existingEndIndex = existingStartIndex + existingDuration;

          if (startIndex < existingEndIndex && endIndex > existingStartIndex) {
            return true; // Overlap detected
          }
        }

        // No overlap detected on the same day, return the number of slots used today
        return Math.min(availableSlotsToday, remainingSlots);
      } else {
        // Check for overlap on subsequent days
        for (let app of appointmentsOnCurrentDay) {
          const existingStartIndex = daySlots.indexOf(app.startTime);
          const existingDuration = app.details.segmentExpectedTime ?? app.details.expectedTime;
          const existingEndIndex = existingStartIndex + existingDuration;

          const spanStartIndex = 0;
          const spanEndIndex = Math.min(remainingSlots, daySlots.length);

          if (spanStartIndex < existingEndIndex && spanEndIndex > existingStartIndex) {
            return true; // Overlap detected on the next day
          }
        }

        // No overlap detected on the next day, return the number of slots used on this day
        return Math.min(remainingSlots, daySlots.length);
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

  const checkNextDayOverlap = async (nextDay, remainingSlots, techId, appointmentGroupId) => {
    // `techId` may be either an id or a technician name (caller may pass techId || tech).
    // Determine whether it's an id known in the `technicians` list.
    const hasId = technicians.some(t => t.id === techId);
    const technicianName = hasId ? technicians.find(t => t.id === techId)?.name : techId;
    const q = query(collection(firestore, appointmentsCollectionName), where('date', '==', nextDay.toDateString()));
    const querySnapshot = await getDocs(q);

    const appointmentsOnNextDay = [];
    querySnapshot.forEach(doc => {
      appointmentsOnNextDay.push({ ...doc.data(), id: doc.id });
    });

    const nextDaySlots = slotsForDate(nextDay);
    const spanStartIndex = 0;
    const spanEndIndex = Math.min(remainingSlots, nextDaySlots.length);

    for (let app of appointmentsOnNextDay) {
      // Skip siblings of the same group — they are this appointment's own segments
      if (appointmentGroupId && app.appointmentGroupId === appointmentGroupId) continue;

      // Match by id only when we have a valid id; otherwise match by name.
      const matchById = hasId ? (app.techId === techId || app.tech === techId) : false;
      const matchByName = technicianName ? (app.tech === technicianName) : false;

      if (matchById || matchByName) {
        const existingStartIndex = nextDaySlots.indexOf(app.startTime);
        const existingDuration = app.details.segmentExpectedTime ?? app.details.expectedTime;
        const existingEndIndex = existingStartIndex + existingDuration;

        if (spanStartIndex < existingEndIndex && spanEndIndex > existingStartIndex) {
          return true; // Overlap detected
        }
      }
    }

    return false;
  };

  const handleDeleteAppointment = async (id) => {
    if (userRole !== 'admin') return; // Restrict deletion for non-admin users

    const appointmentRef = doc(firestore, appointmentsCollectionName, id);
    const appointmentSnap = await getDoc(appointmentRef);

    if (!appointmentSnap.exists()) {
      setAppointments((prev) => prev.filter(app => app.id !== id));
      setIsModalOpen(false);
      return;
    }

    const appointmentData = appointmentSnap.data();
    const appointmentGroupId = appointmentData.appointmentGroupId;

    if (appointmentGroupId) {
      const groupedQuery = query(
        collection(firestore, appointmentsCollectionName),
        where('appointmentGroupId', '==', appointmentGroupId)
      );
      const groupedSnapshot = await getDocs(groupedQuery);
      const idsToDelete = [];
      const deletePromises = [];

      groupedSnapshot.forEach((groupedDoc) => {
        idsToDelete.push(groupedDoc.id);
        deletePromises.push(deleteDoc(doc(firestore, appointmentsCollectionName, groupedDoc.id)));
      });

      await Promise.all(deletePromises);
      setAppointments((prev) => prev.filter(app => !idsToDelete.includes(app.id)));
    } else {
      await deleteDoc(appointmentRef);
      setAppointments((prev) => prev.filter(app => app.id !== id));
    }

    setIsModalOpen(false);
  };

  const getEndTime = (startTime) => {
    const daySlots = slotsForDate(selectedDate);
    const index = daySlots.indexOf(startTime);
    return daySlots[index + 2] || daySlots[daySlots.length - 1];
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleTodayClick = () => {
    setSelectedDate(new Date()); // Set the date to today's date
  };

  const handleSaveUnavailability = async ({ id, mechanic, startDay, endDay, reason, coverage, startTime, endTime }) => {
    if (userRole !== 'admin') {
      alert('Only admins can mark mechanic unavailability.');
      return;
    }

    const normalizedStart = new Date(startDay);
    normalizedStart.setHours(0, 0, 0, 0);

    const normalizedEnd = new Date(endDay);
    normalizedEnd.setHours(23, 59, 59, 999);

    const payload = {
      mechanic,
      startDay: Timestamp.fromDate(normalizedStart),
      endDay: Timestamp.fromDate(normalizedEnd),
      reason,
      coverage: coverage || 'full',
      startTime: startTime || '',
      endTime: endTime || '',
    };

    if (id) {
      await updateDoc(doc(firestore, unavailabilityCollectionName, id), payload);
      setWarningMessage('Mechanic unavailability updated.');
    } else {
      await addDoc(collection(firestore, unavailabilityCollectionName), payload);
      setWarningMessage('Mechanic unavailability saved.');
    }

    setIsUnavailabilityModalOpen(false);
  };

  const handleDeleteUnavailability = async (id) => {
    if (userRole !== 'admin') {
      alert('Only admins can delete mechanic unavailability.');
      return;
    }

    await deleteDoc(doc(firestore, unavailabilityCollectionName, id));
    setWarningMessage('Mechanic unavailability deleted.');
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
        {userRole === 'admin' && (
          <button
            className="today-button unavailable-button"
            onClick={() => setIsUnavailabilityModalOpen(true)}
          >
            Unavailability
          </button>
        )}
      </div>
      {warningMessage && <p className="warning-message">{warningMessage}</p>}
      <Calendar
        appointments={appointments}
        onTimeSlotClick={handleTimeSlotClick}
        technicians={technicians}
        onEditTechnician={handleEditTechnician}
        unavailabilityByTechId={unavailabilityByTechId}
        timetable={timetable}
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
      {isUnavailabilityModalOpen && (
        <MechanicUnavailabilityModal
          technicians={technicians}
          selectedDate={selectedDate}
          unavailabilityEntries={unavailability}
          onSave={handleSaveUnavailability}
          onDelete={handleDeleteUnavailability}
          onClose={() => setIsUnavailabilityModalOpen(false)}
        />
      )}
    </div>
  );
}

export default AppointmentsPage;
