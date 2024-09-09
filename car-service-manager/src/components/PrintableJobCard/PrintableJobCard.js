import React, { forwardRef } from 'react';
import './PrintableJobCard.css';

const PrintableJobCard = forwardRef(({ appointment }, ref) => {
  const details = appointment?.details || {};
  const tasks = details.tasks || [];
  const comments = details.comments || ''; // Retrieve the comments

  return (
    <div ref={ref} className="job-card">
      <h1>Job Card</h1>
      <p><strong>Vehicle Reg:</strong> {details.vehicleReg || 'N/A'}</p>
      <p><strong>Vehicle Make:</strong> {details.vehicleMake || 'N/A'}</p>
      <p><strong>Customer Name:</strong> {details.customerName || 'N/A'}</p>
      <p><strong>Customer Phone:</strong> {details.customerPhone || 'N/A'}</p>
      <p><strong>Appointment Date:</strong> {appointment?.date || 'N/A'}</p>

      <h3>Tasks</h3>
      <ul>
        {tasks.length > 0 ? tasks.map((task, index) => (
          <li key={index}>{task.text}</li>
        )) : <li>No tasks added</li>}
      </ul>

      {/* Add the comments section */}
      {comments && (
        <div className="comments-section">
          <h3>Comments</h3>
          <p>{comments}</p>
        </div>
      )}
    </div>
  );
});

export default PrintableJobCard;
