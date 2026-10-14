import * as XLSX from 'xlsx';
import { firestore } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getTechnicians } from './technicianUtils';
import { getLocationLabel } from './location';
import { getPartsStatus, getPartsStatusLabel } from './partsStatus';
import {
  SERVICE_DUE_SOON_DAYS,
  SERVICE_INTERVAL_MONTHS,
  isServiceAppointment,
  summariseServiceHistory,
} from './serviceHistory';
import { normalizeVehicleReg } from './accountMaintenance';

const DATE_FORMAT = 'dd/mm/yyyy';

const ACCOUNT_COLUMNS = [
  'Vehicle Reg',
  'Customer Name',
  'Customer Phone',
  'Vehicle Make',
  'Latest Mileage',
  'Flagged',
  'Flag Reason',
  'Customer Notes',
  'Total Jobs',
  'Services Done',
  'First Visit',
  'Last Visit',
  'Last Service',
  'Months Since Service',
  'Next Service Due',
  'Due Soon',
  'Overdue',
];

const HISTORY_COLUMNS = [
  'Vehicle Reg',
  'Customer Name',
  'Customer Phone',
  'Date',
  'Start Time',
  'Mechanic',
  'Mileage',
  'Was Service',
  'Days Booked',
  'Tasks',
  'Tasks Completed',
  'Parts',
  'Comments',
];

// Columns holding real dates, so Excel can sort and filter them as dates.
const ACCOUNT_DATE_COLUMNS = ['First Visit', 'Last Visit', 'Last Service', 'Next Service Due'];
const HISTORY_DATE_COLUMNS = ['Date'];

const yesNo = (value) => (value ? 'Yes' : 'No');
const yesBlank = (value) => (value ? 'YES' : '');

const FLAG_REASON_LABELS = {
  payment_overdue: 'Payment overdue',
  payment_issues: 'Payment issues',
  problematic_client: 'Problematic client',
};

/**
 * Build a worksheet, giving date columns a real date format and leaving
 * everything else as typed. Phone numbers stay text in xlsx, so leading zeros
 * survive without any special handling.
 * @param {Array<string>} columns - Header row
 * @param {Array<Array>} rows - Data rows in the same order as columns
 * @param {Array<string>} dateColumns - Which headers hold Date values
 * @returns {object} A SheetJS worksheet
 */
const buildSheet = (columns, rows, dateColumns) => {
  const sheet = XLSX.utils.aoa_to_sheet([columns, ...rows], { cellDates: true });
  const range = XLSX.utils.decode_range(sheet['!ref']);

  const dateColumnIndexes = dateColumns
    .map((header) => columns.indexOf(header))
    .filter((index) => index >= 0);

  dateColumnIndexes.forEach((columnIndex) => {
    for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      if (cell && cell.t === 'd') {
        cell.z = DATE_FORMAT;
      }
    }
  });

  sheet['!cols'] = columns.map((header) => ({ wch: Math.min(Math.max(header.length + 2, 12), 42) }));
  sheet['!autofilter'] = { ref: sheet['!ref'] };

  return sheet;
};

/**
 * Turn a workbook into a file the browser downloads.
 * @param {object} workbook - A SheetJS workbook
 * @param {string} fileName - File name to save as
 * @returns {void}
 */
