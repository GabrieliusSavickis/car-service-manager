import { firestore } from '../firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

// Firestore allows 500 operations per batch.
const MAX_BATCH_OPERATIONS = 500;

/**
 * Normalise a registration the same way the appointment modal does. Use this
 * ONLY for a reg a person just typed, never to re-derive the key of an account
 * we already hold - older accounts have regs containing spaces, and normalising
 * those collides with a different account's reg.
 * @param {string} vehicleReg - A registration as typed
 * @returns {string} Upper-cased reg with whitespace removed
 */
export const normalizeVehicleReg = (vehicleReg) => (
  (vehicleReg || '').trim().toUpperCase().replace(/\s+/g, '')
);

const getCurrentUsername = () => sessionStorage.getItem('username') || '';

/**
 * The exact strings an account's appointments could be filed under: its
 * document id and its vehicleReg field, which are not always the same on older
 * records. Deliberately excludes the normalised form, which would reach into
 * other accounts.
 * @param {object} account - An account document as { id, ...data }
 * @returns {Array<string>} Distinct exact registration strings
 */
export const getAccountRegCandidates = (account) => {
  const candidates = [account?.id, account?.vehicleReg]
    .filter((value) => typeof value === 'string' && value !== '');

  return [...new Set(candidates)];
};

/**
 * Render a reg so invisible characters are obvious to whoever is reading it.
 * @param {string} vehicleReg - A registration string
 * @returns {string} The reg, annotated when it holds whitespace
 */
export const describeReg = (vehicleReg) => {
  const raw = vehicleReg || '';
  if (raw !== raw.trim()) return `${raw} (has a space at the end)`;
  if (/\s/.test(raw)) return `${raw} (contains a space)`;
  return raw;
};

/**
 * Look up an account by a typed registration. Tries the string exactly as
 * given first, so an account whose id holds a space can still be reached,
 * then falls back to the normalised form and a field query.
 * @param {string} accountsCollectionName - Accounts collection for this site
 * @param {string} vehicleReg - A registration as typed
 * @returns {Promise<object|null>} { id, ...data } or null when not found
 */
export const findAccountByReg = async (accountsCollectionName, vehicleReg) => {
  const raw = (vehicleReg || '');
  const candidates = [...new Set([raw, raw.trim(), normalizeVehicleReg(raw)])]
    .filter(Boolean);

  for (const candidate of candidates) {
    const snapshot = await getDoc(doc(firestore, accountsCollectionName, candidate));
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() };
    }
  }

  const normalizedReg = normalizeVehicleReg(raw);
  if (!normalizedReg) return null;

  const fallbackSnapshot = await getDocs(query(
    collection(firestore, accountsCollectionName),
    where('vehicleReg', '==', normalizedReg),
    limit(1)
  ));

  if (fallbackSnapshot.empty) return null;
  return { id: fallbackSnapshot.docs[0].id, ...fallbackSnapshot.docs[0].data() };
};

/**
 * Every appointment filed under an account, matched on the exact strings that
 * account uses rather than a normalised guess.
 * @param {string} appointmentsCollectionName - Appointments collection for this site
 * @param {object} account - An account document as { id, ...data }
 * @returns {Promise<Array>} Appointment documents as { id, ...data }
 */
export const getAppointmentsForAccount = async (appointmentsCollectionName, account) => {
  const candidates = getAccountRegCandidates(account);
  if (candidates.length === 0) return [];

  const byId = new Map();

  for (const candidate of candidates) {
    const snapshot = await getDocs(query(
      collection(firestore, appointmentsCollectionName),
      where('details.vehicleReg', '==', candidate)
    ));

    snapshot.docs.forEach((appointmentDoc) => {
      // id last: documents store their own 'id' field, which must not win here.
      byId.set(appointmentDoc.id, { ...appointmentDoc.data(), id: appointmentDoc.id });
    });
  }

  return [...byId.values()];
};

/**
 * Expand a selection of appointments to include every sibling segment of any
 * multi-day job, so a split job can never end up half on each account.
 * @param {Array} selected - Appointments the user chose to move
 * @param {Array} allForAccount - Every appointment currently on the source account
 * @returns {Array} The selection plus any missing group siblings
 */
export const expandToFullGroups = (selected, allForAccount) => {
  const groupIds = new Set(
    selected.map((appointment) => appointment.appointmentGroupId).filter(Boolean)
  );
  const selectedIds = new Set(selected.map((appointment) => appointment.id));

  const siblings = (allForAccount || []).filter((appointment) => (
    appointment.appointmentGroupId
    && groupIds.has(appointment.appointmentGroupId)
    && !selectedIds.has(appointment.id)
  ));

  return [...selected, ...siblings];
};

/**
 * Move appointments onto another account by rewriting the registration they are
 * recorded against. Each document is re-read first, so a stale reference cannot
 * abort the whole move - anything that has since been deleted is reported back
 * instead. The customer snapshot is refreshed from the target account wherever
 * the target has a value. Tasks, comments, times, mileage and parts status are
 * untouched.
 * @param {object} params - Move parameters
 * @param {string} params.appointmentsCollectionName - Appointments collection for this site
 * @param {Array} params.appointments - Appointments to move (groups already expanded)
 * @param {object} params.targetAccount - The account to move them onto
 * @returns {Promise<object>} { movedCount, missing } where missing names each skipped appointment
 */
