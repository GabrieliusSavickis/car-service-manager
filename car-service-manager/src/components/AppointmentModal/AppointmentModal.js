import React, { useState, useEffect } from 'react';
import './AppointmentModal.css';
import { FaCircle, FaCheckCircle } from 'react-icons/fa'; // Use icons for checkbox

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
    inProgress: false,  // Track if the appointment is in progress
    newTasksAdded: false, // Track if a new task was added after check-in
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
    }
  }, [appointment]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Automatically capitalize the Vehicle Reg field
    const updatedValue = name === 'vehicleReg' ? value.toUpperCase() : value;

    setFormData((prev) => ({ ...prev, [name]: updatedValue }));
  };

  const handleExpectedTimeChange = (e) => {
    setFormData((prev) => ({ ...prev, expectedTime: parseInt(e.target.value) }));
  };

  const handleAddTask = () => {
    if (newTask.trim() === '') return;

    setFormData((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { text: newTask, completed: false, completedBy: null }],
      newTasksAdded: formData.inProgress ? true : false, // Only set this if the appointment is in progress
    }));
    setNewTask('');
  };

  const handleToggleTaskCompletion = (index) => {
    setFormData((prev) => {
      const updatedTasks = [...prev.tasks];
      updatedTasks[index].completed = !updatedTasks[index].completed;
      updatedTasks[index].completedBy = updatedTasks[index].completed ? username : null;
      return { ...prev, tasks: updatedTasks };
    });
  };

  const handleCheckIn = () => {
    setFormData((prev) => ({
      ...prev,
      inProgress: true,  // Mark appointment as in-progress
    }));
    onCheckIn(appointment.id);  // Callback to change color in Calendar
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
    // Reset the newTasksAdded flag when the modal is opened (appointment reviewed)
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

  useEffect(() => {
    handleModalOpen(); // Reset color when the modal opens
  }, []);

  return (
    <div className="modal">
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        
        {/* Display the start time when creating a new appointment */}
        {!appointment.id && <h2>New Appointment at {startTime}</h2>}
        
        {/* Display 'Edit Appointment' for existing appointments */}
        {appointment.id && <h2>Edit Appointment</h2>}
        
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
            <select name="expectedTime" value={formData.expectedTime} onChange={handleExpectedTimeChange} required>
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {/* To-do List Section */}
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

          {/* Check-In Button */}
          <button 
            type="button" 
            className="checkin-button" 
            onClick={handleCheckIn} 
            disabled={formData.inProgress} 
            style={{ display: formData.inProgress ? 'none' : 'inline-block' }}>
            Check In
          </button>

          {/* Enable save button if user is an admin or the appointment already exists (technician updating) */}
          <button type="submit" disabled={userRole !== 'admin' && !appointment.id}>Save Appointment</button>
          {appointment.id && (
            <button
              type="button"
              className="delete-button"
              onClick={handleDelete}
              disabled={userRole !== 'admin'}  // Disable for non-admins
            >
              Delete Appointment
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default AppointmentModal;
