import React, { useState, useEffect, useRef } from 'react';
import './AppointmentModal.css';
import { FaCircle, FaCheckCircle, FaPrint, FaExchangeAlt } from 'react-icons/fa';
import { firestore } from '../../firebase';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import PrintableJobCard from '../PrintableJobCard/PrintableJobCard';
import ReactToPrint from 'react-to-print';

const timeOptions = [
  { label: '30 minutes', value: 1 },
  { label: '1 hour', value: 2 },
  { label: '1.5 hours', value: 3 },
  { label: '2 hours', value: 4 },
  { label: '2.5 hours', value: 5 },
  { label: '3 hours', value: 6 },
  { label: '3.5 hours', value: 7 },
  { label: '4 hours', value: 8 },
  { label: '4.5 hours', value: 9 },
  { label: '5 hours', value: 10 },
  { label: '5.5 hours', value: 11 },
  { label: '6 hours', value: 12 },
  { label: '6.5 hours', value: 13 },
  { label: '7 hours', value: 14 },
  { label: '7.5 hours', value: 15 },
  { label: '8 hours', value: 16 },
];

// const technicianOptions = ['Audrius', 'Adomas', 'Igor', 'Vitalik']; // Assuming these are your technician names

// Define initial form data
const initialFormData = {
  vehicleReg: '',
  vehicleMake: '',
  customerName: '',
  customerPhone: '',
  expectedTime: 1,
  needsValidation: false, // New state for validation
  tasks: [],
  inProgress: false,
  newTasksAdded: false,
  startTime: null,
  pausedTime: null,
  resumeTime: null,
  totalPausedDuration: 0,
  totalTimeSpent: null,
  isPaused: false,
  comments: '',
  technicianTimes: {}, // Stores the total time spent by each technician
  currentTechnician: null, // Track the currently active technician
  newCommentsAdded: false, // Include this field as well
  checkInTime: null, // To store the check-in time
  completionTime: null, // To store the completion time
  mileage: '', // New field for Mileage
  mileageUpdated: false, // Flag to track if mileage has been updated
};

