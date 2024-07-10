// src/components/Header.js
import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css'; // Create a CSS file for styling

function Header() {
  return (
    <header className="header">
      <div className="logo-container">
        <img src="/assets/ASG_Logo_white.jpg" alt="Logo" className="logo" />
      </div>
      <nav className="nav-links">
        <Link to="/appointments" className="nav-link">Appointments</Link>
        <Link to="/accounts" className="nav-link">Accounts</Link>
      </nav>
    </header>
  );
}

export default Header;
