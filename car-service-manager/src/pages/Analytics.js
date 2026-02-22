import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  ButtonGroup,
  Avatar,
  useTheme,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { firestore } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import Header from '../components/Header/Header';
import './Analytics.css';
import { getTechnicians } from '../utils/technicianUtils';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import MenuItem from '@mui/material/MenuItem';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const Analytics = () => {
  const now = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(now.getDate() - 6); // last 7 days

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(now);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [summary, setSummary] = useState({ week: 0, month: 0, year: 0 });
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const theme = useTheme();
  const [techList, setTechList] = useState([]);
  const [selectedTech, setSelectedTech] = useState('All');
  const [techMap, setTechMap] = useState({});
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);

  // Determine location suffix like previous pages
  const hostname = window.location.hostname;
  let locationSuffix = '';
  if (hostname.includes('asgennislive.ie')) {
    locationSuffix = '_ennis';
  } else if (hostname.includes('asglive.ie')) {
    locationSuffix = '';
  }
  const appointmentsCollectionName = 'appointments' + locationSuffix;

  useEffect(() => {
    const fetchData = async () => {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch all appointments and filter client-side to avoid relying on string range queries
      const querySnapshot = await getDocs(collection(firestore, appointmentsCollectionName));

        // Prepare labels for each day in range and accumulate minutes
        const labels = [];
        const dayMap = {};
        for (let d = new Date(startOfDay); d <= endOfDay; d.setDate(d.getDate() + 1)) {
          const label = new Date(d).toDateString();
          labels.push(label);
          dayMap[label] = 0; // minutes
        }

        // Helper to parse appointment date robustly
        const parseApptDate = (appt) => {
          if (!appt) return null;
          if (appt.date) {
            const d = new Date(appt.date);
            if (!isNaN(d)) return d;
            const asNum = Number(appt.date);
            if (!isNaN(asNum)) return new Date(asNum);
          }
          if (appt.formattedDateTime) {
            const d = new Date(appt.formattedDateTime);
            if (!isNaN(d)) return d;
          }
          return null;
        };

        const appointments = [];
        querySnapshot.forEach((doc) => {
          appointments.push({ id: doc.id, ...doc.data() });
        });

        const selectedTechId = selectedTech === 'All' ? null : techMap[selectedTech] || null;

        const appointmentMatchesTech = (appointment) => {
          if (selectedTech === 'All') return true;
          // Match appointment-level fields
          if (appointment.tech && appointment.tech === selectedTech) return true;
          if (appointment.techId && String(appointment.techId) === String(selectedTechId)) return true;
          // Check tasks for matching completedBy or completedById
          const { tasks } = appointment.details || {};
          if (tasks && Array.isArray(tasks)) {
            for (const t of tasks) {
              if (!t) continue;
              if (t.completedBy && t.completedBy === selectedTech) return true;
              if (t.completedById && String(t.completedById) === String(selectedTechId)) return true;
              // sometimes completedBy may store an id
              if (selectedTechId && String(t.completedBy) === String(selectedTechId)) return true;
            }
          }
          return false;
        };

        appointments.forEach((appointment) => {
          const apptDateObj = parseApptDate(appointment);
          if (!apptDateObj) return;
          const apptDateStr = apptDateObj.toDateString();
          if (apptDateObj >= startOfDay && apptDateObj <= endOfDay && dayMap[apptDateStr] !== undefined) {
            const { tasks } = appointment.details || {};
            if (tasks) {
              tasks.forEach((task) => {
                if (task.completed) {
                  // If technician filter is applied, only accumulate for that technician
                  if (appointmentMatchesTech(appointment) || (task.completedBy && (task.completedBy === selectedTech || String(task.completedBy) === String(selectedTechId)))) {
                    dayMap[apptDateStr] += (task.timeSpent || 0); // minutes
                  }
                }
              });
            }
          }
        });

      const dataPoints = labels.map((l) => +(dayMap[l] / 60).toFixed(2)); // hours

      const totalMinutes = Object.values(dayMap).reduce((s, v) => s + v, 0);
      const totalHrs = +(totalMinutes / 60).toFixed(2);

      setChartData({
        labels,
        datasets: [
          {
            label: 'Technician Hours (hrs)',
            data: dataPoints,
            borderColor: theme.palette.primary.main,
            backgroundColor: 'rgba(25,118,210,0.12)',
            tension: 0.3,
            pointRadius: 4,
          },
        ],
      });

      // Compute appointments count in range (respecting parsed dates)
      const apptsInRange = appointments.filter(a => {
        const d = parseApptDate(a);
        if (!d || d < startOfDay || d > endOfDay) return false;
        if (selectedTech === 'All') return true;
        // appointment-level matches
        if (a.tech && a.tech === selectedTech) return true;
        if (a.techId && String(a.techId) === String(selectedTechId)) return true;
        // tasks-level matches
        const { tasks } = a.details || {};
        if (tasks && Array.isArray(tasks)) {
          for (const t of tasks) {
            if (!t) continue;
            if (t.completedBy && (t.completedBy === selectedTech || String(t.completedBy) === String(selectedTechId))) return true;
            if (t.completedById && String(t.completedById) === String(selectedTechId)) return true;
          }
        }
        return false;
      });
      setAppointmentsCount(apptsInRange.length);
      setTotalHours(totalHrs);

      // Compute summary counts locally
      const today = new Date();
      const weekStart = new Date();
      weekStart.setDate(today.getDate() - 7);
      const monthStart = new Date();
      monthStart.setMonth(today.getMonth() - 1);
      const yearStart = new Date();
      yearStart.setFullYear(today.getFullYear() - 1);

      const weekCount = appointments.filter(a => {
        const d = parseApptDate(a);
        return d && d >= weekStart && d <= today;
      }).length;
      const monthCount = appointments.filter(a => {
        const d = parseApptDate(a);
        return d && d >= monthStart && d <= today;
      }).length;
      const yearCount = appointments.filter(a => {
        const d = parseApptDate(a);
        return d && d >= yearStart && d <= today;
      }).length;

      setSummary({ week: weekCount, month: monthCount, year: yearCount });
    };

    fetchData();
  }, [startDate, endDate, appointmentsCollectionName, selectedTech, techMap, theme]);

  // Load available technicians for dropdown
  useEffect(() => {
    const loadTechs = async () => {
      try {
        const techs = await getTechnicians(locationSuffix);
        const names = techs.map(t => t.name).filter(Boolean);
        const map = {};
        techs.forEach(t => {
          if (t && t.name) map[t.name] = t.id;
        });
        setTechMap(map);
        setTechList(['All', ...names]);
      } catch (err) {
        console.error('Failed to load technicians', err);
        setTechList(['All']);
      }
    };

    loadTechs();
  }, [locationSuffix]);

  const numberOfDays = useMemo(() => {
    const diff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [startDate, endDate]);

  const avgHoursPerDay = useMemo(() => {
    return +(totalHours / numberOfDays).toFixed(2);
  }, [totalHours, numberOfDays]);

  const handlePreset = (days) => {
    const newEnd = new Date();
    const newStart = new Date();
    newStart.setDate(newEnd.getDate() - (days - 1));
    setStartDate(newStart);
    setEndDate(newEnd);
  };

  const formattedRange = `${startDate.toLocaleDateString()} — ${endDate.toLocaleDateString()}`;

  const openRangeDialog = () => setRangeDialogOpen(true);
  const closeRangeDialog = () => setRangeDialogOpen(false);
  const applyRangeDialog = () => {
    setRangeDialogOpen(false);
  };

  return (
    <div>
      <Header />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <h1>Analytics</h1>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
                {/* KPI Gradient Variant: Blue */}
                <Card className="kpi-card kpi-gradient kpi-gradient--blue">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                      <PersonIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2">Appointments</Typography>
                      <Typography variant="h6">{appointmentsCount}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>in selected range</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
                {/* KPI Gradient Variant: Green */}
                <Card className="kpi-card kpi-gradient kpi-gradient--green">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: '#fff' }}>
                      <AccessTimeIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)' }}>Total Hours</Typography>
                      <Typography variant="h6" sx={{ color: '#fff' }}>{totalHours} hrs</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>across selected technicians</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
                {/* KPI Gradient Variant: Orange */}
                <Card className="kpi-card kpi-gradient kpi-gradient--orange">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }}>
                      <TrendingUpIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)' }}>Avg / Day</Typography>
                      <Typography variant="h6" sx={{ color: '#fff' }}>{avgHoursPerDay} hrs</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>per technician per day</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="h6">Technician Hours</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ButtonGroup variant="outlined" size="small" sx={{ mr: 1 }}>
                        <Button onClick={() => handlePreset(7)}>7d</Button>
                        <Button onClick={() => handlePreset(30)}>30d</Button>
                        <Button onClick={() => handlePreset(90)}>90d</Button>
                      </ButtonGroup>

                      <TextField
                        select
                        value={selectedTech}
                        size="small"
                        onChange={(e) => setSelectedTech(e.target.value)}
                        sx={{ width: 160, mr: 1 }}
                      >
                        {techList.map((tech) => (
                          <MenuItem key={tech} value={tech}>{tech}</MenuItem>
                        ))}
                      </TextField>

                      <Button variant="outlined" size="small" onClick={openRangeDialog}>{formattedRange}</Button>
                    </Box>
                  </Box>
                  <Box className="chart-wrapper">
                    <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Summary</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                    <Typography>Appointments (last 7 days): <strong>{summary.week}</strong></Typography>
                    <Typography>Appointments (last 30 days): <strong>{summary.month}</strong></Typography>
                    <Typography>Appointments (last 12 months): <strong>{summary.year}</strong></Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>

      <Dialog open={rangeDialogOpen} onClose={closeRangeDialog}>
        <DialogTitle>Select Date Range</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <DatePicker
                label="Start"
                value={startDate}
                onChange={(newValue) => {
                  if (newValue) setStartDate(newValue);
                }}
                renderInput={(params) => <TextField {...params} />}
              />
              <DatePicker
                label="End"
                value={endDate}
                onChange={(newValue) => {
                  if (newValue) setEndDate(newValue);
                }}
                renderInput={(params) => <TextField {...params} />}
              />
            </Box>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRangeDialog}>Cancel</Button>
          <Button onClick={applyRangeDialog} variant="contained">Apply</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Analytics;
