import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { AuthContext } from '../utils/AuthContext';

const DriverDashboard = () => {
  const { user, token } = useContext(AuthContext);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchDriverProfile = async () => {
    if (!user?.phone) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get('http://localhost:5003/drivers', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const matched = response.data?.drivers?.find((d) => d.phone === user.phone);
      setDriver(matched || null);
      if (!matched) {
        setError('Driver profile not found. Please contact admin or re-register as driver.');
      }
    } catch (err) {
      setError('Failed to load driver profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverProfile();
  }, [user?.phone]);

  const toggleAvailability = async () => {
    if (!driver?.driverId) {
      return;
    }

    setUpdatingStatus(true);
    setError('');

    try {
      const response = await axios.patch(
        `http://localhost:5003/drivers/${driver.driverId}/availability`,
        { isAvailable: !driver.isAvailable },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDriver(response.data.driver);
    } catch (err) {
      setError('Could not update availability');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return <div style={styles.container}>Loading driver dashboard...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Driver Dashboard</h1>
      {error && <div style={styles.error}>{error}</div>}

      {!driver ? (
        <div style={styles.card}>No driver data available.</div>
      ) : (
        <>
          <div style={styles.card}>
            <h2 style={styles.heading}>Profile</h2>
            <p><strong>Name:</strong> {driver.name}</p>
            <p><strong>Phone:</strong> {driver.phone}</p>
            <p><strong>Vehicle:</strong> {driver.vehicleType?.toUpperCase()}</p>
            <p><strong>Rating:</strong> {driver.rating?.toFixed(1)}</p>
            <p><strong>Total Deliveries:</strong> {driver.totalDeliveries || 0}</p>
            <p><strong>Current Status:</strong> {driver.isAvailable ? 'Online' : 'On Delivery'}</p>

            <button
              onClick={toggleAvailability}
              disabled={updatingStatus}
              style={{
                ...styles.button,
                backgroundColor: driver.isAvailable ? '#d84315' : '#2e7d32'
              }}
            >
              {updatingStatus
                ? 'Updating...'
                : driver.isAvailable
                  ? 'Go Offline'
                  : 'Go Online'}
            </button>
          </div>

          <div style={styles.card}>
            <h2 style={styles.heading}>What to Add Next (Real Driver App)</h2>
            <ul style={styles.list}>
              <li>Incoming order requests with Accept/Reject</li>
              <li>Navigation button (open in Google Maps)</li>
              <li>OTP verification at pickup and delivery</li>
              <li>Earnings summary (today/weekly)</li>
              <li>Break mode and online/offline toggle by schedule</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px'
  },
  title: {
    color: '#FF6B35',
    marginBottom: '18px'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '18px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    marginBottom: '16px'
  },
  heading: {
    marginTop: 0,
    color: '#222'
  },
  button: {
    marginTop: '12px',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 14px',
    cursor: 'pointer'
  },
  error: {
    backgroundColor: '#ffe6e6',
    color: '#b71c1c',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '14px'
  },
  list: {
    margin: 0,
    paddingLeft: '18px',
    lineHeight: 1.6
  }
};

export default DriverDashboard;
