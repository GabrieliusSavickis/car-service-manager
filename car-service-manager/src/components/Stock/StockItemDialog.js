import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { LOCATION_OPTIONS } from '../../utils/location';
import { DEFAULT_LOW_STOCK_THRESHOLD, toNumber } from '../../utils/stock';

export const STOCK_ITEM_VARIANTS = {
  CONSUMABLE: 'consumable',
  SHARED: 'shared',
};

const isBlank = (value) => value === undefined || value === null;

const buildInitialValues = (variant, item, defaultLocation) => ({
  name: item?.name || '',
  partNumber: item?.partNumber || '',
  supplier: item?.supplier || '',
  vehicleMake: item?.vehicleMake || '',
  vehicleModel: item?.vehicleModel || '',
  costPrice: isBlank(item?.costPrice) ? '' : String(item.costPrice),
  price: isBlank(item?.price) ? '' : String(item.price),
  quantity: isBlank(item?.quantity)
    ? (variant === STOCK_ITEM_VARIANTS.SHARED ? '1' : '0')
    : String(item.quantity),
  lowStockThreshold: isBlank(item?.lowStockThreshold)
    ? String(DEFAULT_LOW_STOCK_THRESHOLD)
    : String(item.lowStockThreshold),
  location: item?.location || defaultLocation,
  notes: item?.notes || '',
});

const isWholeNumber = (value) => /^\d+$/.test(String(value).trim());

const validate = (variant, values) => {
  const errors = {};
  const isShared = variant === STOCK_ITEM_VARIANTS.SHARED;

  if (!values.name.trim()) {
    errors.name = 'Name is required';
  }

  if (isShared && !values.vehicleMake.trim()) {
    errors.vehicleMake = 'Car make is required';
  }

  if (values.price.trim() === '') {
    if (!isShared) errors.price = 'Sell price is required';
  } else if (!Number.isFinite(Number(values.price)) || Number(values.price) < 0) {
    errors.price = 'Enter a price of 0 or more';
  }

  if (!isShared) {
    if (values.costPrice.trim() === '') {
      errors.costPrice = 'Cost is required';
    } else if (!Number.isFinite(Number(values.costPrice)) || Number(values.costPrice) < 0) {
      errors.costPrice = 'Enter a cost of 0 or more';
    }
  }

  if (!isWholeNumber(values.quantity)) {
    errors.quantity = 'Enter a whole number';
  }

  if (!isShared && !isWholeNumber(values.lowStockThreshold)) {
    errors.lowStockThreshold = 'Enter a whole number';
  }

  if (isShared && !values.location) {
    errors.location = 'Choose a garage';
  }

  return errors;
};

const toPayload = (variant, values) => {
  const base = {
    name: values.name.trim(),
    partNumber: values.partNumber.trim(),
    price: values.price.trim() === '' ? 0 : toNumber(values.price),
    quantity: toNumber(values.quantity),
  };

  if (variant === STOCK_ITEM_VARIANTS.CONSUMABLE) {
    return {
      ...base,
      supplier: values.supplier.trim(),
      costPrice: toNumber(values.costPrice),
      lowStockThreshold: toNumber(values.lowStockThreshold),
    };
  }

  return {
    ...base,
    vehicleMake: values.vehicleMake.trim(),
    vehicleModel: values.vehicleModel.trim(),
    location: values.location,
    notes: values.notes.trim(),
  };
};

