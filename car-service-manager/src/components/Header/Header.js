import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import './Header.css';

function Header() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="header">
      <div className="logo-container">
        <img src="/assets/ASG_Logo_white.jpg" alt="Logo" className="logo" />
      </div>
      <nav className="nav-links">
        <Link to="/appointments" className="nav-link">Appointments</Link>
        <Link to="/accounts" className="nav-link">Accounts</Link>
        <FontAwesomeIcon
          icon={faSignOutAlt}
          className="logout-icon"
          onClick={handleLogout}
        />
      </nav>
    </header>
  );
}

export default Header;