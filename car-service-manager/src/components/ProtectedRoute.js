// src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../firebase'; // Import your Firebase auth

const ProtectedRoute = ({ component: Component }) => {
  // If the user is authenticated, render the passed component
  if (auth.currentUser) {
    return <Component />;
  } else {
    // If not authenticated, redirect to login
    return <Navigate to="/login" />;
  }
};

export default ProtectedRoute;
