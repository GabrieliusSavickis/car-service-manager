// src/pages/LoginPage.js
import React, { useState } from 'react';
import { auth, signInWithEmailAndPasswordFunction } from '../firebase';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPasswordFunction(auth, email, password);
      setError('');
      navigate('/appointments');
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <img src="/assets/ASG_Logo_white.jpg" alt="Logo" className="logo" />
        <h2>Log In</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="login-button">Log In</button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
