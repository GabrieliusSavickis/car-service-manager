import React, { useState } from 'react';
import { auth, signInWithEmailAndPasswordFunction } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { firestore } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import './LoginPage.css';

function LoginPage() {
  const [loginInput, setLoginInput] = useState(''); // This will hold either username or email
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);


  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      let email = loginInput;

      // Check if the input is a username and fetch the associated email
      if (!loginInput.includes('@')) {
        const q = query(collection(firestore, 'users'), where('username', '==', loginInput));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Get the email associated with the username
          const userData = querySnapshot.docs[0].data();
          email = userData.email;
        } else {
          throw new Error('Username not found.');
        }
      }

      // Use the email for login
      await signInWithEmailAndPasswordFunction(auth, email, password);

      // Fetch the role after login
      const role = await fetchUserRole(email);

      // You can store the role in session storage or context/state management for future use
      sessionStorage.setItem('userRole', role); // Store the user's role

      setError('');
      navigate('/appointments');
    } catch (error) {
      setError(error.message);
    }
  };

  const fetchUserRole = async (email) => {
    const q = query(collection(firestore, 'users'), where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      return userData.role; // Return the role of the user (e.g., 'admin', 'technician')
    }

    throw new Error('User role not found.');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <img src="/assets/ASG_Logo_white.jpg" alt="Logo" className="logo" />
        <h2>Log In</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Username or Email</label>
            <input
              type="text"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              required
            />
          </div>
          <div className="form-group password-group">
            <label>Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span
                className="password-toggle-icon"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex="0"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setShowPassword((prev) => !prev);
                  }
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </span>
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="login-button">
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;