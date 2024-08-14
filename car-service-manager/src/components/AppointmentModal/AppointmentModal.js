import React, { useState, useEffect } from 'react';
import './AppointmentModal.css';

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

function AppointmentModal({ appointment, onSave, onClose }) {
  const [formData, setFormData] = useState({
    vehicleReg: '',
    vehicleMake: '',
    customerName: '',
    customerPhone: '',
    comment: '',
    expectedTime: 1,  // Default to 30 minutes
  });

  useEffect(() => {
    if (appointment.details) {
      setFormData(appointment.details);
    }
  }, [appointment]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleExpectedTimeChange = (e) => {
    setFormData((prev) => ({ ...prev, expectedTime: parseInt(e.target.value) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...appointment, details: formData });
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        <h2>{appointment.id ? 'Edit Appointment' : 'New Appointment'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Vehicle Reg:
            <input type="text" name="vehicleReg" value={formData.vehicleReg} onChange={handleChange} required />
          </label>
          <label>
            Vehicle Make:
            <input type="text" name="vehicleMake" value={formData.vehicleMake} onChange={handleChange} required />
          </label>
          <label>
            Customer Name:
            <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} required />
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
          <label>
            Comment:
            <textarea name="comment" value={formData.comment} onChange={handleChange}></textarea>
          </label>
          <button type="submit">Save Appointment</button>
        </form>
      </div>
    </div>
  );
}

export default AppointmentModal;
