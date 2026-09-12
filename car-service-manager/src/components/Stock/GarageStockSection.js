import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { FaExclamationTriangle, FaPlus } from 'react-icons/fa';
import { firestore } from '../../firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  STOCK_STATUS,
  STOCK_STATUS_LABELS,
  adjustStockQuantity,
  deleteStockItem,
  formatCurrency,
  getStockStatus,
  isLowStock,
  saveStockItem,
  toNumber,
} from '../../utils/stock';
import QuantityControl from './QuantityControl';
import StockItemDialog, { STOCK_ITEM_VARIANTS } from './StockItemDialog';

const matchesSearch = (item, term) => {
  if (!term) return true;
  const haystack = [item.name, item.partNumber, item.supplier]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
};

function GarageStockSection({ collectionName, locationLabel }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    const stockQuery = query(collection(firestore, collectionName), orderBy('name'));

    const unsubscribe = onSnapshot(
      stockQuery,
      (snapshot) => {
        setItems(snapshot.docs.map((stockDoc) => ({ id: stockDoc.id, ...stockDoc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load garage stock:', error);
        setActionMessage('Could not load stock. Please refresh.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName]);

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.count += 1;
        acc.value += toNumber(item.quantity) * toNumber(item.price);
        if (isLowStock(item)) acc.lowCount += 1;
        return acc;
      },
      { count: 0, lowCount: 0, value: 0 }
    );
  }, [items]);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => matchesSearch(item, term) && (!showLowOnly || isLowStock(item)));
  }, [items, search, showLowOnly]);

  const openAddDialog = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSave = async (payload, id) => {
    await saveStockItem(collectionName, id, payload);
    setActionMessage(id ? `${payload.name} updated.` : `${payload.name} added.`);
    closeDialog();
  };

  const handleAdjust = async (item, delta) => {
    try {
      setBusyId(item.id);
      await adjustStockQuantity(collectionName, item.id, delta);
    } catch (error) {
      console.error('Failed to adjust quantity:', error);
      setActionMessage(`Could not update ${item.name}. Please try again.`);
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Delete ${item.name} from stock?`);
    if (!confirmed) return;

    try {
      setBusyId(item.id);
      await deleteStockItem(collectionName, item.id);
      setActionMessage(`${item.name} deleted.`);
    } catch (error) {
      console.error('Failed to delete stock item:', error);
      setActionMessage(`Could not delete ${item.name}. Please try again.`);
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <Grid container spacing={2} className="stock-summary-grid">
        <Grid item xs={12} sm={4}>
          <Box className="stock-summary-item">
            <Typography className="stock-summary-label">Items Tracked</Typography>
            <Typography className="stock-summary-value">{summary.count}</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Box className={`stock-summary-item${summary.lowCount > 0 ? ' stock-summary-item--alert' : ''}`}>
            <Typography className="stock-summary-label">Low or Out of Stock</Typography>
            <Typography className="stock-summary-value">{summary.lowCount}</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Box className="stock-summary-item">
            <Typography className="stock-summary-label">Stock Value</Typography>
            <Typography className="stock-summary-value">{formatCurrency(summary.value)}</Typography>
          </Box>
        </Grid>
      </Grid>

      <Card className="stock-surface-card stock-table-card">
        <CardContent>
          <Box className="stock-table-header">
            <Box>
              <Typography variant="h6" className="stock-section-title">
                {locationLabel} Garage Stock
              </Typography>
            </Box>
            <Box className="stock-toolbar">
              <TextField
                size="small"
                placeholder="Search name, part no., supplier"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="stock-search-field"
              />
              <Button
                variant="text"
                size="small"
                onClick={() => setShowLowOnly((prev) => !prev)}
                className={`stock-filter-btn${showLowOnly ? ' stock-filter-btn--active' : ''}`}
              >
                <FaExclamationTriangle />
                <span>Low only</span>
              </Button>
              <Button variant="contained" onClick={openAddDialog} className="stock-primary-btn">
                <FaPlus className="stock-btn-icon" />
                Add Item
              </Button>
            </Box>
          </Box>

          {actionMessage && (
            <Typography variant="body2" className="stock-action-message">{actionMessage}</Typography>
          )}

          <TableContainer className="stock-table-container">
            <Table>
              <TableHead>
                <TableRow className="stock-table-header-row">
                  <TableCell>Item</TableCell>
                  <TableCell>Part No.</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="center">Quantity</TableCell>
                  <TableCell align="center">Alert At</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="stock-empty-cell">Loading stock...</TableCell>
                  </TableRow>
                )}
                {!loading && visibleItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="stock-empty-cell">
                      {items.length === 0
                        ? 'No stock recorded yet. Add your first item to get started.'
                        : 'Nothing matches the current search or filter.'}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && visibleItems.map((item) => {
                  const status = getStockStatus(item);
                  const isBusy = busyId === item.id;

                  return (
                    <TableRow key={item.id} className={`stock-table-row stock-table-row--${status}`}>
                      <TableCell className="stock-item-name">{item.name}</TableCell>
                      <TableCell>{item.partNumber || '-'}</TableCell>
                      <TableCell>{item.supplier || '-'}</TableCell>
                      <TableCell align="right">{formatCurrency(item.price)}</TableCell>
                      <TableCell align="center">
                        <QuantityControl
                          quantity={toNumber(item.quantity)}
                          onIncrement={() => handleAdjust(item, 1)}
                          onDecrement={() => handleAdjust(item, -1)}
                          disabled={isBusy}
                        />
                      </TableCell>
                      <TableCell align="center">{toNumber(item.lowStockThreshold)}</TableCell>
                      <TableCell>
                        <span className={`stock-status-chip stock-status-chip--${status}`}>
                          {status !== STOCK_STATUS.OK && <FaExclamationTriangle />}
                          {STOCK_STATUS_LABELS[status]}
                        </span>
                      </TableCell>
                      <TableCell align="center">
                        <Box className="stock-row-actions">
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => openEditDialog(item)}
                            className="stock-secondary-btn"
                            disabled={isBusy}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => handleDelete(item)}
                            className="stock-delete-btn"
                            disabled={isBusy}
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
        </CardContent>
      </Card>

      <StockItemDialog
        open={dialogOpen}
        variant={STOCK_ITEM_VARIANTS.CONSUMABLE}
        item={editingItem}
        onSave={handleSave}
        onClose={closeDialog}
      />
    </>
  );
}

export default GarageStockSection;
