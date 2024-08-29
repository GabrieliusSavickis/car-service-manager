// src/App.js
import './App.css';
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AppointmentsPage from './pages/AppointmentsPage';
import AccountsPage from './pages/AccountsPage';
import TechnicianHoursPage from './pages/TechnicianHoursPage';
import ProtectedRoute from './components/ProtectedRoute';
import { auth } from './firebase';

function App() {
  const [loading, setLoading] = useState(true);
  const [, _setUser] = useState(null); // Renamed to _setUser to avoid linting issues

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        _setUser(user); // Still using _setUser to manage authentication state
      } else {
        _setUser(null);
      }
      setLoading(false); // Update loading state after auth check
    });

    return () => unsubscribe(); // Cleanup the listener on unmount
  }, []);

  if (loading) {
    return <div>Loading...</div>; // or a loading spinner
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route path="/appointments" element={<ProtectedRoute component={AppointmentsPage} />} />
        <Route path="/accounts" element={<ProtectedRoute component={AccountsPage} />} />
        <Route path="/technician-hours" element={<ProtectedRoute component={TechnicianHoursPage} />} />
      </Routes>
    </Router>
  );
}

export default App;
