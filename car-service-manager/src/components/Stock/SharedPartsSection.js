import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
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
import { FaPlus } from 'react-icons/fa';
import { firestore } from '../../firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { LOCATION_KEYS, LOCATION_OPTIONS, getLocationLabel } from '../../utils/location';
import {
  SHARED_PARTS_COLLECTION,
  adjustStockQuantity,
  deleteStockItem,
  formatCurrency,
  saveStockItem,
  toNumber,
} from '../../utils/stock';
import QuantityControl from './QuantityControl';
import StockItemDialog, { STOCK_ITEM_VARIANTS } from './StockItemDialog';

const ALL_LOCATIONS = 'all';

const matchesSearch = (part, term) => {
  if (!term) return true;
  const haystack = [part.name, part.partNumber, part.vehicleMake, part.vehicleModel, part.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
};

function SharedPartsSection({ currentLocation }) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState(ALL_LOCATIONS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    const partsQuery = query(collection(firestore, SHARED_PARTS_COLLECTION), orderBy('vehicleMake'));

    const unsubscribe = onSnapshot(
      partsQuery,
      (snapshot) => {
        setParts(snapshot.docs.map((partDoc) => ({ id: partDoc.id, ...partDoc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load shared parts:', error);
        setActionMessage('Could not load shared parts. Please refresh.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const summary = useMemo(() => {
    return parts.reduce(
      (acc, part) => {
        const quantity = toNumber(part.quantity);
        if (quantity <= 0) return acc;

        acc.total += 1;
        if (part.location === LOCATION_KEYS.MAIN) acc.main += 1;
        if (part.location === LOCATION_KEYS.ENNIS) acc.ennis += 1;
        return acc;
      },
      { total: 0, main: 0, ennis: 0 }
    );
  }, [parts]);

  const visibleParts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return parts.filter((part) => (
      matchesSearch(part, term)
      && (locationFilter === ALL_LOCATIONS || part.location === locationFilter)
    ));
  }, [parts, search, locationFilter]);

  const openAddDialog = () => {
    setEditingPart(null);
    setDialogOpen(true);
  };

  const openEditDialog = (part) => {
    setEditingPart(part);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPart(null);
  };

  const handleSave = async (payload, id) => {
    await saveStockItem(SHARED_PARTS_COLLECTION, id, payload);
    setActionMessage(id ? `${payload.name} updated.` : `${payload.name} added.`);
    closeDialog();
  };

  const handleAdjust = async (part, delta) => {
    try {
      setBusyId(part.id);
      await adjustStockQuantity(SHARED_PARTS_COLLECTION, part.id, delta);
    } catch (error) {
      console.error('Failed to adjust quantity:', error);
      setActionMessage(`Could not update ${part.name}. Please try again.`);
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (part) => {
    const confirmed = window.confirm(`Delete ${part.name} from shared parts?`);
    if (!confirmed) return;

    try {
      setBusyId(part.id);
      await deleteStockItem(SHARED_PARTS_COLLECTION, part.id);
      setActionMessage(`${part.name} deleted.`);
    } catch (error) {
      console.error('Failed to delete shared part:', error);
      setActionMessage(`Could not delete ${part.name}. Please try again.`);
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <Grid container spacing={2} className="stock-summary-grid">
        <Grid item xs={12} sm={4}>
          <Box className="stock-summary-item">
            <Typography className="stock-summary-label">Parts Available</Typography>
            <Typography className="stock-summary-value">{summary.total}</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Box className="stock-summary-item">
            <Typography className="stock-summary-label">In {getLocationLabel(LOCATION_KEYS.MAIN)}</Typography>
            <Typography className="stock-summary-value">{summary.main}</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Box className="stock-summary-item">
            <Typography className="stock-summary-label">In {getLocationLabel(LOCATION_KEYS.ENNIS)}</Typography>
            <Typography className="stock-summary-value">{summary.ennis}</Typography>
          </Box>
        </Grid>
      </Grid>

      <Card className="stock-surface-card stock-table-card">
        <CardContent>
          <Box className="stock-table-header">
            <Box>
              <Typography variant="h6" className="stock-section-title">
                Shared Parts
              </Typography>
            </Box>
            <Box className="stock-toolbar">
              <TextField
                select
                size="small"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="stock-location-filter"
              >
                <MenuItem value={ALL_LOCATIONS}>Both garages</MenuItem>
                {LOCATION_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label} only</MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                placeholder="Search part, make, model, part no."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="stock-search-field"
              />
              <Button variant="contained" onClick={openAddDialog} className="stock-primary-btn">
                <FaPlus className="stock-btn-icon" />
                Add Part
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
                  <TableCell>Part</TableCell>
                  <TableCell>Part No.</TableCell>
                  <TableCell>Make</TableCell>
                  <TableCell>Model</TableCell>
                  <TableCell>Garage</TableCell>
                  <TableCell align="center">Quantity</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={9} className="stock-empty-cell">Loading shared parts...</TableCell>
                  </TableRow>
                )}
                {!loading && visibleParts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="stock-empty-cell">
                      {parts.length === 0
                        ? 'No shared parts recorded yet. Add the first one so both garages can see it.'
                        : 'Nothing matches the current search or filter.'}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && visibleParts.map((part) => {
                  const isBusy = busyId === part.id;
                  const isUsedUp = toNumber(part.quantity) <= 0;
                  const isHere = part.location === currentLocation;

                  return (
                    <TableRow key={part.id} className={`stock-table-row${isUsedUp ? ' stock-table-row--out' : ''}`}>
                      <TableCell className="stock-item-name">{part.name}</TableCell>
                      <TableCell>{part.partNumber || '-'}</TableCell>
                      <TableCell>{part.vehicleMake || '-'}</TableCell>
                      <TableCell>{part.vehicleModel || '-'}</TableCell>
                      <TableCell>
                        <span className={`stock-location-chip stock-location-chip--${part.location}${isHere ? ' stock-location-chip--here' : ''}`}>
                          {getLocationLabel(part.location)}
                        </span>
                      </TableCell>
                      <TableCell align="center">
                        <QuantityControl
                          quantity={toNumber(part.quantity)}
                          onIncrement={() => handleAdjust(part, 1)}
                          onDecrement={() => handleAdjust(part, -1)}
                          disabled={isBusy}
                        />
                      </TableCell>
                      <TableCell align="right">{toNumber(part.price) > 0 ? formatCurrency(part.price) : '-'}</TableCell>
                      <TableCell className="stock-notes-cell">{part.notes || '-'}</TableCell>
                      <TableCell align="center">
                        <Box className="stock-row-actions">
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => openEditDialog(part)}
                            className="stock-secondary-btn"
                            disabled={isBusy}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => handleDelete(part)}
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
        variant={STOCK_ITEM_VARIANTS.SHARED}
        item={editingPart}
        defaultLocation={currentLocation}
        onSave={handleSave}
        onClose={closeDialog}
      />
    </>
  );
}

export default SharedPartsSection;
