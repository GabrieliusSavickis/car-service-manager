import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Tab, Tabs, Typography } from '@mui/material';
import { FaBoxes, FaWarehouse } from 'react-icons/fa';
import Header from '../components/Header/Header';
import GarageStockSection from '../components/Stock/GarageStockSection';
import SharedPartsSection from '../components/Stock/SharedPartsSection';
import { getLocationKey, getLocationLabel } from '../utils/location';
import { getConsumablesCollectionName } from '../utils/stock';
import './StockPage.css';

const TABS = {
  GARAGE: 'garage',
  SHARED: 'shared',
};

const StockPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TABS.GARAGE);

  const locationKey = useMemo(() => getLocationKey(), []);
  const locationLabel = getLocationLabel(locationKey);
  const consumablesCollectionName = useMemo(() => getConsumablesCollectionName(), []);

  // Stock is admin only, matching the Accounts page
  useEffect(() => {
    const role = sessionStorage.getItem('userRole');
    if (!role || role === 'technician') {
      navigate('/appointments');
    }
  }, [navigate]);

  return (
    <div className="stock-page-shell">
      <Header />
      <Container maxWidth="lg" className="stock-page">
        <Box className="stock-page-header">
          <Box>
            <Typography variant="h5" className="stock-page-title">Stock</Typography>
            <Typography variant="body2" className="stock-page-subtitle">
              You are viewing the {locationLabel} garage.
            </Typography>
          </Box>
          <Tabs
            value={activeTab}
            onChange={(_, nextTab) => setActiveTab(nextTab)}
            className="stock-tabs"
            TabIndicatorProps={{ className: 'stock-tabs-indicator' }}
          >
            <Tab
              value={TABS.GARAGE}
              label="Garage Stock"
              icon={<FaWarehouse />}
              iconPosition="start"
              className="stock-tab"
            />
            <Tab
              value={TABS.SHARED}
              label="Shared Parts"
              icon={<FaBoxes />}
              iconPosition="start"
              className="stock-tab"
            />
          </Tabs>
        </Box>

        {activeTab === TABS.GARAGE && (
          <GarageStockSection
            collectionName={consumablesCollectionName}
            locationLabel={locationLabel}
          />
        )}

        {activeTab === TABS.SHARED && (
          <SharedPartsSection currentLocation={locationKey} />
        )}
      </Container>
    </div>
  );
};

export default StockPage;
