import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { firestore } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Header from '../components/Header/Header';
import './AccountsPage.css';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaTimesCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { getTechnicianName } from '../utils/technicianUtils';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import { Collapse } from 'react-collapse';

// Memoized Table Row Component
const AccountTableRow = memo(({ account, onViewHistory }) => (
  <TableRow className="accounts-table-row">
    <TableCell>{account.vehicleReg}</TableCell>
    <TableCell>{account.customerName}</TableCell>
    <TableCell>{account.customerPhone}</TableCell>
    <TableCell>{account.vehicleMake}</TableCell>
    <TableCell align="center">
      <Button
        variant="contained"
        size="small"
        onClick={() => onViewHistory(account.vehicleReg)}
        className="accounts-primary-btn"
      >
        History
      </Button>
    </TableCell>
  </TableRow>
));

// Memoized Appointment Entry Component
const AppointmentEntry = memo(({ appointment, onToggle }) => (
  <Box className="accounts-appointment-entry">
    <Box
      className="accounts-appointment-summary"
      onClick={() => onToggle(appointment.id)}
    >
      <Box className="accounts-summary-row">
        <Typography variant="body2" className="accounts-summary-text">
          <strong>Date:</strong> {appointment.formattedDateTime}
        </Typography>
        <span className="accounts-toggle-icon">
          {appointment.isOpen ? <FaChevronUp /> : <FaChevronDown />}
        </span>
      </Box>
    </Box>
    <Collapse isOpened={appointment.isOpen}>
      <Box className="accounts-appointment-details">
        <Divider sx={{ my: 1 }} />
        <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
          <strong>Technician:</strong> {appointment.technicianName || appointment.tech || 'Unknown'}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>Tasks:</strong>
        </Typography>
        <Box component="ul" className="accounts-tasks-list">
          {appointment.details.tasks && appointment.details.tasks.length > 0 ? (
            appointment.details.tasks.map((task, index) => (
              <Box component="li" key={index} className="accounts-task-item">
                {task.completed ? (
                  <FaCheckCircle color="green" />
                ) : (
                  <FaTimesCircle color="red" />
                )}
                {' '}
                {task.text}
              </Box>
            ))
          ) : (
            <Box component="li">No tasks available</Box>
          )}
        </Box>
        <Typography variant="body2" sx={{ mt: 2 }}>
          <strong>Comments:</strong> {appointment.details.comments || 'No comments available'}
        </Typography>
      </Box>
    </Collapse>
  </Box>
));

