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
  expandToFullGroups,
  findAccountByReg,
  moveAppointmentsToAccount,
  normalizeVehicleReg,
} from '../../utils/accountMaintenance';

function MoveAppointmentsDialog({
  open,
  sourceReg,
  appointmentsToMove,
  allAppointmentsForReg,
  accountsCollectionName,
  appointmentsCollectionName,
  onMoved,
  onClose,
}) {
  const [targetRegInput, setTargetRegInput] = useState('');
  const [targetAccount, setTargetAccount] = useState(null);
  const [lookupMessage, setLookupMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTargetRegInput('');
      setTargetAccount(null);
      setLookupMessage('');
      setError('');
    }
  }, [open]);

  // Pull in sibling segments so a split job never lands half on each account.
  const expandedAppointments = useMemo(() => (
    expandToFullGroups(appointmentsToMove || [], allAppointmentsForReg || [])
  ), [appointmentsToMove, allAppointmentsForReg]);

  const addedSegmentCount = expandedAppointments.length - (appointmentsToMove || []).length;

  const handleCheckTarget = async () => {
    const normalizedReg = normalizeVehicleReg(targetRegInput);
    setTargetAccount(null);
    setError('');

    if (!normalizedReg) {
      setLookupMessage('Enter a registration to move these to.');
      return;
    }

    if (normalizedReg === normalizeVehicleReg(sourceReg)) {
      setLookupMessage('That is the same account these are already on.');
      return;
    }

    try {
      setChecking(true);
      const account = await findAccountByReg(accountsCollectionName, normalizedReg);

      if (!account) {
        setLookupMessage(`No account found for ${normalizedReg}. Check the registration.`);
        return;
      }

      setTargetAccount(account);
      setLookupMessage('');
    } catch (lookupError) {
      console.error('Failed to look up account:', lookupError);
      setLookupMessage('Could not check that registration. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleMove = async () => {
    if (!targetAccount) return;

    try {
      setMoving(true);
      setError('');

      const movedCount = await moveAppointmentsToAccount({
        appointmentsCollectionName,
        appointments: expandedAppointments,
        targetAccount,
      });

      onMoved(movedCount, targetAccount);
    } catch (moveError) {
      console.error('Failed to move appointments:', moveError);
      setError('Could not move the appointments. Nothing was changed.');
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
      maxWidth="xs"
      fullWidth
      className="accounts-modal"
    >
      <DialogTitle className="accounts-modal-title">Move Appointments</DialogTitle>
      <DialogContent dividers className="accounts-modal-content">
        <Typography variant="body2" sx={{ mb: 2 }}>
          Moving <strong>{movingLabel}</strong> off <strong>{sourceReg}</strong>.
        </Typography>

        {addedSegmentCount > 0 && (
          <Typography variant="body2" className="accounts-move-note" sx={{ mb: 2 }}>
            This includes {addedSegmentCount} extra {addedSegmentCount === 1 ? 'day' : 'days'} from
            {addedSegmentCount === 1 ? ' a multi-day job' : ' multi-day jobs'}, so no job is split
            between two accounts.
          </Typography>
        )}

        <Box sx={{ mb: 1 }}>
          <Typography className="accounts-filter-label" sx={{ mb: 0.5 }}>
            Move To Vehicle Reg
          </Typography>
          <Box className="accounts-move-lookup">
            <TextField
              fullWidth
              size="small"
              value={targetRegInput}
              onChange={(e) => {
                setTargetRegInput(e.target.value.toUpperCase());
                setTargetAccount(null);
                setLookupMessage('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCheckTarget();
                }
              }}
              placeholder="e.g. 12-KY-1234"
              disabled={moving}
            />
            <Button
              variant="outlined"
              onClick={handleCheckTarget}
              className="accounts-cancel-btn"
              disabled={checking || moving}
            >
              {checking ? 'Checking...' : 'Check'}
            </Button>
          </Box>
        </Box>

        {lookupMessage && (
          <Typography variant="body2" className="accounts-move-warning">{lookupMessage}</Typography>
        )}

        {targetAccount && (
          <Box className="accounts-move-target">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {targetAccount.vehicleReg || targetAccount.id}
            </Typography>
            <Typography variant="body2">
              {targetAccount.customerName || 'No name on file'}
              {targetAccount.customerPhone ? ` - ${targetAccount.customerPhone}` : ''}
            </Typography>
            {targetAccount.vehicleMake && (
              <Typography variant="body2">{targetAccount.vehicleMake}</Typography>
            )}
            <Typography variant="body2" sx={{ mt: 1 }}>
              Check this is the right customer before moving.
            </Typography>
          </Box>
        )}

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
