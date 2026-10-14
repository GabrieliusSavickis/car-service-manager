import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import {
  describeReg,
  expandToFullGroups,
  moveAppointmentsToAccount,
  normalizeVehicleReg,
} from '../../utils/accountMaintenance';

const MAX_SUGGESTIONS = 8;

function MoveAppointmentsDialog({
  open,
  sourceAccount,
  accounts,
  appointmentsToMove,
  allAppointmentsForAccount,
  appointmentsCollectionName,
  onMoved,
  onClose,
}) {
  const [search, setSearch] = useState('');
  const [targetAccount, setTargetAccount] = useState(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      // Pre-fill with the source reg so the likely duplicate is the first thing listed.
      setSearch(normalizeVehicleReg(sourceAccount?.id || ''));
      setTargetAccount(null);
      setError('');
    }
  }, [open, sourceAccount]);

  // Pull in sibling segments so a split job never lands half on each account.
  const expandedAppointments = useMemo(() => (
    expandToFullGroups(appointmentsToMove || [], allAppointmentsForAccount || [])
  ), [appointmentsToMove, allAppointmentsForAccount]);

  const addedSegmentCount = expandedAppointments.length - (appointmentsToMove || []).length;

  // Match on the squashed reg so hyphens and spaces do not hide the match, but
  // always select by document id so two near-identical regs stay distinct.
  const suggestions = useMemo(() => {
    const term = normalizeVehicleReg(search);
    return (accounts || [])
      .filter((account) => account.id !== sourceAccount?.id)
      .filter((account) => {
        if (!term) return true;
        const haystack = [account.id, account.vehicleReg, account.customerName, account.customerPhone]
          .filter(Boolean)
          .map((value) => normalizeVehicleReg(value))
          .join(' ');
        return haystack.includes(term);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [accounts, search, sourceAccount]);

  const handleMove = async () => {
    if (!targetAccount) return;

    try {
      setMoving(true);
      setError('');

      const { movedCount, missing } = await moveAppointmentsToAccount({
        appointmentsCollectionName,
        appointments: expandedAppointments,
        targetAccount,
      });

      onMoved(movedCount, targetAccount, missing);
    } catch (moveError) {
      console.error('Failed to move appointments:', moveError);
      setError(moveError?.message || 'Could not move the appointments.');
    } finally {
      setMoving(false);
    }
  };

  const movingLabel = expandedAppointments.length === 1
    ? '1 appointment'
    : `${expandedAppointments.length} appointments`;

  return (
    <Dialog
      open={open}
      onClose={moving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      className="accounts-modal"
    >
      <DialogTitle className="accounts-modal-title">Move Appointments</DialogTitle>
      <DialogContent dividers className="accounts-modal-content">
        <Typography variant="body2" sx={{ mb: 2 }}>
          Moving <strong>{movingLabel}</strong> off{' '}
          <span className="accounts-reg-chip">{sourceAccount?.id}</span>
        </Typography>

        {addedSegmentCount > 0 && (
          <Typography variant="body2" className="accounts-move-note" sx={{ mb: 2 }}>
            This includes {addedSegmentCount} extra {addedSegmentCount === 1 ? 'day' : 'days'} from
            {addedSegmentCount === 1 ? ' a multi-day job' : ' multi-day jobs'}, so no job is split
            between two accounts.
          </Typography>
        )}

        <Typography className="accounts-filter-label" sx={{ mb: 0.5 }}>
          Move To
        </Typography>
        <TextField
          fullWidth
          size="small"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setTargetAccount(null);
          }}
          placeholder="Search reg, name or phone"
          disabled={moving}
        />

        <Typography variant="body2" className="accounts-move-note" sx={{ mt: 1 }}>
          Pick the account from the list. Two regs can look identical but differ by a
          space, so choose rather than type.
        </Typography>

        <Box className="accounts-target-list">
          {suggestions.length === 0 && (
            <Typography variant="body2" className="accounts-move-warning">
              No other accounts match that search.
            </Typography>
          )}
          {suggestions.map((account) => {
            const isSelected = targetAccount?.id === account.id;
            const hasWhitespace = /\s/.test(account.id);

            return (
              <Box
                key={account.id}
                className={`accounts-target-option${isSelected ? ' accounts-target-option--selected' : ''}`}
                onClick={() => !moving && setTargetAccount(account)}
              >
                <Box>
                  <span className="accounts-reg-chip">{account.id}</span>
                  {hasWhitespace && (
                    <span className="accounts-reg-flag">{describeReg(account.id).replace(account.id, '').trim()}</span>
                  )}
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {account.customerName || 'No name on file'}
                    {account.customerPhone ? ` - ${account.customerPhone}` : ''}
                    {account.vehicleMake ? ` - ${account.vehicleMake}` : ''}
                  </Typography>
                </Box>
                {isSelected && <span className="accounts-target-tick">Selected</span>}
              </Box>
            );
          })}
        </Box>

        {error && (
          <Typography variant="body2" className="accounts-move-error" sx={{ mt: 2 }}>{error}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined" className="accounts-cancel-btn" disabled={moving}>
          Cancel
        </Button>
        <Button
          onClick={handleMove}
          variant="contained"
          className="accounts-primary-btn"
          disabled={!targetAccount || moving}
        >
          {moving ? 'Moving...' : `Move ${movingLabel}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MoveAppointmentsDialog;