export const moveAppointmentsToAccount = async ({
  appointmentsCollectionName,
  appointments,
  targetAccount,
}) => {
  if (!appointments || appointments.length === 0) {
    return { movedCount: 0, missing: [] };
  }

  // An account's reg is its document id; only fall back to the field.
  const targetReg = targetAccount.id || targetAccount.vehicleReg;
  const movedBy = getCurrentUsername();

  // Confirm each document still exists, so one stale id cannot fail the batch.
  const existenceChecks = await Promise.all(appointments.map(async (appointment) => {
    const snapshot = await getDoc(doc(firestore, appointmentsCollectionName, appointment.id));
    return { appointment, exists: snapshot.exists() };
  }));

  const present = existenceChecks.filter((check) => check.exists).map((check) => check.appointment);
  const missing = existenceChecks
    .filter((check) => !check.exists)
    .map(({ appointment }) => ({
      id: appointment.id,
      date: appointment.date || 'unknown date',
      startTime: appointment.startTime || '',
      vehicleReg: appointment.details?.vehicleReg || '',
    }));

  for (let start = 0; start < present.length; start += MAX_BATCH_OPERATIONS) {
    const chunk = present.slice(start, start + MAX_BATCH_OPERATIONS);
    const batch = writeBatch(firestore);

    chunk.forEach((appointment) => {
      const details = { ...(appointment.details || {}), vehicleReg: targetReg };

      // Only overwrite the snapshot where the target account actually has a value.
      if (targetAccount.vehicleMake) details.vehicleMake = targetAccount.vehicleMake;
      if (targetAccount.customerName) details.customerName = targetAccount.customerName;
      if (targetAccount.customerPhone) details.customerPhone = targetAccount.customerPhone;

      batch.update(doc(firestore, appointmentsCollectionName, appointment.id), {
        details,
        movedFromReg: appointment.details?.vehicleReg || '',
        movedAt: serverTimestamp(),
        movedBy,
      });
    });

    await batch.commit();
  }

  return { movedCount: present.length, missing };
};

/**
 * Delete an account document. Callers must confirm it has no appointments left.
 * @param {string} accountsCollectionName - Accounts collection for this site
 * @param {string} accountId - The account document id
 * @returns {Promise<void>}
 */
export const deleteAccount = (accountsCollectionName, accountId) => (
  deleteDoc(doc(firestore, accountsCollectionName, accountId))
);

/**
 * Change the registration an account is filed under. The reg is the account's
 * document id, so this creates the account under the new reg, moves its
 * appointments across, then removes the old one - in that order, so an
 * interruption can only ever leave a duplicate account to clean up, never
 * appointments with no account.
 * @param {object} params - Rename parameters
 * @param {string} params.accountsCollectionName - Accounts collection for this site
 * @param {string} params.appointmentsCollectionName - Appointments collection for this site
 * @param {object} params.account - The account being renamed, with any edited fields applied
 * @param {string} params.newReg - The registration to move it to
 * @returns {Promise<object>} { newId, movedCount, missing }
 */
export const renameAccountReg = async ({
  accountsCollectionName,
  appointmentsCollectionName,
  account,
  newReg,
}) => {
  const targetReg = normalizeVehicleReg(newReg);

  if (!targetReg) {
    throw new Error('Enter a vehicle registration.');
  }

  // The document id is the account's identity. Never re-derive it.
  if (!account?.id) {
    throw new Error('This account could not be identified. Reload the page and try again.');
  }

  if (targetReg === account.id) {
    return { newId: account.id, movedCount: 0, missing: [] };
  }

  const sourceSnapshot = await getDoc(doc(firestore, accountsCollectionName, account.id));
  if (!sourceSnapshot.exists()) {
    throw new Error(
      `The account ${describeReg(account.id)} no longer exists. Reload the page and try again.`
    );
  }

  const existingTarget = await getDoc(doc(firestore, accountsCollectionName, targetReg));
  if (existingTarget.exists()) {
    throw new Error(
      `An account already exists for ${targetReg}. To combine them, open this account's `
      + 'History and use "Move all to another reg" instead.'
    );
  }

  const appointments = await getAppointmentsForAccount(appointmentsCollectionName, account);

  const { id: _oldId, ...accountFields } = account;
  const newAccount = {
    ...accountFields,
    vehicleReg: targetReg,
    renamedFromReg: account.id,
    renamedAt: serverTimestamp(),
    renamedBy: getCurrentUsername(),
  };

  await setDoc(doc(firestore, accountsCollectionName, targetReg), newAccount);

  const { movedCount, missing } = await moveAppointmentsToAccount({
    appointmentsCollectionName,
    appointments,
    targetAccount: { ...newAccount, id: targetReg },
  });

  await deleteDoc(doc(firestore, accountsCollectionName, account.id));

  return { newId: targetReg, movedCount, missing };
};
