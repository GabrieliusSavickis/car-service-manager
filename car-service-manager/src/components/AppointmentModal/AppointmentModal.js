import React, { useState, useEffect } from 'react';
import './AppointmentModal.css';

function AppointmentModal({ appointment, onSave, onClose }) {
  const [formData, setFormData] = useState({
    vehicleReg: '',
    vehicleMake: '',
    customerName: '',
    customerPhone: '',
    comment: '',
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