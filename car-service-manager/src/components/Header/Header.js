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
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;

      if (user) {
        // Check if username and role are stored in session storage first
        let storedUsername = sessionStorage.getItem('username');
        let storedRole = sessionStorage.getItem('userRole');

        if (storedUsername && storedRole) {
          setUsername(storedUsername);
          setUserRole(storedRole);
        } else {
          // If not, fetch them from Firestore
          const q = query(collection(firestore, 'users'), where('email', '==', user.email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            setUsername(userData.username);
            setUserRole(userData.role); // Assuming role is stored in the user data
            sessionStorage.setItem('username', userData.username); // Store it in session storage for faster access
            sessionStorage.setItem('userRole', userData.role); // Store role in session storage
          }
        }
      }
    };

    fetchUserData();
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

  // Don't render the header for technicians
  if (userRole === 'technician') {
    return null;
  }

  return (
    <header className="header">
      <div className="logo-container">
        <img src="/assets/ASG_Logo_white.jpg" alt="Logo" className="logo" />
      </div>
      <nav className="nav-links">
        <Link to="/appointments" className="nav-link">Appointments</Link>
        <Link to="/accounts" className="nav-link">Accounts</Link>
        <Link to="/technician-hours" className="nav-link">Hours</Link>
        {username && <span className="username-display">Logged in as <span className="username">{username}</span></span>}
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