function StockItemDialog({ open, variant, item, defaultLocation, onSave, onClose }) {
  const [values, setValues] = useState(() => buildInitialValues(variant, item, defaultLocation));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (open) {
      setValues(buildInitialValues(variant, item, defaultLocation));
      setErrors({});
      setSaveError('');
    }
  }, [open, variant, item, defaultLocation]);

  const isEditing = Boolean(item?.id);
  const isShared = variant === STOCK_ITEM_VARIANTS.SHARED;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = validate(variant, values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setSaving(true);
      setSaveError('');
      await onSave(toPayload(variant, values), item?.id || null);
    } catch (error) {
      console.error('Failed to save stock item:', error);
      setSaveError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const title = isShared
    ? (isEditing ? 'Edit Shared Part' : 'Add Shared Part')
    : (isEditing ? 'Edit Stock Item' : 'Add Stock Item');

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth className="stock-modal">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle className="stock-modal-title">{title}</DialogTitle>
        <DialogContent dividers className="stock-modal-content">
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography className="stock-field-label">Name</Typography>
              <TextField
                fullWidth
                name="name"
                value={values.name}
                onChange={handleChange}
                size="small"
                autoFocus
                placeholder={isShared ? 'e.g. Clutch kit' : 'e.g. Oil filter'}
                error={Boolean(errors.name)}
                helperText={errors.name}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography className="stock-field-label">Part Number</Typography>
              <TextField
                fullWidth
                name="partNumber"
                value={values.partNumber}
                onChange={handleChange}
                size="small"
                placeholder="Optional"
              />
            </Grid>

            {isShared ? (
              <>
                <Grid item xs={12} sm={6}>
                  <Typography className="stock-field-label">Car Make</Typography>
                  <TextField
                    fullWidth
                    name="vehicleMake"
                    value={values.vehicleMake}
                    onChange={handleChange}
                    size="small"
                    placeholder="e.g. Volkswagen"
                    error={Boolean(errors.vehicleMake)}
                    helperText={errors.vehicleMake}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography className="stock-field-label">Model</Typography>
                  <TextField
                    fullWidth
                    name="vehicleModel"
                    value={values.vehicleModel}
                    onChange={handleChange}
                    size="small"
                    placeholder="e.g. Golf Mk7 (optional)"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography className="stock-field-label">Garage</Typography>
                  <TextField
                    select
                    fullWidth
                    name="location"
                    value={values.location}
                    onChange={handleChange}
                    size="small"
                    error={Boolean(errors.location)}
                    helperText={errors.location || 'Where the part physically is'}
                  >
                    {LOCATION_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </>
            ) : (
              <Grid item xs={12} sm={6}>
                <Typography className="stock-field-label">Supplier</Typography>
                <TextField
                  fullWidth
                  name="supplier"
                  value={values.supplier}
                  onChange={handleChange}
                  size="small"
                  placeholder="Optional"
                />
              </Grid>
            )}

            {!isShared && (
              <Grid item xs={12} sm={6}>
                <Typography className="stock-field-label">Cost (EUR)</Typography>
                <TextField
                  fullWidth
                  name="costPrice"
                  value={values.costPrice}
                  onChange={handleChange}
                  size="small"
                  inputProps={{ inputMode: 'decimal' }}
                  placeholder="0.00"
                  error={Boolean(errors.costPrice)}
                  helperText={errors.costPrice}
                />
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <Typography className="stock-field-label">{isShared ? 'Price (EUR)' : 'Sell Price (EUR)'}</Typography>
              <TextField
                fullWidth
                name="price"
                value={values.price}
                onChange={handleChange}
                size="small"
                inputProps={{ inputMode: 'decimal' }}
                placeholder={isShared ? 'Optional' : '0.00'}
                error={Boolean(errors.price)}
                helperText={errors.price}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography className="stock-field-label">Quantity</Typography>
              <TextField
                fullWidth
                name="quantity"
                value={values.quantity}
                onChange={handleChange}
                size="small"
                inputProps={{ inputMode: 'numeric' }}
                error={Boolean(errors.quantity)}
                helperText={errors.quantity}
              />
            </Grid>

            {!isShared && (
              <Grid item xs={12} sm={6}>
                <Typography className="stock-field-label">Low Stock Alert At</Typography>
                <TextField
                  fullWidth
                  name="lowStockThreshold"
                  value={values.lowStockThreshold}
                  onChange={handleChange}
                  size="small"
                  inputProps={{ inputMode: 'numeric' }}
                  error={Boolean(errors.lowStockThreshold)}
                  helperText={errors.lowStockThreshold || 'Flagged as low at or below this'}
                />
              </Grid>
            )}

            {isShared && (
              <Grid item xs={12}>
                <Typography className="stock-field-label">Notes</Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  name="notes"
                  value={values.notes}
                  onChange={handleChange}
                  size="small"
                  placeholder="Condition, where it came from, anything useful (optional)"
                />
              </Grid>
            )}
          </Grid>

          {saveError && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" className="stock-form-error">{saveError}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions className="stock-modal-actions">
          <Button onClick={onClose} variant="outlined" className="stock-secondary-btn" disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" className="stock-primary-btn" disabled={saving}>
            {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default StockItemDialog;