function AppointmentModal({ appointment, onSave, onDelete, onClose, onCheckIn, startTime }) {

  // Determine the domain
  const hostname = window.location.hostname;
  let locationSuffix = '';

  if (hostname.includes('asgennislive.ie')) {
    locationSuffix = '_ennis'; // Ennis site
  } else if (hostname.includes('asglive.ie')) {
    locationSuffix = ''; // Main site
  }

  // Define the technicians array based on the domain
  const technicianOptions = hostname.includes('asgennislive.ie')
    ? ['Zenia', 'Nick', 'Vova', 'Vladik', 'Audrius']
    : ['Audrius', 'Adomas', 'Igor', 'Vitalik', 'Valera'];

  // Define the collection names
  const accountsCollectionName = 'accounts' + locationSuffix;

  const [formData, setFormData] = useState(initialFormData);
  const [newTask, setNewTask] = useState('');
  const [userRole, setUserRole] = useState('');
  const [username, setUsername] = useState('');
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false); // State for reschedule modal
  const [newTechnician, setNewTechnician] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [initialComments, setInitialComments] = useState('');
  const [vehicleRegLookupStatus, setVehicleRegLookupStatus] = useState('');


  const componentRef = useRef(); // Reference to the PrintableJobCard component
  const taskInputRef = useRef(null);
  const displayTime = appointment.id ? appointment.startTime : startTime;

  useEffect(() => {
    const role = sessionStorage.getItem('userRole');
    const storedUsername = sessionStorage.getItem('username');
    setUserRole(role);
    setUsername(storedUsername);

    if (appointment.details) {
      // Merge initialFormData with appointment.details to ensure all fields are present
      const details = appointment.details;

      // Convert any Timestamp fields to Date objects
      const convertedDetails = { ...details };

      const dateFields = ['startTime', 'resumeTime', 'pausedTime', 'checkInTime', 'completionTime']; // List all date fields

      dateFields.forEach(field => {
        if (details[field]) {
          if (details[field].toDate) {
            // If it's a Timestamp object, convert it to Date
            convertedDetails[field] = details[field].toDate();
          } else if (typeof details[field] === 'string' || typeof details[field] === 'number') {
            // If it's a string or number, convert it to Date
            convertedDetails[field] = new Date(details[field]);
          }
        }
      });

      setFormData({ ...initialFormData, ...convertedDetails });
      console.log('Loaded appointment details with converted dates:', convertedDetails);
      setInitialComments(appointment.details.comments || '');
    } else {
      // New appointment
      setFormData({ ...initialFormData });
      setInitialComments('');
    }
  }, [appointment]);


  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Handle checkbox separately
    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    // Just update the vehicleReg in formData, without performing lookup
    if (name === 'vehicleReg') {
      const updatedValue = value.toUpperCase();
      setFormData((prev) => ({ ...prev, vehicleReg: updatedValue }));
      return;
    }

    // For comments, simply update the comments in formData
    if (name === 'comments') {
      setFormData((prev) => ({
        ...prev,
        comments: value,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleExpectedTimeChange = (e) => {
    console.log('Selected time value:', e.target.value);
    setFormData((prev) => ({ ...prev, expectedTime: parseInt(e.target.value) }));
  };

  const handleAddTask = () => {
    if (newTask.trim() === '') return;
    setFormData((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { text: newTask, completed: false, completedBy: null }],
      newTasksAdded: prev.inProgress ? true : false,
      completionTime: null, // Reset completionTime when new tasks are added
    }));
    setNewTask('');
  };

  const handleToggleTaskCompletion = (index) => {
    setFormData((prev) => {
      const updatedTasks = [...prev.tasks];
      const currentTask = updatedTasks[index];
      const technician = username;

      const currentTime = new Date();
      let timeSpent = 0;

      let resumeTime = prev.resumeTime;
      let startTime = prev.startTime;
      let pausedTime = prev.pausedTime;

      // Convert to Date objects if necessary
      if (resumeTime && !(resumeTime instanceof Date)) {
        resumeTime = new Date(resumeTime);
      }

      if (startTime && !(startTime instanceof Date)) {
        startTime = new Date(startTime);
      }

      // Calculate time spent
      if (resumeTime) {
        timeSpent = Math.floor((currentTime - resumeTime) / 60000);
      } else if (startTime) {
        timeSpent = Math.floor((currentTime - startTime) / 60000);
      } else {
        console.warn('No startTime or resumeTime set. Cannot calculate timeSpent.');
        timeSpent = 0;
      }

      // Check if this is the last incomplete task
      const incompleteTasks = updatedTasks.filter((task) => !task.completed);
      const isLastTask = incompleteTasks.length === 1 && !currentTask.completed;

      // If it's the last task and mileage hasn't been updated, prevent completion
      if (isLastTask && (!prev.mileage || !prev.mileageUpdated)) {
        alert('Please update the Mileage before completing the last task.');
        return prev; // Do not update the state
      }

      currentTask.completed = !currentTask.completed;
      currentTask.completedBy = technician;
      currentTask.timeSpent = timeSpent;

      // Update technician's total time
      const updatedTechnicianTimes = { ...prev.technicianTimes };
      if (updatedTechnicianTimes[technician]) {
        updatedTechnicianTimes[technician] += timeSpent;
      } else {
        updatedTechnicianTimes[technician] = timeSpent;
      }

      // Check if all tasks are completed
      const allTasksCompleted = updatedTasks.every((task) => task.completed);

      let completionTime = prev.completionTime;
      let inProgress = prev.inProgress;

      if (allTasksCompleted && !completionTime) {
        completionTime = currentTime;
        inProgress = false; // Set inProgress to false when all tasks are completed
        // Reset timers
        startTime = null;
        resumeTime = null;
        pausedTime = null;
      }

      return {
        ...prev,
        tasks: updatedTasks,
        resumeTime: currentTask.completed ? null : currentTime,
        technicianTimes: updatedTechnicianTimes,
        completionTime,
        inProgress,
        startTime,
        pausedTime,
      };
    });
  };

  const handleCheckIn = () => {
    const currentTime = new Date();
    setFormData((prev) => ({
      ...prev,
      inProgress: true,
      startTime: prev.startTime || currentTime, // Keep original startTime if it exists
      resumeTime: currentTime, // Set resumeTime to current time
      checkInTime: prev.checkInTime || currentTime, // Keep original check-in time
      currentTechnician: username,
    }));
    onCheckIn(appointment.id);
  };



  const handlePause = () => {
    const pauseTime = new Date();
    setFormData((prev) => {
      const technicianTime = pauseTime - new Date(prev.resumeTime || prev.startTime);
      const updatedTechnicianTimes = { ...prev.technicianTimes };

      // Add the time spent to the current technician's total
      if (updatedTechnicianTimes[prev.currentTechnician]) {
        updatedTechnicianTimes[prev.currentTechnician] += Math.floor(technicianTime / 60000);
      } else {
        updatedTechnicianTimes[prev.currentTechnician] = Math.floor(technicianTime / 60000);
      }

      return {
        ...prev,
        isPaused: true,
        pausedTime: pauseTime,
        technicianTimes: updatedTechnicianTimes,
        resumeTime: null, // Reset resumeTime when paused
      };
    });
  };

  const handleResume = () => {
    const resumeTime = new Date();
    setFormData((prev) => ({
      ...prev,
      isPaused: false,
      resumeTime,
      currentTechnician: username, // Update to the current technician
    }));
  };

  const handleDeleteTask = (index) => {
    setFormData((prev) => {
      const updatedTasks = [...prev.tasks];
      updatedTasks.splice(index, 1);
      return { ...prev, tasks: updatedTasks };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let formDataToSave = { ...formData };

    if (initialComments !== formData.comments) {
      formDataToSave.newCommentsAdded = true;
    } else if (formData.newCommentsAdded) {
      formDataToSave.newCommentsAdded = false;
    }

    if (onSave) {
      onSave({
        ...appointment,
        details: formDataToSave,
      });
    }

    // Save updated mileage to the vehicle's account
    if (formData.vehicleReg && formData.mileage) {
      const accountsCollection = collection(firestore, accountsCollectionName);
      const q = query(accountsCollection, where('vehicleReg', '==', formData.vehicleReg));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, { mileage: formData.mileage });
      }
      // Optionally, create a new account if it doesn't exist
      // await addDoc(accountsCollection, {
      //   vehicleReg: formData.vehicleReg,
      //   mileage: formData.mileage,
      //   // Add other fields as needed
      // });

    }
  };


  const handleModalOpen = () => {
    setFormData((prev) => ({
      ...prev,
      newTasksAdded: false,
    }));
  };

  const handleDelete = () => {
    if (appointment.id && window.confirm('Are you sure you want to delete this appointment?')) {
      if (onDelete) {
        onDelete(appointment.id);
      }
    }
  };

  const handleReschedule = () => {
    // Open the reschedule modal
    setIsRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = () => {
    // Format the date to match the original format
    const formattedDate = new Date(newDate).toDateString(); // Converts to "Wed Sep 25 2024"

    // Create the updated appointment with the new date
    const updatedAppointment = {
      ...appointment,
      tech: newTechnician,
      date: formattedDate, // Use the formatted date
      startTime: newTime,
    };

    // Save the updated appointment
    onSave(updatedAppointment);
    setIsRescheduleModalOpen(false);
  };

  const handleVehicleRegKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent the default action (form submission)

      const updatedValue = formData.vehicleReg.trim().toUpperCase();
      if (updatedValue !== '') {
        const accountsCollection = collection(firestore, accountsCollectionName);
        const q = query(accountsCollection, where('vehicleReg', '==', updatedValue));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const accountData = querySnapshot.docs[0].data(); // Assuming vehicleReg is unique
          setFormData((prev) => ({
            ...prev,
            vehicleMake: accountData.vehicleMake || '',
            customerName: accountData.customerName || '',
            customerPhone: accountData.customerPhone || '',
            mileage: accountData.mileage || '', // Populate mileage
          }));
          setVehicleRegLookupStatus('Vehicle details loaded.');
        } else {
          // If no match is found, clear the account detail fields
          setFormData((prev) => ({
            ...prev,
            vehicleMake: '',
            customerName: '',
            customerPhone: '',
            mileage: '', // Clear mileage
          }));
          setVehicleRegLookupStatus('No matching vehicle found.');
        }
      }
    }
  };

  const handleMileageChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      mileage: value,
      mileageUpdated: true, // Set to true when the mileage is updated
    }));
  };

  const handleTaskInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      handleAddTask(); // Call the function to add the task

      // Refocus the input field
      if (taskInputRef.current) {
        taskInputRef.current.focus();
      }
    }
  };



  useEffect(() => {
    handleModalOpen();
  }, []);

  return (
    <div className="modal">
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        <div className="modal-header">
          {!appointment.id && <h2>New Appointment at {startTime}</h2>}
          {appointment.id && <h2>Edit Appointment at {displayTime}</h2>}
          <div className="icon-group">
            <ReactToPrint
              trigger={() => {
                return <FaPrint className="print-icon" title="Print Job Card" />;
              }}
              content={() => componentRef.current}
              onBeforePrint={() => console.log('Before print')}
              onAfterPrint={() => console.log('After print')}
            />
            {userRole === 'admin' && (
              <FaExchangeAlt
                className="reschedule-icon"
                title="Reschedule Appointment"
                onClick={handleReschedule}
              />
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="appointment-form">
          {/* Display check-in and completion times for admins under the header and above the Vehicle Reg field */}
          {userRole === 'admin' && (
            <div className="admin-info">
              {formData.checkInTime && (
                <p>Checked in at: {formData.checkInTime.toLocaleString()}</p>
              )}
              {formData.completionTime && (
                <p>Completed at: {formData.completionTime.toLocaleString()}</p>
              )}
            </div>
          )}

          <div className="left-section">
            <label>
              Vehicle Reg:
              <input
                type="text"
                name="vehicleReg"
                value={formData.vehicleReg}
                onChange={handleChange}
                onKeyDown={handleVehicleRegKeyDown}
                required
              />
            </label>
            {vehicleRegLookupStatus && <p>{vehicleRegLookupStatus}</p>}
            <label>
              Vehicle Make:
              <input
                type="text"
                name="vehicleMake"
                value={formData.vehicleMake}
                onChange={handleChange}
              />
            </label>
            <label>
              Mileage:
              <input
                type="text"
                name="mileage"
                value={formData.mileage}
                onChange={handleMileageChange}
              />
            </label>
            <label>
              Customer Name:
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
              />
            </label>
            <label>
              Customer Phone:
              <input
                type="text"
                name="customerPhone"
                value={formData.customerPhone}
                onChange={handleChange}
                required
              />
            </label>

            {/* Updated Expected Time and Needs Validation */}
            <div className="time-validation-section">
              <label className="expected-time-label">
                Expected Time:
              </label>
              <div className="time-validation-controls">
                <select
                  name="expectedTime"
                  value={formData.expectedTime}
                  onChange={handleExpectedTimeChange}
                  required={!formData.needsValidation} // Not required if needs validation
                >
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label className="validation-checkbox">
                  <input
                    type="checkbox"
                    name="needsValidation"
                    checked={formData.needsValidation}
                    onChange={handleChange}
                  />
                  Time Needs Confirmation
                </label>
              </div>
            </div>
          </div>

          <div className="right-section">
            <div className="todo-list-section">
              <label>To-Do List:</label>
              <ul className="todo-list">
                {formData.tasks.map((task, index) => (
                  <li key={index} className={`task-item ${task.completed ? 'completed' : ''}`}>
                    <span className="task-circle" onClick={() => handleToggleTaskCompletion(index)}>
                      {task.completed ? <FaCheckCircle /> : <FaCircle />}
                    </span>
                    <span className="task-text">{task.text}</span>
                    {task.completed && (
                      <span className="completed-by">
                        (Completed by: {task.completedBy} in {task.timeSpent}m)
                      </span>
                    )}
                    <button type="button" onClick={() => handleDeleteTask(index)}>Delete</button>
                  </li>
                ))}
              </ul>

              <div className="new-task-input">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Add a new task"
                  ref={taskInputRef} // Add this
                  onKeyDown={handleTaskInputKeyDown} // Add this
                />
                <button type="button" onClick={handleAddTask}>Add Task</button>
              </div>
            </div>

            <div className="comments-section">
              <label>Comments:</label>
              <textarea
                name="comments"
                value={formData.comments}
                onChange={handleChange}
                placeholder="Add any additional notes here..."
              />
            </div>
          </div>

          <div className="button-group">
            {!formData.inProgress && (
              <button type="button" className="checkin-button" onClick={handleCheckIn}>
                Check In
              </button>
            )}
            {formData.inProgress && !formData.isPaused && (
              <button type="button" className="pause-button" onClick={handlePause}>
                Pause Appointment
              </button>
            )}
            {formData.inProgress && formData.isPaused && (
              <button type="button" className="resume-button" onClick={handleResume}>
                Resume Appointment
              </button>
            )}
            <button type="submit" disabled={userRole !== 'admin' && !appointment.id}>
              Save Appointment
            </button>
          </div>


          {/* Only show the delete button if the user is an admin */}
          {userRole === 'admin' && appointment.id && (
            <button
              type="button"
              className="delete-button"
              onClick={handleDelete}
            >
              Delete Appointment
            </button>
          )}
        </form>

        {isRescheduleModalOpen && (
          <div className="reschedule-modal">
            <div className="reschedule-content">
              <h2>Reschedule Appointment</h2>
              <label>
                Technician:
                <select
                  value={newTechnician}
                  onChange={(e) => setNewTechnician(e.target.value)}
                >
                  <option value="">Select Technician</option>
                  {technicianOptions.map((tech) => (
                    <option key={tech} value={tech}>{tech}</option>
                  ))}
                </select>
              </label>
              <label>
                Date:
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </label>
              <label>
                Time:
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </label>
              <button onClick={handleRescheduleSubmit}>Reschedule</button>
              <button onClick={() => setIsRescheduleModalOpen(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Hidden printable area */}
        <div id="printable-area" style={{ display: 'none' }}>
          <PrintableJobCard ref={componentRef} appointment={appointment || { details: {} }} />
        </div>
      </div>
    </div>
  );
}

export default AppointmentModal;
