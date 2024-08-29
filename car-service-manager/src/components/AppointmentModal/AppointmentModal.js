import React, { useState, useEffect } from 'react';
import './AppointmentModal.css';
import { FaCircle, FaCheckCircle, FaPrint } from 'react-icons/fa'; // Import the print icon
import { firestore } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import PrintableJobCard from '../PrintableJobCard/PrintableJobCard';

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

function AppointmentModal({ appointment, onSave, onDelete, onClose, onCheckIn, startTime }) {
  const [formData, setFormData] = useState({
    vehicleReg: '',
    vehicleMake: '',
    customerName: '',
    customerPhone: '',
    expectedTime: 1,
    tasks: [],
    inProgress: false,
    newTasksAdded: false,
    startTime: null,
    pausedTime: null,
    resumeTime: null,
    totalPausedDuration: 0,
    totalTimeSpent: null,
    isPaused: false,
  });

  const [newTask, setNewTask] = useState('');
  const [userRole, setUserRole] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    const role = sessionStorage.getItem('userRole');
    const storedUsername = sessionStorage.getItem('username');
    setUserRole(role);
    setUsername(storedUsername);

    if (appointment.details) {
      setFormData(appointment.details);
      console.log('Loaded appointment details:', appointment.details);
    }
  }, [appointment]);

  const handleChange = async (e) => {
    const { name, value } = e.target;
    const updatedValue = name === 'vehicleReg' ? value.toUpperCase() : value;
    setFormData((prev) => ({ ...prev, [name]: updatedValue }));

    if (name === 'vehicleReg' && updatedValue.trim() !== '') {
      const accountsCollection = collection(firestore, 'accounts');
      const q = query(accountsCollection, where('vehicleReg', '==', updatedValue));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const accountData = querySnapshot.docs[0].data(); // Assuming vehicleReg is unique
        setFormData((prev) => ({
          ...prev,
          vehicleMake: accountData.vehicleMake || '',
          customerName: accountData.customerName || '',
          customerPhone: accountData.customerPhone || '',
        }));
      }
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
      newTasksAdded: formData.inProgress ? true : false,
    }));
    setNewTask('');
  };

  const handleToggleTaskCompletion = (index) => {
    setFormData((prev) => {
      const updatedTasks = [...prev.tasks];
      updatedTasks[index].completed = !updatedTasks[index].completed;
      updatedTasks[index].completedBy = updatedTasks[index].completed ? username : null;

      const allTasksCompleted = updatedTasks.every(task => task.completed);
      let totalTimeSpent = null;

      if (allTasksCompleted && !formData.totalTimeSpent) {
        const currentTime = new Date();
        const totalActiveTime = (currentTime - new Date(formData.startTime)) - formData.totalPausedDuration;
        totalTimeSpent = totalActiveTime;
      }

      return { ...prev, tasks: updatedTasks, totalTimeSpent };
    });
  };



  const handleCheckIn = () => {
    const startTime = new Date();
    setFormData((prev) => ({
      ...prev,
      inProgress: true,
      startTime,
    }));
    onCheckIn(appointment.id);
  };

  const handlePause = () => {
    setFormData((prev) => ({
      ...prev,
      isPaused: true,
      pausedTime: new Date(),
    }));
  };

  const handleResume = () => {
    const resumeTime = new Date();
    const pauseDuration = resumeTime - new Date(formData.pausedTime);
    setFormData((prev) => ({
      ...prev,
      isPaused: false,
      resumeTime,
      totalPausedDuration: prev.totalPausedDuration + pauseDuration,
    }));
  };

  const handleDeleteTask = (index) => {
    setFormData((prev) => {
      const updatedTasks = [...prev.tasks];
      updatedTasks.splice(index, 1);
      return { ...prev, tasks: updatedTasks };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) {
      onSave({ ...appointment, details: formData });
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

  // Add the handlePrint function
  const handlePrint = () => {
    const printContent = document.getElementById('printable-area').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Job Card</title>
          <link rel="stylesheet" type="text/css" href="PrintableJobCard.css" />
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
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
          {appointment.id && <h2>Edit Appointment</h2>}
          <FaPrint className="print-icon" onClick={handlePrint} title="Print Job Card" />
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Vehicle Reg:
            <input type="text" name="vehicleReg" value={formData.vehicleReg} onChange={handleChange} required />
          </label>
          <label>
            Vehicle Make:
            <input type="text" name="vehicleMake" value={formData.vehicleMake} onChange={handleChange} />
          </label>
          <label>
            Customer Name:
            <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} />
          </label>
          <label>
            Customer Phone:
            <input type="text" name="customerPhone" value={formData.customerPhone} onChange={handleChange} required />
          </label>
          <label>
            Expected Time:
            <select
              name="expectedTime"
              value={formData.expectedTime || 1}
              onChange={handleExpectedTimeChange}
              required
            >
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

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
                    <span className="completed-by"> (Completed by: {task.completedBy})</span>
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
              />
              <button type="button" onClick={handleAddTask}>Add Task</button>
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

          {appointment.id && (
            <button
              type="button"
              className="delete-button"
              onClick={handleDelete}
              disabled={userRole !== 'admin'}
            >
              Delete Appointment
            </button>
          )}
        </form>

        {formData.totalTimeSpent && (
          <p>Total Time Spent: {Math.floor(formData.totalTimeSpent / 60000)} minutes</p>
        )}


        <div id="printable-area" style={{ display: 'none' }}>
          <PrintableJobCard appointment={appointment || { details: {} }} />
        </div>

      </div>
    </div>
  );
}

export default AppointmentModal;
