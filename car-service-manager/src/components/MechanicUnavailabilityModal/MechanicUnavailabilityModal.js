import React, { useEffect, useMemo, useState } from 'react';
import './MechanicUnavailabilityModal.css';

const formatDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value.toDate) return value.toDate();
  return new Date(value);
};

function MechanicUnavailabilityModal({ technicians, selectedDate, unavailabilityEntries = [], onSave, onDelete, onClose }) {
  const initialDateValue = useMemo(() => formatDateInputValue(selectedDate || new Date()), [selectedDate]);
  const [mechanic, setMechanic] = useState('');
  const [startDay, setStartDay] = useState(initialDateValue);
  const [endDay, setEndDay] = useState(initialDateValue);
  const [reason, setReason] = useState('Holiday');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (technicians.length > 0 && !mechanic) {
      setMechanic(technicians[0].id);
    }
  }, [technicians, mechanic]);

  useEffect(() => {
    setStartDay(initialDateValue);
    setEndDay(initialDateValue);
    setEditingId(null);
  }, [initialDateValue]);

  const mechanicNameById = useMemo(() => {
    return technicians.reduce((acc, tech) => {
      acc[tech.id] = tech.name;
      return acc;
    }, {});
  }, [technicians]);

  const sortedEntries = useMemo(() => {
    return [...unavailabilityEntries].sort((a, b) => {
      const aStart = toDate(a.startDay)?.getTime() || 0;
      const bStart = toDate(b.startDay)?.getTime() || 0;
      return aStart - bStart;
    });
  }, [unavailabilityEntries]);

  const resetForm = () => {
    setEditingId(null);
    setReason('Holiday');
    setStartDay(initialDateValue);
    setEndDay(initialDateValue);
    if (technicians.length > 0) {
      setMechanic(technicians[0].id);
    }
  };

  const handleEditEntry = (entry) => {
    const start = toDate(entry.startDay);
    const end = toDate(entry.endDay);
    setEditingId(entry.id);
    setMechanic(entry.mechanic || technicians[0]?.id || '');
    setStartDay(start ? formatDateInputValue(start) : initialDateValue);
    setEndDay(end ? formatDateInputValue(end) : initialDateValue);
    setReason(entry.reason || 'Holiday');
  };

  const handleDeleteEntry = async (entryId) => {
    const confirmed = window.confirm('Delete this unavailability entry?');
    if (!confirmed) return;
    await onDelete(entryId);
    if (editingId === entryId) {
      resetForm();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const start = new Date(`${startDay}T00:00:00`);
    const end = new Date(`${endDay}T00:00:00`);

    if (end < start) {
      alert('End day cannot be before start day.');
      return;
    }

    await onSave({
      id: editingId,
      mechanic,
      startDay: start,
      endDay: end,
      reason,
    });
  };

  return (
    <div className="unavailability-modal-overlay" onClick={onClose}>
      <div className="unavailability-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{editingId ? 'Edit Mechanic Unavailability' : 'Mark Mechanic Unavailable'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Mechanic
            <select value={mechanic} onChange={(e) => setMechanic(e.target.value)} required>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Start Day
            <input type="date" value={startDay} onChange={(e) => setStartDay(e.target.value)} required />
          </label>

          <label>
            End Day
            <input type="date" value={endDay} onChange={(e) => setEndDay(e.target.value)} required />
          </label>

          <label>
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="Holiday">Holiday</option>
              <option value="Sick Day">Sick Day</option>
            </select>
          </label>

          <div className="unavailability-modal-actions">
            {editingId && (
              <button type="button" onClick={resetForm}>New Entry</button>
            )}
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit">{editingId ? 'Update' : 'Save'}</button>
          </div>
        </form>

        <div className="unavailability-list">
          <h3>Existing For Selected Day</h3>
          {sortedEntries.length === 0 && (
            <p className="unavailability-empty">No unavailability records for this day.</p>
          )}
          {sortedEntries.map((entry) => {
            const start = toDate(entry.startDay);
            const end = toDate(entry.endDay);
            return (
              <div key={entry.id} className="unavailability-item">
                <div>
                  <strong>{mechanicNameById[entry.mechanic] || entry.mechanic}</strong>
                  <div>{entry.reason || 'Unavailable'}</div>
                  <div>
                    {start ? formatDateInputValue(start) : 'Unknown'} to {end ? formatDateInputValue(end) : 'Unknown'}
                  </div>
                </div>
                <div className="unavailability-item-actions">
                  <button type="button" onClick={() => handleEditEntry(entry)}>Edit</button>
                  <button type="button" onClick={() => handleDeleteEntry(entry.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MechanicUnavailabilityModal;
