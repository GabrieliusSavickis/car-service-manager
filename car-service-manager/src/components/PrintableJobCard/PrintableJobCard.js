import React, { forwardRef, useState, useEffect } from 'react';
import './PrintableJobCard.css';
import { getTechnicianName } from '../../utils/technicianUtils';

const PrintableJobCard = forwardRef(({ appointment }, ref) => {
  const details = appointment?.details || {};
  const tasks = details.tasks || [];
  const comments = details.comments || ''; // Retrieve the comments

   // Split comments by new line characters
   const formattedComments = comments.split('\n');

  const [technicianName, setTechnicianName] = useState(appointment?.tech || 'Unknown');

  useEffect(() => {
    const loadTechnicianName = async () => {
      // Determine the domain
      const hostname = window.location.hostname;
      let locationSuffix = '';

      if (hostname.includes('asgennislive.ie')) {
        locationSuffix = '_ennis'; // Ennis site
      } else if (hostname.includes('asglive.ie')) {
        locationSuffix = ''; // Main site
      }

      if (appointment?.techId) {
        const name = await getTechnicianName(appointment.techId, locationSuffix);
        setTechnicianName(name);
      }
    };

    loadTechnicianName();
  }, [appointment?.techId, appointment?.tech]);

  return (
    <div ref={ref} className="job-card">
      <h1>Job Card</h1>
      <p><strong>Vehicle Reg:</strong> {details.vehicleReg || 'N/A'}</p>
      <p><strong>Vehicle Make:</strong> {details.vehicleMake || 'N/A'}</p>
      <p><strong>Mileage:</strong> {details.mileage || 'N/A'}</p>
      <p><strong>Customer Name:</strong> {details.customerName || 'N/A'}</p>
      <p><strong>Customer Phone:</strong> {details.customerPhone || 'N/A'}</p>
      <p><strong>Appointment Date:</strong> {appointment?.date || 'N/A'}</p>
      <p><strong>Mechanic:</strong> {technicianName}</p>
      

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
          <ul>
            {formattedComments.map((comment, index) => (
              <li key={index}>{comment}</li>
            ))}
            </ul>
        </div>
      )}
    </div>
  );
});

export default PrintableJobCard;
