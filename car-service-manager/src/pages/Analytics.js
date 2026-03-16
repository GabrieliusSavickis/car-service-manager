import React, { useEffect, useMemo, useState } from 'react';
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
} from '@mui/material';
import Header from '../components/Header/Header';
import './Analytics.css';
import { getTechnicians } from '../utils/technicianUtils';
import { firestore } from '../firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const padWeek = (value) => String(value).padStart(2, '0');

const getISOWeekNumber = (dateValue) => {
  const date = new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};

const buildWeekOptionsForCurrentYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const currentWeek = getISOWeekNumber(now);

  return Array.from({ length: currentWeek }, (_, index) => {
    const week = index + 1;
    const value = `${year}-W${padWeek(week)}`;
    return { value, label: value };
  });
};

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const numericFields = ['hours', 'partsCost', 'partsSold', 'labour', 'total', 'vat'];

const currencyFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const toNumber = (value) => Number(value) || 0;

const getTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyRecord = (selectedWeek, defaultTechnicianId = '') => ({
  id: '',
  tempId: getTempId(),
  week: selectedWeek,
  day: '',
  vehicleReg: '',
  vehicleMake: '',
  technicianId: defaultTechnicianId,
  technicianName: '',
  hours: '',
  invoiceType: 'VAT',
  customerType: 'P',
  partsCost: '',
  partsSold: '',
  labour: '',
  total: '',
  vat: '',
  totalInclVat: '0',
  isNew: true,
});

const normalizeRecordFromDb = (docData, id) => ({
  id,
  tempId: '',
  week: docData.week || '',
  day: docData.day || '',
  vehicleReg: docData.vehicleReg || '',
  vehicleMake: docData.vehicleMake || '',
  technicianId: docData.technicianId || '',
  technicianName: docData.technicianName || '',
  hours: String(docData.hours ?? ''),
  invoiceType: docData.invoiceType || 'VAT',
  customerType: docData.customerType || 'P',
  partsCost: String(docData.partsCost ?? ''),
  partsSold: String(docData.partsSold ?? ''),
  labour: String(docData.labour ?? ''),
  total: String(docData.total ?? ''),
  vat: String(docData.vat ?? ''),
  totalInclVat: String(docData.totalInclVat ?? 0),
  isNew: false,
});

const getRowKey = (row) => row.id || row.tempId;

const calculateSummary = (records) => {
  const totals = records.reduce(
    (acc, record) => {
      const partsCost = toNumber(record.partsCost);
      const partsSold = toNumber(record.partsSold);
      const labourSold = toNumber(record.labour);
      const totalInclVat = toNumber(record.totalInclVat);
      const vat = toNumber(record.vat);
      const isCash = record.invoiceType === 'CASH';

      acc.partsCost += partsCost;
      acc.partsSold += partsSold;
      acc.labourSold += labourSold;
      acc.totalInvoices += totalInclVat;
      acc.vat += vat;
      if (isCash) {
        acc.cashTotal += totalInclVat;
      }
      acc.jobs += 1;
      return acc;
    },
    {
      partsCost: 0,
      partsSold: 0,
      labourSold: 0,
      totalInvoices: 0,
      vat: 0,
      cashTotal: 0,
      jobs: 0,
    }
  );

  return {
    partsCost: totals.partsCost,
    partsSold: totals.partsSold,
    labourSold: totals.labourSold,
    partsProfit: totals.partsSold - totals.partsCost,
    labourProfit: totals.labourSold,
    totalInvoices: totals.totalInvoices,
    vat: totals.vat,
    cashTotal: totals.cashTotal,
    jobs: totals.jobs,
  };
};

