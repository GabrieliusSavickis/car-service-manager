// src/App.js
import './App.css';
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AppointmentsPage from './pages/AppointmentsPage'; // Correct import
import AccountsPage from './pages/AccountsPage'; // Import AccountsPage
import TechnicianHoursPage from './pages/TechnicianHoursPage'; // Import TechnicianHoursPage

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/accounts" element={<AccountsPage />} /> 
        <Route path="/" element={<LoginPage />} />
        <Route path="/technician-hours" element={<TechnicianHoursPage />} />
      </Routes>
    </Router>
  );
}

export default App;