const downloadWorkbook = (workbook, fileName) => {
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Read every appointment for a site once and group them by registration. One
 * full collection read is far cheaper than a query per account.
 * @param {string} appointmentsCollectionName - Appointments collection for this site
 * @returns {Promise<Map<string, Array>>} Appointments keyed by normalised reg
 */
const loadAppointmentsByReg = async (appointmentsCollectionName) => {
  const snapshot = await getDocs(collection(firestore, appointmentsCollectionName));
  const byReg = new Map();

  snapshot.docs.forEach((appointmentDoc) => {
    const appointment = { ...appointmentDoc.data(), id: appointmentDoc.id };
    const reg = normalizeVehicleReg(appointment.details?.vehicleReg);
    if (!reg) return;

    if (!byReg.has(reg)) byReg.set(reg, []);
    byReg.get(reg).push(appointment);
  });

  return byReg;
};

const buildAccountRow = (account, appointments, today) => {
  const summary = summariseServiceHistory(appointments, today);

  return [
    account.vehicleReg || account.id,
    account.customerName || '',
    account.customerPhone || '',
    account.vehicleMake || '',
    account.mileage || '',
    yesNo(account.flagged === true),
    account.flagged === true
      ? (FLAG_REASON_LABELS[account.flaggedReason] || account.flaggedReason || '')
      : '',
    account.customerNotes || '',
    summary.totalJobs,
    summary.serviceCount,
    summary.firstVisitDate,
    summary.lastVisitDate,
    summary.lastServiceDate,
    summary.monthsSinceService === null ? '' : summary.monthsSinceService,
    summary.nextServiceDue,
    yesBlank(summary.dueSoon),
    yesBlank(summary.isOverdue),
  ];
};

const buildHistoryRows = (account, appointments, technicianNameById) => {
  const summary = summariseServiceHistory(appointments);

  return summary.jobs
    .slice()
    .sort((a, b) => b.sortTime - a.sortTime)
    .map((job) => {
      const details = job.details || {};
      const tasks = details.tasks || [];
      const partsStatus = getPartsStatus(details);

      return [
        account.vehicleReg || account.id,
        account.customerName || '',
        account.customerPhone || '',
        job.sortTime > 0 ? new Date(job.sortTime) : '',
        job.startTime || '',
        technicianNameById.get(job.techId) || job.tech || '',
        details.mileage || '',
        yesBlank(isServiceAppointment(job)),
        job.segmentCount || 1,
        tasks.map((task) => task.text || '').filter(Boolean).join('; '),
        `${tasks.filter((task) => task.completed).length}/${tasks.length}`,
        partsStatus === 'none' ? '' : getPartsStatusLabel(partsStatus),
        details.comments || '',
      ];
    });
};

/**
 * Build and download a workbook with an Accounts tab and a History tab.
 * @param {object} params - Export parameters
 * @param {Array} params.accounts - Accounts already loaded on the page
 * @param {string} params.appointmentsCollectionName - Appointments collection for this site
 * @param {string} params.locationSuffix - '' or '_ennis'
 * @param {string} params.locationKey - 'main' or 'ennis'
 * @returns {Promise<object>} What was exported: file name and row counts
 */
export const exportAccountsWorkbook = async ({
  accounts,
  appointmentsCollectionName,
  locationSuffix,
  locationKey,
}) => {
  const today = new Date();
  const [appointmentsByReg, technicians] = await Promise.all([
    loadAppointmentsByReg(appointmentsCollectionName),
    getTechnicians(locationSuffix),
  ]);

  const technicianNameById = new Map(technicians.map((tech) => [tech.id, tech.name]));

  const sortedAccounts = [...accounts].sort((a, b) => (
    (a.vehicleReg || a.id || '').localeCompare(b.vehicleReg || b.id || '')
  ));

  const accountRows = [];
  const historyRows = [];

  sortedAccounts.forEach((account) => {
    const reg = normalizeVehicleReg(account.vehicleReg || account.id);
    const appointments = appointmentsByReg.get(reg) || [];

    accountRows.push(buildAccountRow(account, appointments, today));
    historyRows.push(...buildHistoryRows(account, appointments, technicianNameById));
  });

  // Newest job first across the whole sheet.
  historyRows.sort((a, b) => {
    const aTime = a[3] instanceof Date ? a[3].getTime() : 0;
    const bTime = b[3] instanceof Date ? b[3].getTime() : 0;
    return bTime - aTime;
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(ACCOUNT_COLUMNS, accountRows, ACCOUNT_DATE_COLUMNS),
    'Accounts'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(HISTORY_COLUMNS, historyRows, HISTORY_DATE_COLUMNS),
    'Service History'
  );

  const stamp = today.toISOString().slice(0, 10);
  const fileName = `asg-accounts-${locationKey}-${stamp}.xlsx`;
  downloadWorkbook(workbook, fileName);

  return {
    fileName,
    accountCount: accountRows.length,
    historyCount: historyRows.length,
    dueSoonCount: accountRows.filter((row) => row[15] === 'YES').length,
    locationLabel: getLocationLabel(locationKey),
    intervalMonths: SERVICE_INTERVAL_MONTHS,
    dueSoonDays: SERVICE_DUE_SOON_DAYS,
  };
};
