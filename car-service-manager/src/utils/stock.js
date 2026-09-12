import { firestore } from '../firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getLocationSuffix } from './location';

// Consumables are private to each garage; shared parts are one list for both.
export const getConsumablesCollectionName = () => `stock_consumables${getLocationSuffix()}`;
export const SHARED_PARTS_COLLECTION = 'stock_shared_parts';

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export const STOCK_STATUS = {
  OK: 'ok',
  LOW: 'low',
  OUT: 'out',
};

export const STOCK_STATUS_LABELS = {
  [STOCK_STATUS.OK]: 'In stock',
  [STOCK_STATUS.LOW]: 'Low stock',
  [STOCK_STATUS.OUT]: 'Out of stock',
};

const currencyFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrency = (value) => currencyFormatter.format(toNumber(value));

/**
 * Derive the stock status of a consumable from its quantity and alert level.
 * @param {object} item - A consumables record
 * @returns {string} One of the STOCK_STATUS values
 */
export const getStockStatus = (item) => {
  const quantity = toNumber(item?.quantity);
  if (quantity <= 0) return STOCK_STATUS.OUT;

  const threshold = item?.lowStockThreshold === undefined || item?.lowStockThreshold === null
    ? DEFAULT_LOW_STOCK_THRESHOLD
    : toNumber(item.lowStockThreshold);

  return quantity <= threshold ? STOCK_STATUS.LOW : STOCK_STATUS.OK;
};

export const isLowStock = (item) => getStockStatus(item) !== STOCK_STATUS.OK;

const getCurrentUsername = () => sessionStorage.getItem('username') || '';

/**
 * Create or update a stock item, stamping who changed it and when.
 * @param {string} collectionName - Firestore collection to write to
 * @param {string|null} id - Existing doc id, or null to create
 * @param {object} payload - Fields to write
 * @returns {Promise<string>} The doc id
 */
export const saveStockItem = async (collectionName, id, payload) => {
  const stamped = {
    ...payload,
    updatedAt: serverTimestamp(),
    updatedBy: getCurrentUsername(),
  };

  if (id) {
    await updateDoc(doc(firestore, collectionName, id), stamped);
    return id;
  }

  const created = await addDoc(collection(firestore, collectionName), {
    ...stamped,
    createdAt: serverTimestamp(),
    createdBy: getCurrentUsername(),
  });
  return created.id;
};

export const deleteStockItem = (collectionName, id) => (
  deleteDoc(doc(firestore, collectionName, id))
);

/**
 * Change an item's quantity by a delta inside a transaction, so two people
 * clicking at the same time cannot lose a count or push it below zero.
 * @param {string} collectionName - Firestore collection the item lives in
 * @param {string} id - The item's doc id
 * @param {number} delta - Positive or negative whole number
 * @returns {Promise<number>} The quantity after the change
 */
export const adjustStockQuantity = (collectionName, id, delta) => (
  runTransaction(firestore, async (transaction) => {
    const ref = doc(firestore, collectionName, id);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      throw new Error('This item no longer exists.');
    }

    const nextQuantity = Math.max(toNumber(snapshot.data().quantity) + delta, 0);
    transaction.update(ref, {
      quantity: nextQuantity,
      updatedAt: serverTimestamp(),
      updatedBy: getCurrentUsername(),
    });
    return nextQuantity;
  })
);
