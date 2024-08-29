import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import './Header.css';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { firestore } from '../../firebase';

function Header() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');

  useEffect(() => {
    const fetchUsername = async () => {
      const user = auth.currentUser;

      if (user) {
        // Check if username is stored in session storage first
        let storedUsername = sessionStorage.getItem('username');
        
        if (storedUsername) {
          setUsername(storedUsername);
        } else {
          // If not, fetch it from Firestore
          const q = query(collection(firestore, 'users'), where('email', '==', user.email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            setUsername(userData.username);
            sessionStorage.setItem('username', userData.username); // Store it in session storage for faster access
          }
        }
      }
    };

    fetchUsername();
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      sessionStorage.clear(); // Clear session storage on logout
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
        <Link to="/technician-hours" className="nav-link">Hours</Link> {/* New link to Technician Hours page */}
        {username && <span className="username-display">Logged in as <span className="username">{username}</span></span>} {/* Display username */}
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