const AccountsPage = () => {
  // Determine the domain
  const hostname = window.location.hostname;
  let locationSuffix = '';

  if (hostname.includes('asgennislive.ie')) {
    locationSuffix = '_ennis'; // Ennis site
  } else if (hostname.includes('asglive.ie')) {
    locationSuffix = ''; // Main site
  }

  // Define the collection names
  const accountsCollectionName = 'accounts' + locationSuffix;



  const [accounts, setAccounts] = useState([]);
  const [searchReg, setSearchReg] = useState('');
  const [searchType, setSearchType] = useState('vehicleReg'); // 'vehicleReg' or 'phone'
  const [selectedAccount, setSelectedAccount] = useState(null); // Track selected account
  const [serviceHistory, setServiceHistory] = useState([]);
  const navigate = useNavigate();

  // Memoize filtered accounts to prevent recalculation on every render
  const filteredAccounts = useMemo(() => {
    if (searchReg === '') {
      return [];
    }

    if (searchType === 'vehicleReg') {
      return accounts.filter(account =>
        account.vehicleReg.toUpperCase().includes(searchReg.toUpperCase())
      );
    } else if (searchType === 'phone') {
      return accounts.filter(account =>
        account.customerPhone.includes(searchReg)
      );
    }
    return [];
  }, [searchReg, searchType, accounts]);

  // Memoize the display list (either all accounts or filtered)
  const displayAccounts = useMemo(() => {
    return searchReg === '' ? accounts : filteredAccounts;
  }, [searchReg, accounts, filteredAccounts]);

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
      const accountsCollection = collection(firestore, accountsCollectionName);
      const accountsSnapshot = await getDocs(accountsCollection);
      const accountsList = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(accountsList);
    };

    fetchAccounts();
  }, [accountsCollectionName]); // Add accountsCollectionName as a dependency

  // Use useCallback to memoize handlers
  const handleSearchChange = useCallback((e) => {
    setSearchReg(e.target.value);
  }, []);

  const handleSearchTypeChange = useCallback((e) => {
    setSearchType(e.target.value);
    setSearchReg('');
  }, []);

  const handleViewServiceHistory = useCallback(async (vehicleReg) => {
    const appointmentsRef = collection(firestore, `appointments${locationSuffix}`);
    const q = query(appointmentsRef, where('details.vehicleReg', '==', vehicleReg));
    const querySnapshot = await getDocs(q);
    const appointmentsList = await Promise.all(querySnapshot.docs.map(async (doc) => {
      const appointment = doc.data();
      // Combine date and startTime
      const date = appointment.date; // Assuming this is a string like "Wed Sep 25 2024"
      const time = appointment.startTime || appointment.details.startTime; // Get startTime from appointment
      // Create a Date object from the date and time
      const dateTimeString = `${date} ${time}`;
      const dateTime = new Date(dateTimeString);
      // Format the date and time
      const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false, // Use 24-hour format
      };
      const formattedDateTime = dateTime.toLocaleString('en-US', options);

      // Lookup technician name if using ID
      let technicianName = appointment.tech;
      if (appointment.techId) {
        technicianName = await getTechnicianName(appointment.techId, locationSuffix);
      }

      return {
        id: doc.id,
        ...appointment,
        technicianName, // Add the resolved technician name
        formattedDateTime,
        isOpen: false, // Add isOpen property
      };
    }));

    setSelectedAccount(vehicleReg);
    setServiceHistory(appointmentsList);
  }, [locationSuffix]);

  // Memoize appointment toggle handler
  const handleToggleAppointment = useCallback((appointmentId) => {
    setServiceHistory(prev =>
      prev.map(app =>
        app.id === appointmentId
          ? { ...app, isOpen: !app.isOpen }
          : app
      )
    );
  }, []);

  return (
    <div className="accounts-page-shell">
      <Header />
      <Container maxWidth="lg" className="accounts-page">
        {/* Search Card */}
        <Card className="accounts-surface-card accounts-search-card">
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <Typography className="accounts-filter-label">Search By</Typography>
                <TextField
                  select
                  fullWidth
                  value={searchType}
                  onChange={handleSearchTypeChange}
                  variant="outlined"
                  size="small"
                  className="accounts-search-select"
                >
                  <MenuItem value="vehicleReg">Vehicle Reg</MenuItem>
                  <MenuItem value="phone">Phone Number</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={9}>
                <Typography className="accounts-filter-label">Query</Typography>
                <TextField
                  fullWidth
                  type="text"
                  placeholder={searchType === 'vehicleReg' ? 'Search by Vehicle Reg' : 'Search by Phone Number'}
                  value={searchReg}
                  onChange={handleSearchChange}
                  variant="outlined"
                  size="small"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Results Table Card */}
        <Card className="accounts-surface-card accounts-table-card">
          <CardContent>
            <Box className="accounts-table-header">
              <Typography variant="h6" className="accounts-section-title">
                Accounts List
              </Typography>
              <Typography variant="body2" className="accounts-results-count">
                {displayAccounts.length} accounts
              </Typography>
            </Box>
            <TableContainer className="accounts-table-container">
              <Table>
                <TableHead>
                  <TableRow className="accounts-table-header-row">
                    <TableCell>Vehicle Reg</TableCell>
                    <TableCell>Customer Name</TableCell>
                    <TableCell>Customer Phone</TableCell>
                    <TableCell>Vehicle Make</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayAccounts.map(account => (
                    <AccountTableRow
                      key={account.id}
                      account={account}
                      onViewHistory={handleViewServiceHistory}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Service History Modal */}
        <Dialog
          open={selectedAccount !== null}
          onClose={() => setSelectedAccount(null)}
          maxWidth="sm"
          fullWidth
          className="accounts-modal"
        >
          <DialogTitle className="accounts-modal-title">
            Service History for {selectedAccount}
          </DialogTitle>
          <DialogContent dividers className="accounts-modal-content">
            {serviceHistory.length > 0 ? (
              serviceHistory.map(appointment => (
                <AppointmentEntry
                  key={appointment.id}
                  appointment={appointment}
                  onToggle={handleToggleAppointment}
                />
              ))
            ) : (
              <Typography>No service history available for this vehicle.</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedAccount(null)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  );
};

export default AccountsPage;
