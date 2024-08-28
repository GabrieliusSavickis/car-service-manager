import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker'; // Import DatePicker from react-datepicker
import 'react-datepicker/dist/react-datepicker.css'; // Import the css for react-datepicker
import { firestore } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import './TechnicianHoursPage.css';
import Header from '../components/Header/Header';

const TechnicianHoursPage = () => {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [technicianHours, setTechnicianHours] = useState([]);

  useEffect(() => {
    const fetchTechnicianHours = async () => {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999); // Ensure the end time includes the whole day

      const q = query(
        collection(firestore, 'appointments'),
        where('date', '>=', startOfDay.toDateString()),
        where('date', '<=', endOfDay.toDateString())
      );

      const querySnapshot = await getDocs(q);
      const hoursData = {};

      querySnapshot.forEach((doc) => {
        const appointment = doc.data();
        const { tech, details } = appointment;

        if (!hoursData[tech]) {
          hoursData[tech] = 0;
        }

        const totalTimeSpent = details.totalTimeSpent || 0;
        hoursData[tech] += totalTimeSpent;
      });

      const formattedHours = Object.keys(hoursData).map((tech) => ({
        tech,
        hours: Math.floor(hoursData[tech] / 3600000),
        minutes: Math.floor((hoursData[tech] % 3600000) / 60000),
      }));

      setTechnicianHours(formattedHours);
    };

    fetchTechnicianHours();
  }, [startDate, endDate]);

  return (
    <div>
      <Header />
      <div className="technician-hours-container">
        <h1>Technician Hours</h1>
        <div className="date-picker-container">
          <DatePicker
            selected={startDate}
            onChange={(dates) => {
              if (Array.isArray(dates)) {
                const [start, end] = dates;
                setStartDate(start);
                setEndDate(end || start); // If the end date is not selected, use the start date
              }
            }}
            startDate={startDate}
            endDate={endDate}
            selectsRange
            inline
          />
        </div>
        <table>
          <thead>
            <tr>
              <th>Technician</th>
              <th>Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {technicianHours.map((tech, index) => (
              <tr key={index}>
                <td>{tech.tech}</td>
                <td>
                  {tech.hours} hours {tech.minutes} minutes
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TechnicianHoursPage;
