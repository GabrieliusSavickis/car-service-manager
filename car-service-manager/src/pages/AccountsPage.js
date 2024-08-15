import React, { useState, useEffect } from 'react';
import { firestore } from '../firebase'; 
import { collection, getDocs, query, where } from 'firebase/firestore';
import Header from '../components/Header/Header';
import './AccountsPage.css';

const AccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [searchReg, setSearchReg] = useState('');
  const [filteredAccounts, setFilteredAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null); // Track selected account
  const [serviceHistory, setServiceHistory] = useState([]);
  const [expandedDescription, setExpandedDescription] = useState({});

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
    // Fetch service history from Firestore based on vehicle reg
    const appointmentsRef = collection(firestore, 'appointments');
    const q = query(appointmentsRef, where('details.vehicleReg', '==', vehicleReg));
    const querySnapshot = await getDocs(q);
    const appointmentsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    setSelectedAccount(vehicleReg); // Set the selected account
    setServiceHistory(appointmentsList); // Set the service history
  };

  const toggleDescription = (id) => {
    setExpandedDescription((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
                      <strong>Date:</strong> {appointment.startTime} <br />
                      <strong>Description:</strong> 
                      <span className="description-preview">
                        {expandedDescription[appointment.id]
                          ? appointment.details.comment
                          : `${appointment.details.comment.slice(0, 100)}... `}
                      </span>
                      {appointment.details.comment.length > 100 && (
                        <span
                          className="read-more"
                          onClick={() => toggleDescription(appointment.id)}
                        >
                          {expandedDescription[appointment.id] ? 'Read less' : 'Read more'}
                        </span>
                      )}
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
