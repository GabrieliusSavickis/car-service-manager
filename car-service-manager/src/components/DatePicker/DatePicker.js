import React from 'react';

function DatePicker({ selectedDate, onDateChange }) {
  const handleChange = (e) => {
    onDateChange(new Date(e.target.value));
  };

  return (
    <div>
      <label htmlFor="appointment-date">Select Date: </label>
      <input
        type="date"
        id="appointment-date"
        value={selectedDate.toISOString().substr(0, 10)}
        onChange={handleChange}
      />
    </div>
  );
}

export default DatePicker;
