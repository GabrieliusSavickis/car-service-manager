import React from 'react';
import './PrintableJobCard.css';

function PrintableJobCard({ appointment }) {
  // Use optional chaining to safely access appointment properties
  const vehicleReg = appointment?.details?.vehicleReg || 'N/A';
  const vehicleMake = appointment?.details?.vehicleMake || 'N/A';
  const customerName = appointment?.details?.customerName || 'N/A';
  const customerPhone = appointment?.details?.customerPhone || 'N/A';
  const tasks = appointment?.details?.tasks || [];

  return (
    <div className="job-card">
      <h2>Job Card</h2>
      <p><strong>Vehicle Reg:</strong> {vehicleReg}</p>
      <p><strong>Vehicle Make:</strong> {vehicleMake}</p>
      <p><strong>Customer Name:</strong> {customerName}</p>
      <p><strong>Customer Phone:</strong> {customerPhone}</p>

      <h3>Tasks</h3>
      <ul>
        {tasks.length > 0 ? tasks.map((task, index) => (
          <li key={index}>{task.text}</li>
        )) : <li>No tasks added</li>}
      </ul>
    </div>
  );
}

export default PrintableJobCard;
