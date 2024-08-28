import React, { useState, useEffect } from 'react';
import { firestore } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Header from '../components/Header/Header';
import './AccountsPage.css';
import { useNavigate } from 'react-router-dom';

const AccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [searchReg, setSearchReg] = useState('');
  const [filteredAccounts, setFilteredAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null); // Track selected account
  const [serviceHistory, setServiceHistory] = useState([]);
  const navigate = useNavigate();

  // Fetch the user role from sessionStorage
  useEffect(() => {
    const role = sessionStorage.getItem('userRole');

    // If the role is not available or the user is a technician, redirect to appointments
    if (!role || role === 'technician') {
      navigate('/appointments');
    }
  }, [navigate]);

  useEffect(() => {
    const fetchAccounts = async () => {
      const accountsCollection = collection(firestore, 'accounts');
      const accountsSnapshot = await getDocs(accountsCollection);
      const accountsList = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(accountsList);
    };

    fetchAccounts();
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value.toUpperCase();
    setSearchReg(value);

    if (value === '') {
      setFilteredAccounts([]);
    } else {
      const filtered = accounts.filter(account =>
        account.vehicleReg.includes(value)
      );
      setFilteredAccounts(filtered);
    }
  };

  const handleViewServiceHistory = async (vehicleReg) => {
    const appointmentsRef = collection(firestore, 'appointments');
    const q = query(appointmentsRef, where('details.vehicleReg', '==', vehicleReg));
    const querySnapshot = await getDocs(q);
    const appointmentsList = querySnapshot.docs.map(doc => {
      const appointment = doc.data();
      return {
        id: doc.id,
        ...appointment,
        formattedDate: appointment.date // Use the date field directly
      };
    });

    setSelectedAccount(vehicleReg);
    setServiceHistory(appointmentsList);
  };


  return (
    <div className="accounts-page">
      <Header />
      <h1>Accounts</h1>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search by Vehicle Reg"
          value={searchReg}
          onChange={handleSearchChange}
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>Vehicle Reg</th>
            <th>Customer Name</th>
            <th>Customer Phone</th>
            <th>Vehicle Make</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {searchReg === '' ? accounts.map(account => (
            <tr key={account.vehicleReg}>
              <td>{account.vehicleReg}</td>
              <td>{account.customerName}</td>
              <td>{account.customerPhone}</td>
              <td>{account.vehicleMake}</td>
              <td>
                <button onClick={() => handleViewServiceHistory(account.vehicleReg)}>
                  History
                </button>
              </td>
            </tr>
          )) : filteredAccounts.map(account => (
            <tr key={account.vehicleReg}>
              <td>{account.vehicleReg}</td>
              <td>{account.customerName}</td>
              <td>{account.customerPhone}</td>
              <td>{account.vehicleMake}</td>
              <td>
                <button onClick={() => handleViewServiceHistory(account.vehicleReg)}>
                  History
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedAccount && (
        <>
          <div className="modal-overlay" onClick={() => setSelectedAccount(null)}></div>
          <div className="service-history-modal">
            <h2>Service History for {selectedAccount}</h2>
            <div className="service-history-list">
              <ul>
                {serviceHistory.length > 0 ? (
                  serviceHistory.map(appointment => (
                    <li key={appointment.id}>
                      <strong>Date:</strong> {appointment.formattedDate} <br />
                      <strong>Description: </strong>
                      <span className="description-preview">
                        {appointment.details.tasks && appointment.details.tasks.length > 0
                          ? appointment.details.tasks.map(task => task.text).join(', ')
                          : 'No tasks available'}
                      </span>
                      <br />
                      <strong>Technician:</strong> {appointment.tech}
                    </li>
                  ))
                ) : (
                  <p>No service history available for this vehicle.</p>
                )}

              </ul>
            </div>
            <button onClick={() => setSelectedAccount(null)}>Close</button>
          </div>
        </>
      )}
    </div>
  );
};

export default AccountsPage;
