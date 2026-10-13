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
 * Normalise a registration the same way the appointment modal does, so a
 * typed-in reg resolves to the same account document.
 * @param {string} vehicleReg - A registration as typed
 * @returns {string} Upper-cased reg with whitespace removed
 */
export const normalizeVehicleReg = (vehicleReg) => (
  (vehicleReg || '').trim().toUpperCase().replace(/\s+/g, '')
);

const getCurrentUsername = () => sessionStorage.getItem('username') || '';

/**
 * Look up an account by registration, falling back to a field query for older
 * records whose doc id is not the registration.
 * @param {string} accountsCollectionName - Accounts collection for this site
 * @param {string} vehicleReg - A registration as typed
 * @returns {Promise<object|null>} { id, ...data } or null when not found
 */
export const findAccountByReg = async (accountsCollectionName, vehicleReg) => {
  const normalizedReg = normalizeVehicleReg(vehicleReg);
  if (!normalizedReg) return null;

  const byIdSnapshot = await getDoc(doc(firestore, accountsCollectionName, normalizedReg));
  if (byIdSnapshot.exists()) {
    return { id: byIdSnapshot.id, ...byIdSnapshot.data() };
  }

  const fallbackSnapshot = await getDocs(query(
    collection(firestore, accountsCollectionName),
    where('vehicleReg', '==', normalizedReg),
    limit(1)
  ));

  if (fallbackSnapshot.empty) return null;
  return { id: fallbackSnapshot.docs[0].id, ...fallbackSnapshot.docs[0].data() };
};

/**
 * Every appointment document recorded against a registration.
 * @param {string} appointmentsCollectionName - Appointments collection for this site
 * @param {string} vehicleReg - A registration as typed
 * @returns {Promise<Array>} Appointment documents as { id, ...data }
 */
export const getAppointmentsForReg = async (appointmentsCollectionName, vehicleReg) => {
  const normalizedReg = normalizeVehicleReg(vehicleReg);
  if (!normalizedReg) return [];

  const snapshot = await getDocs(query(
    collection(firestore, appointmentsCollectionName),
    where('details.vehicleReg', '==', normalizedReg)
  ));

  return snapshot.docs.map((appointmentDoc) => ({ id: appointmentDoc.id, ...appointmentDoc.data() }));
};

/**
 * Expand a selection of appointments to include every sibling segment of any
 * multi-day job, so a split job can never end up half on each account.
 * @param {Array} selected - Appointments the user chose to move
 * @param {Array} allForReg - Every appointment currently on the source account
 * @returns {Array} The selection plus any missing group siblings
 */
export const expandToFullGroups = (selected, allForReg) => {
  const groupIds = new Set(
    selected.map((appointment) => appointment.appointmentGroupId).filter(Boolean)
  );
  const selectedIds = new Set(selected.map((appointment) => appointment.id));

  const siblings = allForReg.filter((appointment) => (
    appointment.appointmentGroupId
    && groupIds.has(appointment.appointmentGroupId)
    && !selectedIds.has(appointment.id)
  ));

  return [...selected, ...siblings];
};

/**
 * Move appointments onto another account by rewriting the registration they are
 * recorded against. The customer snapshot on each appointment is refreshed from
 * the target account wherever the target has a value, so the record stays
 * coherent. Tasks, comments, times, mileage and parts status are untouched.
 * @param {object} params - Move parameters
 * @param {string} params.appointmentsCollectionName - Appointments collection for this site
 * @param {Array} params.appointments - Appointments to move (groups already expanded)
 * @param {object} params.targetAccount - The account to move them onto
 * @returns {Promise<number>} How many appointments were moved
 */
export const moveAppointmentsToAccount = async ({
  appointmentsCollectionName,
  appointments,
  targetAccount,
}) => {
  if (!appointments || appointments.length === 0) return 0;

  const targetReg = normalizeVehicleReg(targetAccount.vehicleReg || targetAccount.id);
  const movedBy = getCurrentUsername();

  for (let start = 0; start < appointments.length; start += MAX_BATCH_OPERATIONS) {
    const chunk = appointments.slice(start, start + MAX_BATCH_OPERATIONS);
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

  return appointments.length;
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
 * @returns {Promise<object>} { newId, movedCount }
 */
export const renameAccountReg = async ({
  accountsCollectionName,
  appointmentsCollectionName,
  account,
  newReg,
}) => {
  const targetReg = normalizeVehicleReg(newReg);
  const currentReg = normalizeVehicleReg(account.vehicleReg || account.id);

  if (!targetReg) {
    throw new Error('Enter a vehicle registration.');
  }

  if (targetReg === currentReg) {
    return { newId: account.id, movedCount: 0 };
  }

  const existing = await findAccountByReg(accountsCollectionName, targetReg);
  if (existing) {
    throw new Error(
      `An account already exists for ${targetReg}. To combine them, open this account's `
      + 'History and use "Move all to another reg" instead.'
    );
  }

  const appointments = await getAppointmentsForReg(appointmentsCollectionName, currentReg);

  const { id: _oldId, ...accountFields } = account;
  const newAccount = {
    ...accountFields,
    vehicleReg: targetReg,
    renamedFromReg: currentReg,
    renamedAt: serverTimestamp(),
    renamedBy: getCurrentUsername(),
  };

  await setDoc(doc(firestore, accountsCollectionName, targetReg), newAccount);

  const movedCount = await moveAppointmentsToAccount({
    appointmentsCollectionName,
    appointments,
    targetAccount: { ...newAccount, id: targetReg },
  });

  await deleteDoc(doc(firestore, accountsCollectionName, account.id));

  return { newId: targetReg, movedCount };
};
