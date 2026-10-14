import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { firestore } from '../firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import MoveAppointmentsDialog from '../components/Accounts/MoveAppointmentsDialog';
import {
  deleteAccount,
  describeReg,
  getAppointmentsForAccount,
  normalizeVehicleReg,
  renameAccountReg,
} from '../utils/accountMaintenance';
import { exportAccountsWorkbook } from '../utils/accountsExport';
import { dedupeAppointmentSegments } from '../utils/serviceHistory';
import { getLocationKey } from '../utils/location';
import { getLocationSuffix } from '../utils/location';
import Header from '../components/Header/Header';
import './AccountsPage.css';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaTimesCircle, FaChevronDown, FaChevronUp, FaFlag } from 'react-icons/fa';
import { getTechnicianName } from '../utils/technicianUtils';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControlLabel,
  Grid,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import { Collapse } from 'react-collapse';

const FLAG_REASON_OPTIONS = [
  { value: 'payment_overdue', label: 'Payment overdue' },
  { value: 'payment_issues', label: 'Payment issues' },
  { value: 'problematic_client', label: 'Problematic client' },
];

const getFlagReasonLabel = (reasonValue) => {
  const match = FLAG_REASON_OPTIONS.find((option) => option.value === reasonValue);
  return match ? match.label : '';
};

// Memoized Table Row Component
const AccountTableRow = memo(({ account, onViewHistory, onEdit }) => (
  <TableRow className="accounts-table-row">
    <TableCell>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {account.flagged && (
          <Tooltip title="Flagged Account">
            <span className="accounts-flag-icon"><FaFlag /></span>
          </Tooltip>
        )}
        {account.vehicleReg}
      </Box>
    </TableCell>
    <TableCell>{account.customerName}</TableCell>
    <TableCell>{account.customerPhone}</TableCell>
    <TableCell>{account.vehicleMake}</TableCell>
    <TableCell align="center">
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => onEdit(account)}
          className="accounts-edit-btn"
        >
          Edit
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={() => onViewHistory(account)}
          className="accounts-primary-btn"
        >
          History
        </Button>
      </Box>
    </TableCell>
  </TableRow>
));

const formatMileage = (mileage) => {
  const raw = (mileage ?? '').toString().trim();
  if (!raw) return 'Not recorded';
  return /^\d+$/.test(raw) ? Number(raw).toLocaleString('en-IE') : raw;
};

// Memoized Appointment Entry Component
const AppointmentEntry = memo(({ appointment, onToggle, onMove }) => (
  <Box className="accounts-appointment-entry">
    <Box
      className="accounts-appointment-summary"
      onClick={() => onToggle(appointment.id)}
    >
      <Box className="accounts-summary-row">
        <Box className="accounts-summary-main">
          <Typography variant="body2" className="accounts-summary-text">
            <strong>Date:</strong> {appointment.formattedDateTime}
          </Typography>
          <Typography variant="body2" className="accounts-summary-mileage">
            <strong>Mileage:</strong> {formatMileage(appointment.details?.mileage)}
          </Typography>
          {appointment.segmentCount > 1 && (
            <Typography variant="body2" className="accounts-summary-mileage">
              {appointment.segmentCount} days
            </Typography>
          )}
        </Box>
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
        <Box sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => onMove(appointment)}
            className="accounts-edit-btn"
          >
            Move to another reg
          </Button>
        </Box>
      </Box>
    </Collapse>
  </Box>
));

