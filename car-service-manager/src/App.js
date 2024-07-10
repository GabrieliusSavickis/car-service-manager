// src/App.js
import './App.css';
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AppointmentsPage from './pages/AppointmentsPage'; // Correct import
import AccountsPage from './pages/AccountsPage'; // Import AccountsPage

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/accounts" element={<AccountsPage />} /> 
        <Route path="/" element={<LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;
