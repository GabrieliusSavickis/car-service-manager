// src/components/PrintableJobCard.js
import React from 'react';
import './PrintableJobCard.css'; // Use a different CSS file for print styles

const PrintableJobCard = ({ appointment }) => {
  return (
    <div className="printable-job-card">
      <h2>Job Card for {appointment.details.vehicleReg}</h2>
      <p><strong>Vehicle Make:</strong> {appointment.details.vehicleMake}</p>
      <p><strong>Customer Name:</strong> {appointment.details.customerName}</p>
      <p><strong>Customer Phone:</strong> {appointment.details.customerPhone}</p>
      <p><strong>Technician:</strong> {appointment.tech}</p>
      <p><strong>Date:</strong> {appointment.date}</p>
      <p><strong>Tasks:</strong></p>
      <ul>
        {appointment.details.tasks.map((task, index) => (
          <li key={index}>{task.text}</li>
        ))}
      </ul>
    </div>
  );
};

export default PrintableJobCard;