const AccountsPage = () => {
  const locationSuffix = getLocationSuffix();

  // Define the collection names
  const accountsCollectionName = 'accounts' + locationSuffix;



  const [accounts, setAccounts] = useState([]);
  const [searchReg, setSearchReg] = useState('');
  const [searchType, setSearchType] = useState('vehicleReg'); // 'vehicleReg' or 'phone'
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null); // Track selected account
  const [serviceHistory, setServiceHistory] = useState([]);
  const [editingAccount, setEditingAccount] = useState(null); // Account being edited
  const [editFields, setEditFields] = useState({}); // Edit form values
  const [editSaving, setEditSaving] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [appointmentsToMove, setAppointmentsToMove] = useState([]);
  const [allAppointmentsForAccount, setAllAppointmentsForAccount] = useState([]);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  // Memoize filtered accounts to prevent recalculation on every render
  const filteredAccounts = useMemo(() => {
    const hasSearchQuery = searchReg.trim() !== '';
    let baseAccounts = accounts;

    if (hasSearchQuery) {
      if (searchType === 'vehicleReg') {
        baseAccounts = accounts.filter(account =>
          account.vehicleReg.toUpperCase().includes(searchReg.toUpperCase())
        );
      } else if (searchType === 'phone') {
        baseAccounts = accounts.filter(account =>
          account.customerPhone.includes(searchReg)
        );
      }
    }

    if (showFlaggedOnly) {
      return baseAccounts.filter(account => account.flagged === true);
    }

    return baseAccounts;
  }, [searchReg, searchType, accounts, showFlaggedOnly]);

  // Memoize the display list (either all accounts or filtered)
  const displayAccounts = useMemo(() => {
    return filteredAccounts;
  }, [filteredAccounts]);

  const flaggedAccountsCount = useMemo(() => {
    return accounts.filter((account) => account.flagged === true).length;
  }, [accounts]);

  // Fetch the user role from sessionStorage
  useEffect(() => {
    const role = sessionStorage.getItem('userRole');

    // If the role is not available or the user is a technician, redirect to appointments
    if (!role || role === 'technician') {
      navigate('/appointments');
    }
  }, [navigate]);

  const loadAccounts = useCallback(async () => {
    const accountsCollection = collection(firestore, accountsCollectionName);
    const accountsSnapshot = await getDocs(accountsCollection);
    const accountsList = accountsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    setAccounts(accountsList);
  }, [accountsCollectionName]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Use useCallback to memoize handlers
  const handleSearchChange = useCallback((e) => {
    setSearchReg(e.target.value);
  }, []);

  const handleSearchTypeChange = useCallback((e) => {
    setSearchType(e.target.value);
    setSearchReg('');
  }, []);

  const handleToggleFlaggedOnly = useCallback(() => {
    setShowFlaggedOnly((prev) => !prev);
  }, []);

  const handleViewServiceHistory = useCallback(async (account) => {
    const rawAppointments = await getAppointmentsForAccount(`appointments${locationSuffix}`, account);
    const appointmentsList = await Promise.all(rawAppointments.map(async (rawAppointment) => {
      const { id: appointmentId, ...appointment } = rawAppointment;
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
      const sortTime = Number.isNaN(dateTime.getTime())
        ? (new Date(date).getTime() || 0)
        : dateTime.getTime();

      // Lookup technician name if using ID
      let technicianName = appointment.tech;
      if (appointment.techId) {
        technicianName = await getTechnicianName(appointment.techId, locationSuffix);
      }

      return {
        ...appointment,
        id: appointmentId,
        technicianName, // Add the resolved technician name
        formattedDateTime,
        sortTime,
        isOpen: false, // Add isOpen property
      };
    }));

    const history = dedupeAppointmentSegments(appointmentsList)
      .sort((a, b) => b.sortTime - a.sortTime);

    setSelectedAccount(account);
    setServiceHistory(history);
    setAllAppointmentsForAccount(appointmentsList);
    setMaintenanceMessage('');
  }, [locationSuffix]);

  const handleMoveOne = useCallback((appointment) => {
    setAppointmentsToMove([appointment]);
    setMoveDialogOpen(true);
  }, []);

  const handleMoveAll = useCallback(() => {
    setAppointmentsToMove(allAppointmentsForAccount);
    setMoveDialogOpen(true);
  }, [allAppointmentsForAccount]);

  const handleMoved = useCallback(async (movedCount, targetAccount, missing = []) => {
    setMoveDialogOpen(false);
    setAppointmentsToMove([]);

    const label = movedCount === 1 ? '1 appointment' : `${movedCount} appointments`;
    // Name what was skipped, so it can be chased up rather than just counted.
    const skipped = missing.length > 0
      ? ` Skipped ${missing.length}, not found in the database: `
        + missing.map((m) => `${m.date}${m.startTime ? ` ${m.startTime}` : ''} (ref ${m.id})`).join(', ')
        + '.'
      : '';

    // Reload this account's history so what is left is accurate.
    await handleViewServiceHistory(selectedAccount);
    await loadAccounts();
    setMaintenanceMessage(`Moved ${label} to ${targetAccount.id}.${skipped}`);
  }, [handleViewServiceHistory, selectedAccount, loadAccounts]);

  const handleDeleteAccount = useCallback(async (account) => {
    // Never delete an account that still has history hanging off it.
    const remaining = await getAppointmentsForAccount(`appointments${locationSuffix}`, account);

    if (remaining.length > 0) {
      const label = remaining.length === 1 ? '1 appointment' : `${remaining.length} appointments`;
      window.alert(
        `${describeReg(account.id)} still has ${label}.

`
        + 'Open its History and move them to the correct reg first, otherwise that work '
        + 'would no longer belong to any account.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete the account ${describeReg(account.id)}?

`
      + 'It has no appointments left. This cannot be undone.'
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      await deleteAccount(accountsCollectionName, account.id);
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      setEditingAccount(null);
      setSelectedAccount(null);
      setMaintenanceMessage(`Deleted account ${describeReg(account.id)}.`);
    } catch (error) {
      console.error('Failed to delete account:', error);
      window.alert('Could not delete the account. Please try again.');
    } finally {
      setDeleting(false);
    }
  }, [accountsCollectionName, locationSuffix]);

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

  const handleEditOpen = useCallback((account) => {
    setEditingAccount(account);
    setEditFields({
      vehicleReg: account.vehicleReg || account.id || '',
      customerName: account.customerName || '',
      customerPhone: account.customerPhone || '',
      vehicleMake: account.vehicleMake || '',
      customerNotes: account.customerNotes || '',
      flagged: account.flagged || false,
      flaggedReason: account.flaggedReason || '',
    });
  }, []);

  const handleEditFieldChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setEditFields((prev) => {
      if (type === 'checkbox' && name === 'flagged') {
        return {
          ...prev,
          flagged: checked,
          flaggedReason: checked ? prev.flaggedReason : '',
        };
      }

      return { ...prev, [name]: type === 'checkbox' ? checked : value };
    });
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingAccount) return;

    const editedFields = {
      customerName: editFields.customerName,
      customerPhone: editFields.customerPhone,
      vehicleMake: editFields.vehicleMake,
      customerNotes: (editFields.customerNotes || '').trim(),
      flagged: editFields.flagged,
      flaggedReason: editFields.flagged ? editFields.flaggedReason || '' : '',
    };

    const newReg = normalizeVehicleReg(editFields.vehicleReg);
    const currentReg = editingAccount.id;
    const regChanged = Boolean(newReg) && newReg !== currentReg;

    if (!newReg) {
      window.alert('Enter a vehicle registration.');
      return;
    }

    if (regChanged) {
      const appointments = await getAppointmentsForAccount(`appointments${locationSuffix}`, editingAccount);
      const jobLabel = appointments.length === 1 ? '1 appointment' : `${appointments.length} appointments`;

      const confirmed = window.confirm(
        `Change ${describeReg(currentReg)} to ${newReg}?

`
        + `Its ${jobLabel} will move across with it, so no history is lost. `
        + 'The old registration will no longer exist.'
      );
      if (!confirmed) return;
    }

    setEditSaving(true);
    try {
      if (regChanged) {
        // The reg is the document id, so this recreates the account and brings
        // its appointments along.
        const { movedCount, missing } = await renameAccountReg({
          accountsCollectionName,
          appointmentsCollectionName: `appointments${locationSuffix}`,
          account: { ...editingAccount, ...editedFields },
          newReg,
        });

        await loadAccounts();
        setSelectedAccount(null);
        setServiceHistory([]);
        setMaintenanceMessage(
          `Changed ${describeReg(currentReg)} to ${newReg}`
          + (movedCount > 0 ? ` and moved ${movedCount === 1 ? '1 appointment' : `${movedCount} appointments`}.` : '.')
          + (missing.length > 0
            ? ` Skipped ${missing.length}, not found: ${missing.map((m) => `${m.date} (ref ${m.id})`).join(', ')}.`
            : '')
        );
      } else {
        await updateDoc(doc(firestore, accountsCollectionName, editingAccount.id), editedFields);
        setAccounts(prev =>
          prev.map(a => (a.id === editingAccount.id ? { ...a, ...editedFields } : a))
        );
      }

      setEditingAccount(null);
    } catch (err) {
      console.error('Error updating account:', err);
      window.alert(err.message || 'Could not save the account. Please try again.');
    } finally {
      setEditSaving(false);
    }
  }, [editingAccount, editFields, accountsCollectionName, locationSuffix, loadAccounts]);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      setMaintenanceMessage('');

      const result = await exportAccountsWorkbook({
        accounts,
        appointmentsCollectionName: `appointments${locationSuffix}`,
        locationSuffix,
        locationKey: getLocationKey(),
      });

      window.alert(
        `Exported ${result.accountCount} accounts and ${result.historyCount} jobs to ${result.fileName}.

`
        + `${result.dueSoonCount} due a service within ${result.dueSoonDays} days `
        + `(estimated as last service + ${result.intervalMonths} months).`
      );
    } catch (error) {
      console.error('Failed to export accounts:', error);
      window.alert(`Could not build the export.

${error?.message || error}`);
    } finally {
      setExporting(false);
    }
  }, [accounts, locationSuffix]);

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
              <Box className="accounts-results-controls">
                <Typography variant="body2" className="accounts-results-count">
                  {displayAccounts.length} accounts
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleExport}
                  className="accounts-edit-btn"
                  disabled={exporting || accounts.length === 0}
                >
                  {exporting ? 'Exporting...' : 'Export'}
                </Button>
                <Tooltip title={showFlaggedOnly ? 'Showing flagged accounts' : 'View all flagged accounts'}>
                  <Button
                    variant="text"
                    size="small"
                    onClick={handleToggleFlaggedOnly}
                    className={`accounts-flag-filter-btn${showFlaggedOnly ? ' accounts-flag-filter-btn--active' : ''}`}
                    aria-label="View all flagged accounts"
                  >
                    <FaFlag />
                    <span className="accounts-flag-filter-count">{flaggedAccountsCount}</span>
                  </Button>
                </Tooltip>
              </Box>
            </Box>
            {maintenanceMessage && !selectedAccount && (
              <Typography variant="body2" className="accounts-move-note" sx={{ mb: 2 }}>
                {maintenanceMessage}
              </Typography>
            )}
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
                      onEdit={handleEditOpen}
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
            Service History for {selectedAccount?.id}
          </DialogTitle>
          <DialogContent dividers className="accounts-modal-content">
            {maintenanceMessage && (
              <Typography variant="body2" className="accounts-move-note" sx={{ mb: 2 }}>
                {maintenanceMessage}
              </Typography>
            )}
            {serviceHistory.length > 0 && (
              <Box className="accounts-history-actions">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleMoveAll}
                  className="accounts-edit-btn"
                >
                  Move all to another reg
                </Button>
              </Box>
            )}
            {serviceHistory.length > 0 ? (
              serviceHistory.map(appointment => (
                <AppointmentEntry
                  key={appointment.id}
                  appointment={appointment}
                  onMove={handleMoveOne}
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

        <MoveAppointmentsDialog
          open={moveDialogOpen}
          sourceAccount={selectedAccount}
          accounts={accounts}
          appointmentsToMove={appointmentsToMove}
          allAppointmentsForAccount={allAppointmentsForAccount}
          appointmentsCollectionName={`appointments${locationSuffix}`}
          onMoved={handleMoved}
          onClose={() => { setMoveDialogOpen(false); setAppointmentsToMove([]); }}
        />

        {/* Edit Account Modal */}
        <Dialog
          open={editingAccount !== null}
          onClose={() => setEditingAccount(null)}
          maxWidth="xs"
          fullWidth
          className="accounts-modal"
        >
          <DialogTitle className="accounts-modal-title">
            Edit Account
          </DialogTitle>
          <DialogContent dividers className="accounts-modal-content">
            {/* Read-only vehicle reg */}
            <Box sx={{ mb: 2 }}>
              <Typography className="accounts-filter-label" sx={{ mb: 0.5 }}>
                Vehicle Reg
              </Typography>
              <TextField
                fullWidth
                name="vehicleReg"
                value={editFields.vehicleReg || ''}
                onChange={(e) => setEditFields((prev) => ({
                  ...prev,
                  vehicleReg: e.target.value.toUpperCase(),
                }))}
                variant="outlined"
                size="small"
                helperText="Changing this moves the account and its history to the new reg"
              />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography className="accounts-filter-label" sx={{ mb: 0.5 }}>
                Vehicle Make
              </Typography>
              <TextField
                fullWidth
                name="vehicleMake"
                value={editFields.vehicleMake || ''}
                onChange={handleEditFieldChange}
                variant="outlined"
                size="small"
              />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography className="accounts-filter-label" sx={{ mb: 0.5 }}>
                Customer Name
              </Typography>
              <TextField
                fullWidth
                name="customerName"
                value={editFields.customerName || ''}
                onChange={handleEditFieldChange}
                variant="outlined"
                size="small"
              />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography className="accounts-filter-label" sx={{ mb: 0.5 }}>
                Customer Phone
              </Typography>
              <TextField
                fullWidth
                name="customerPhone"
                value={editFields.customerPhone || ''}
                onChange={handleEditFieldChange}
                variant="outlined"
                size="small"
              />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography className="accounts-filter-label" sx={{ mb: 0.5 }}>
                Customer Notes
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                name="customerNotes"
                value={editFields.customerNotes || ''}
                onChange={handleEditFieldChange}
                variant="outlined"
                size="small"
                placeholder="Extra contact or collection details, e.g. partner collects the car, company contacts..."
                helperText="Opens automatically in the appointment modal whenever this reg is booked"
              />
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box className={`accounts-flag-section${editFields.flagged ? ' accounts-flag-section--active' : ''}`}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="flagged"
                    checked={editFields.flagged || false}
                    onChange={handleEditFieldChange}
                    className="accounts-flag-checkbox"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FaFlag className={editFields.flagged ? 'accounts-flag-icon--active' : 'accounts-flag-icon--inactive'} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        Flag this account
                      </Typography>
                      <Typography variant="caption" className="accounts-flag-caption">
                        A warning will appear in the appointment modal when this vehicle reg is entered
                      </Typography>
                    </Box>
                  </Box>
                }
              />
              <Box sx={{ mt: 1, ml: 4 }}>
                <TextField
                  select
                  fullWidth
                  name="flaggedReason"
                  label="Flag reason"
                  value={editFields.flaggedReason || ''}
                  onChange={handleEditFieldChange}
                  size="small"
                  disabled={!editFields.flagged}
                  helperText={
                    editFields.flagged
                      ? 'Shown in appointment warning notices for this vehicle'
                      : 'Enable account flagging to select a reason'
                  }
                >
                  {FLAG_REASON_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              {editFields.flagged && editFields.flaggedReason && (
                <Typography variant="caption" className="accounts-flag-caption" sx={{ ml: 4, mt: 1, display: 'block' }}>
                  This account was flagged because of {getFlagReasonLabel(editFields.flaggedReason)}.
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions className="accounts-edit-actions">
            <Button
              variant="text"
              onClick={() => handleDeleteAccount(editingAccount)}
              className="accounts-delete-btn"
              disabled={deleting || editSaving}
            >
              {deleting ? 'Deleting...' : 'Delete Account'}
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => setEditingAccount(null)} variant="outlined" className="accounts-cancel-btn">
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              variant="contained"
              disabled={editSaving || (editFields.flagged && !editFields.flaggedReason)}
              className="accounts-primary-btn"
            >
              {editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  );
};

export default AccountsPage;