const Analytics = () => {
  const locationSuffix = useMemo(() => {
    const hostname = window.location.hostname;
    if (hostname.includes('asgennislive.ie')) return '_ennis';
    if (hostname.includes('asglive.ie')) return '';
    return '';
  }, []);
  const locationKey = locationSuffix === '_ennis' ? 'ennis' : 'main';

  const recordsCollectionName = `manual_weekly_appointments${locationSuffix}`;
  const settingsDocRef = useMemo(() => doc(firestore, 'analytics_settings', locationKey), [locationKey]);
  const weekOptions = useMemo(() => buildWeekOptionsForCurrentYear(), []);

  const [selectedWeek, setSelectedWeek] = useState(() => weekOptions[weekOptions.length - 1]?.value || '');
  const [hourlyLabourRate, setHourlyLabourRate] = useState(35);
  const [hourlyLabourRateInput, setHourlyLabourRateInput] = useState('35');
  const [isSavingHourlyRate, setIsSavingHourlyRate] = useState(false);
  const [hourlyRateMessage, setHourlyRateMessage] = useState('');
  const [mechanics, setMechanics] = useState([]);
  const [selectedMechanicId, setSelectedMechanicId] = useState('all');
  const [savedRecords, setSavedRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [yearlyRecords, setYearlyRecords] = useState([]);
  const [isLoadingYearly, setIsLoadingYearly] = useState(false);
  const [summaryView, setSummaryView] = useState('weekly');
  const [rowActionMessage, setRowActionMessage] = useState('');
  const [savingRowKey, setSavingRowKey] = useState('');

  const selectedYear = useMemo(() => {
    const yearPart = selectedWeek?.split('-W')[0];
    return yearPart || String(new Date().getFullYear());
  }, [selectedWeek]);

  useEffect(() => {
    const loadMechanics = async () => {
      try {
        const fetchedTechnicians = await getTechnicians(locationSuffix);
        const mapped = fetchedTechnicians
          .filter((tech) => tech?.id && tech?.name)
          .map((tech) => ({ id: tech.id, name: tech.name }));
        setMechanics(mapped);
      } catch (error) {
        console.error('Error loading mechanics for analytics filters:', error);
        setMechanics([]);
      }
    };

    loadMechanics();
  }, [locationSuffix]);

  useEffect(() => {
    if (!selectedWeek) {
      setSavedRecords([]);
      return;
    }

    const loadSavedRecords = async () => {
      try {
        setIsLoadingRecords(true);
        const recordsRef = collection(firestore, recordsCollectionName);
        const recordsQuery = query(recordsRef, where('week', '==', selectedWeek));
        const snapshot = await getDocs(recordsQuery);

        const records = snapshot.docs.map((recordDoc) => normalizeRecordFromDb(recordDoc.data(), recordDoc.id));
        records.sort((a, b) => daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day));
        setSavedRecords(records);
      } catch (error) {
        console.error('Failed to load saved manual records:', error);
        setSavedRecords([]);
      } finally {
        setIsLoadingRecords(false);
      }
    };

    loadSavedRecords();
  }, [recordsCollectionName, selectedWeek]);

  useEffect(() => {
    if (!selectedYear) {
      setYearlyRecords([]);
      return;
    }

    const loadYearlyRecords = async () => {
      try {
        setIsLoadingYearly(true);
        const recordsRef = collection(firestore, recordsCollectionName);
        const recordsQuery = query(
          recordsRef,
          where('week', '>=', `${selectedYear}-W01`),
          where('week', '<=', `${selectedYear}-W53`)
        );
        const snapshot = await getDocs(recordsQuery);

        const records = snapshot.docs.map((recordDoc) => normalizeRecordFromDb(recordDoc.data(), recordDoc.id));
        setYearlyRecords(records);
      } catch (error) {
        console.error('Failed to load yearly records:', error);
        setYearlyRecords([]);
      } finally {
        setIsLoadingYearly(false);
      }
    };

    loadYearlyRecords();
  }, [recordsCollectionName, selectedYear]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      settingsDocRef,
      (snapshot) => {
        const data = snapshot.data();
        const numeric = Number(data?.hourlyLabourRate);
        const rate = Number.isFinite(numeric) && numeric >= 0 ? numeric : 35;
        setHourlyLabourRate(rate);
        setHourlyLabourRateInput(String(rate));
      },
      (error) => {
        console.error('Failed to load hourly labour rate settings:', error);
      }
    );

    return () => unsubscribe();
  }, [settingsDocRef]);

  const handleHourlyLabourRateChange = (value) => {
    if (value === '') {
      setHourlyLabourRateInput('');
      return;
    }

    if (/^\d*\.?\d*$/.test(value)) {
      setHourlyLabourRateInput(value);
    }
  };

  const handleSaveHourlyLabourRate = async () => {
    const numeric = Number(hourlyLabourRateInput);
    if (!Number.isFinite(numeric) || numeric < 0) {
      setHourlyRateMessage('Enter a valid hourly labour rate.');
      return;
    }

    try {
      setIsSavingHourlyRate(true);
      setHourlyRateMessage('');
      await setDoc(settingsDocRef, {
        hourlyLabourRate: numeric,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setHourlyLabourRate(numeric);
      setHourlyRateMessage('Hourly rate saved for this location.');
    } catch (error) {
      console.error('Failed to save hourly labour rate:', error);
      setHourlyRateMessage('Failed to save hourly rate. Please try again.');
    } finally {
      setIsSavingHourlyRate(false);
    }
  };

  const handleAddRecordRow = () => {
    setRowActionMessage('');
    const defaultTech = selectedMechanicId !== 'all' ? selectedMechanicId : mechanics[0]?.id || '';
    const newRow = createEmptyRecord(selectedWeek, defaultTech);
    setSavedRecords((prev) => [...prev, newRow]);
  };

  const handleRowChange = (rowKey, field, value) => {
    setSavedRecords((prev) => prev.map((row) => {
      if (getRowKey(row) !== rowKey) return row;

      if (numericFields.includes(field)) {
        if (!(value === '' || /^\d*\.?\d*$/.test(value))) return row;
      }

      const nextRow = { ...row, [field]: value };

      if (field === 'technicianId') {
        const tech = mechanics.find((m) => m.id === value);
        nextRow.technicianName = tech?.name || '';
      }

      // Auto-populate labour when hours changes
      if (field === 'hours') {
        const hours = toNumber(value);
        const labour = hours * hourlyLabourRate;
        nextRow.labour = labour > 0 ? String(labour) : '';
      }

      // Auto-populate total when labour or partsSold changes
      if (field === 'labour' || field === 'partsSold') {
        const labour = field === 'labour' ? toNumber(value) : toNumber(nextRow.labour);
        const partsSold = field === 'partsSold' ? toNumber(value) : toNumber(nextRow.partsSold);
        const total = labour + partsSold;
        nextRow.total = total > 0 ? String(total) : '';
      }

      // Auto-populate VAT as 13.5% of total (calculate based on the current total value)
      const currentTotal = (field === 'hours' || field === 'labour' || field === 'partsSold') 
        ? toNumber(nextRow.total) 
        : (field === 'total') 
        ? toNumber(value) 
        : toNumber(nextRow.total);

      if (field === 'hours' || field === 'labour' || field === 'partsSold' || field === 'total') {
        const vat = currentTotal * 0.135;
        nextRow.vat = vat > 0 ? String(vat.toFixed(2)) : '';
      }

      // Update totalInclVat based on total and vat
      if (field === 'total' || field === 'vat' || field === 'hours' || field === 'labour' || field === 'partsSold') {
        const totalValue = nextRow.total;
        const vatValue = nextRow.vat;
        nextRow.totalInclVat = String(toNumber(totalValue) + toNumber(vatValue));
      }

      return nextRow;
    }));
  };

  const handleSaveRow = async (row) => {
    if (!row.day || !row.technicianId) {
      setRowActionMessage('Each record needs Day and Mechanic before saving.');
      return;
    }

    const selectedTechnician = mechanics.find((mechanic) => mechanic.id === row.technicianId);

    const payload = {
      week: selectedWeek,
      day: row.day,
      vehicleReg: (row.vehicleReg || '').trim(),
      vehicleMake: (row.vehicleMake || '').trim(),
      technicianId: row.technicianId,
      technicianName: selectedTechnician?.name || row.technicianName || '',
      hours: toNumber(row.hours),
      invoiceType: row.invoiceType || 'VAT',
      customerType: row.customerType || 'P',
      partsCost: toNumber(row.partsCost),
      partsSold: toNumber(row.partsSold),
      labour: toNumber(row.labour),
      total: toNumber(row.total),
      vat: toNumber(row.vat),
      totalInclVat: toNumber(row.total) + toNumber(row.vat),
      hourlyLabourRate: toNumber(hourlyLabourRate),
      updatedAt: serverTimestamp(),
    };

    const rowKey = getRowKey(row);

    try {
      setSavingRowKey(rowKey);
      setRowActionMessage('');

      if (row.id) {
        await updateDoc(doc(firestore, recordsCollectionName, row.id), payload);
        setSavedRecords((prev) => prev.map((item) => (
          getRowKey(item) === rowKey
            ? {
                ...item,
                ...row,
                ...payload,
                totalInclVat: String(payload.totalInclVat),
                isNew: false,
              }
            : item
        )));
        setRowActionMessage('Record updated.');
      } else {
        const createdRef = await addDoc(collection(firestore, recordsCollectionName), {
          ...payload,
          createdAt: serverTimestamp(),
        });

        setSavedRecords((prev) => prev.map((item) => (
          getRowKey(item) === rowKey
            ? {
                ...item,
                id: createdRef.id,
                tempId: '',
                ...payload,
                totalInclVat: String(payload.totalInclVat),
                isNew: false,
              }
            : item
        )));
        setRowActionMessage('Record saved.');
      }
    } catch (error) {
      console.error('Failed to save row:', error);
      setRowActionMessage('Failed to save row. Please try again.');
    } finally {
      setSavingRowKey('');
    }
  };

  const handleDeleteRow = async (row) => {
    const confirmed = window.confirm('Delete this record?');
    if (!confirmed) return;

    const rowKey = getRowKey(row);

    try {
      setRowActionMessage('');

      if (row.id) {
        await deleteDoc(doc(firestore, recordsCollectionName, row.id));
      }

      setSavedRecords((prev) => prev.filter((item) => getRowKey(item) !== rowKey));
      setRowActionMessage('Record deleted.');
    } catch (error) {
      console.error('Failed to delete row:', error);
      setRowActionMessage('Failed to delete row. Please try again.');
    }
  };

  const visibleRecords = useMemo(() => {
    if (selectedMechanicId === 'all') return savedRecords;
    return savedRecords.filter((record) => record.technicianId === selectedMechanicId);
  }, [savedRecords, selectedMechanicId]);

  const visibleYearlyRecords = useMemo(() => {
    if (selectedMechanicId === 'all') return yearlyRecords;
    return yearlyRecords.filter((record) => record.technicianId === selectedMechanicId);
  }, [yearlyRecords, selectedMechanicId]);

  const weeklySummary = useMemo(() => {
    return calculateSummary(visibleRecords);
  }, [visibleRecords]);

  const yearlySummary = useMemo(() => {
    return calculateSummary(visibleYearlyRecords);
  }, [visibleYearlyRecords]);

  const activeSummary = summaryView === 'weekly' ? weeklySummary : yearlySummary;
  const isSummaryLoading = summaryView === 'yearly' ? isLoadingYearly : isLoadingRecords;

  return (
    <div className="analytics-page-shell">
      <Header />
      <Container maxWidth={false} sx={{ px: { xs: 2, md: 3, lg: 4 } }}>
        <Box className="analytics-page" sx={{ my: 2 }}>
          <Grid container spacing={3} className="analytics-filters-row">
            <Grid item xs={12} md={4}>
              <Card className="analytics-filter-card analytics-surface-card">
                <CardContent>
                  <Typography variant="subtitle2" className="analytics-filter-label">
                    Week
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={selectedWeek}
                    onChange={(event) => setSelectedWeek(event.target.value)}
                  >
                    {weekOptions.map((week) => (
                      <MenuItem key={week.value} value={week.value}>{week.label}</MenuItem>
                    ))}
                  </TextField>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card className="analytics-filter-card analytics-surface-card">
                <CardContent>
                  <Typography variant="subtitle2" className="analytics-filter-label">
                    Mechanic Filter
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={selectedMechanicId}
                    onChange={(event) => setSelectedMechanicId(event.target.value)}
                  >
                    <MenuItem value="all">All mechanics</MenuItem>
                    {mechanics.map((mechanic) => (
                      <MenuItem key={mechanic.id} value={mechanic.id}>{mechanic.name}</MenuItem>
                    ))}
                  </TextField>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card className="analytics-filter-card analytics-surface-card">
                <CardContent>
                  <Typography variant="subtitle2" className="analytics-filter-label">
                    Hourly Labour Rate
                  </Typography>
                  <Box className="analytics-hourly-cost-row">
                    <TextField
                      fullWidth
                      size="small"
                      type="text"
                      value={hourlyLabourRateInput}
                      onChange={(event) => handleHourlyLabourRateChange(event.target.value)}
                      inputProps={{ inputMode: 'decimal' }}
                    />
                    <Button
                      className="analytics-primary-btn"
                      variant="contained"
                      size="small"
                      disabled={isSavingHourlyRate}
                      onClick={handleSaveHourlyLabourRate}
                    >
                      {isSavingHourlyRate ? 'Saving...' : 'Save'}
                    </Button>
                  </Box>
                  {hourlyRateMessage && (
                    <Typography variant="caption" className="analytics-hourly-cost-message">
                      {hourlyRateMessage}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card className="analytics-summary-card analytics-surface-card">
            <CardContent>
              <Box className="analytics-summary-header">
                <Box>
                  <Typography variant="h6" className="analytics-form-title">
                    Summary Overview
                  </Typography>
                  <Typography variant="body2" className="analytics-section-text">
                    Switch between Weekly and Yearly totals.
                  </Typography>
                </Box>
                <Box className="analytics-summary-toggle">
                  <Button
                    variant={summaryView === 'weekly' ? 'contained' : 'outlined'}
                    className={summaryView === 'weekly' ? 'analytics-primary-btn' : 'analytics-secondary-btn'}
                    onClick={() => setSummaryView('weekly')}
                    size="small"
                  >
                    Weekly
                  </Button>
                  <Button
                    variant={summaryView === 'yearly' ? 'contained' : 'outlined'}
                    className={summaryView === 'yearly' ? 'analytics-primary-btn' : 'analytics-secondary-btn'}
                    onClick={() => setSummaryView('yearly')}
                    size="small"
                  >
                    Yearly
                  </Button>
                </Box>
              </Box>

              {isSummaryLoading ? (
                <Typography variant="body2">Loading summary...</Typography>
              ) : (
                <Grid container spacing={2} className="analytics-summary-grid">
                  <Grid item xs={12} sm={6} md={3}>
                    <Box className="analytics-summary-item">
                      <Typography className="analytics-summary-label">Parts Cost</Typography>
                      <Typography className="analytics-summary-value">{currencyFormatter.format(activeSummary.partsCost)}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box className="analytics-summary-item">
                      <Typography className="analytics-summary-label">Cash Total</Typography>
                      <Typography className="analytics-summary-value">{currencyFormatter.format(activeSummary.cashTotal)}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box className="analytics-summary-item">
                      <Typography className="analytics-summary-label">Parts Sold</Typography>
                      <Typography className="analytics-summary-value">{currencyFormatter.format(activeSummary.partsSold)}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box className="analytics-summary-item">
                      <Typography className="analytics-summary-label">Labour Sold</Typography>
                      <Typography className="analytics-summary-value">{currencyFormatter.format(activeSummary.labourSold)}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box className="analytics-summary-item">
                      <Typography className="analytics-summary-label">Parts Profit</Typography>
                      <Typography className="analytics-summary-value">{currencyFormatter.format(activeSummary.partsProfit)}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box className="analytics-summary-item">
                      <Typography className="analytics-summary-label">Labour Profit</Typography>
                      <Typography className="analytics-summary-value">{currencyFormatter.format(activeSummary.labourProfit)}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box className="analytics-summary-item">
                      <Typography className="analytics-summary-label">Total Invoice Amounts</Typography>
                      <Typography className="analytics-summary-value">{currencyFormatter.format(activeSummary.totalInvoices)}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box className="analytics-summary-item">
                      <Typography className="analytics-summary-label">Total VAT</Typography>
                      <Typography className="analytics-summary-value">{currencyFormatter.format(activeSummary.vat)}</Typography>
                    </Box>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>

          <Card className="analytics-table-card analytics-surface-card">
            <CardContent>
              <Box className="analytics-table-header-row">
                <Box>
                  <Typography variant="h6" className="analytics-form-title">
                    Weekly Records ({selectedWeek})
                  </Typography>
                  <Typography variant="body2" className="analytics-section-text">
                    Add rows manually and save each record.
                  </Typography>
                </Box>
                <Button className="analytics-primary-btn" variant="contained" onClick={handleAddRecordRow}>
                  Add Record
                </Button>
              </Box>

              {isLoadingRecords ? (
                <Typography variant="body2">Loading records...</Typography>
              ) : visibleRecords.length === 0 ? (
                <Typography variant="body2">No records saved for this filter yet. Click Add Record to start.</Typography>
              ) : (
                <TableContainer className="analytics-table-container">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Day</TableCell>
                        <TableCell>Make</TableCell>
                        <TableCell>Reg</TableCell>
                        <TableCell>Mechanic</TableCell>
                        <TableCell align="right">Hours</TableCell>
                        <TableCell>Invoice</TableCell>
                        <TableCell>Cust.</TableCell>
                        <TableCell align="right">Parts Cost</TableCell>
                        <TableCell align="right">Parts Sold</TableCell>
                        <TableCell align="right">Labour</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right">VAT</TableCell>
                        <TableCell align="right">Total incl. VAT</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visibleRecords.map((record) => {
                        const rowKey = getRowKey(record);
                        const isSavingThisRow = savingRowKey === rowKey;

                        return (
                          <TableRow key={rowKey} hover>
                            <TableCell>
                              <TextField
                                select
                                size="small"
                                value={record.day}
                                onChange={(event) => handleRowChange(rowKey, 'day', event.target.value)}
                                className="analytics-table-field"
                              >
                                {daysOfWeek.map((day) => (
                                  <MenuItem key={day} value={day}>{day}</MenuItem>
                                ))}
                              </TextField>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={record.vehicleMake}
                                onChange={(event) => handleRowChange(rowKey, 'vehicleMake', event.target.value)}
                                className="analytics-table-field"
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={record.vehicleReg}
                                onChange={(event) => handleRowChange(rowKey, 'vehicleReg', event.target.value.toUpperCase())}
                                className="analytics-table-field analytics-table-field--reg"
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                select
                                size="small"
                                value={record.technicianId}
                                onChange={(event) => handleRowChange(rowKey, 'technicianId', event.target.value)}
                                className="analytics-table-field"
                              >
                                {mechanics.map((mechanic) => (
                                  <MenuItem key={mechanic.id} value={mechanic.id}>{mechanic.name}</MenuItem>
                                ))}
                              </TextField>
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                size="small"
                                value={record.hours}
                                onChange={(event) => handleRowChange(rowKey, 'hours', event.target.value)}
                                className="analytics-table-field analytics-table-field--num analytics-table-field--hours"
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                select
                                size="small"
                                value={record.invoiceType}
                                onChange={(event) => handleRowChange(rowKey, 'invoiceType', event.target.value)}
                                className="analytics-table-field"
                              >
                                <MenuItem value="VAT">VAT</MenuItem>
                                <MenuItem value="CASH">CASH</MenuItem>
                              </TextField>
                            </TableCell>
                            <TableCell>
                              <TextField
                                select
                                size="small"
                                value={record.customerType}
                                onChange={(event) => handleRowChange(rowKey, 'customerType', event.target.value)}
                                className="analytics-table-field"
                              >
                                <MenuItem value="P">P</MenuItem>
                                <MenuItem value="I">I</MenuItem>
                              </TextField>
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                size="small"
                                value={record.partsCost}
                                onChange={(event) => handleRowChange(rowKey, 'partsCost', event.target.value)}
                                className="analytics-table-field analytics-table-field--num"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                size="small"
                                value={record.partsSold}
                                onChange={(event) => handleRowChange(rowKey, 'partsSold', event.target.value)}
                                className="analytics-table-field analytics-table-field--num"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                size="small"
                                value={record.labour}
                                onChange={(event) => handleRowChange(rowKey, 'labour', event.target.value)}
                                className="analytics-table-field analytics-table-field--num"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                size="small"
                                value={record.total}
                                onChange={(event) => handleRowChange(rowKey, 'total', event.target.value)}
                                className="analytics-table-field analytics-table-field--num"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                size="small"
                                value={record.vat}
                                onChange={(event) => handleRowChange(rowKey, 'vat', event.target.value)}
                                className="analytics-table-field analytics-table-field--num"
                              />
                            </TableCell>
                            <TableCell align="right" className="analytics-total-cell">
                              {currencyFormatter.format(toNumber(record.totalInclVat))}
                            </TableCell>
                            <TableCell align="right">
                              <Box className="analytics-row-actions">
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => handleSaveRow(record)}
                                  disabled={isSavingThisRow}
                                >
                                  {isSavingThisRow ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                  className="analytics-delete-btn"
                                  size="small"
                                  variant="text"
                                  onClick={() => handleDeleteRow(record)}
                                  disabled={isSavingThisRow}
                                >
                                  Delete
                                </Button>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {rowActionMessage && (
                <Typography variant="body2" className="analytics-row-message">
                  {rowActionMessage}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </Container>
    </div>
  );
};

export default Analytics;