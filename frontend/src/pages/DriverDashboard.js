import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { AuthContext } from '../utils/AuthContext';
import API from '../utils/api';

const DriverDashboard = () => {
  const { user, token } = useContext(AuthContext);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [lastLocationUpdatedAt, setLastLocationUpdatedAt] = useState(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [incomingOffers, setIncomingOffers] = useState([]);
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [respondingOfferId, setRespondingOfferId] = useState('');
  const [autoSyncStatus, setAutoSyncStatus] = useState('idle');
  const socketRef = useRef(null);

  const fetchDriverProfile = useCallback(async () => {
    if (!user?.phone) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API.DRIVER_SERVICE}/drivers`, {
        params: { t: Date.now() },
        headers: { Authorization: `Bearer ${token}` }
      });

      const matched = response.data?.drivers?.find((d) => d.phone === user.phone);
      setDriver(matched || null);
      if (matched?.updatedAt) {
        setLastLocationUpdatedAt(new Date(matched.updatedAt));
      }
      if (!matched) {
        setError('Driver profile not found. Please contact admin or re-register as driver.');
      }
    } catch (err) {
      setError('Failed to load driver profile');
    } finally {
      setLoading(false);
    }
  }, [user?.phone, token]);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    await fetchDriverProfile();
  }, [fetchDriverProfile]);

  useEffect(() => {
    fetchDriverProfile();
  }, [fetchDriverProfile]);

  useEffect(() => {
    if (!driver?.driverId) {
      return undefined;
    }

    const socket = io(API.DRIVER_SERVICE, { transports: ['websocket'] });
    socketRef.current = socket;
    setSocketStatus('connecting');

    socket.on('connect', () => {
      setSocketStatus('connected');
      socket.emit('driver:register', { driverId: driver.driverId });
    });

    socket.on('driver:registered', () => {
      setSocketStatus('ready');
    });

    socket.on('disconnect', () => {
      setSocketStatus('disconnected');
    });

    socket.on('driver:offer', (offer) => {
      setIncomingOffers((prev) => {
        if (prev.some((item) => item.offerId === offer.offerId)) {
          return prev;
        }
        return [offer, ...prev];
      });
    });

    socket.on('driver:offer-expired', ({ offerId }) => {
      setIncomingOffers((prev) => prev.filter((offer) => offer.offerId !== offerId));
    });

    socket.on('driver:offer-accepted', ({ offerId }) => {
      setIncomingOffers((prev) => prev.filter((offer) => offer.offerId !== offerId));
      refreshProfile();
    });

    socket.on('driver:offer-rejected', ({ offerId }) => {
      setIncomingOffers((prev) => prev.filter((offer) => offer.offerId !== offerId));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [driver?.driverId, refreshProfile]);

  useEffect(() => {
    if (!driver?.driverId) {
      return undefined;
    }

    const syncPendingOffers = async () => {
      try {
        const response = await axios.get(
          `${API.DRIVER_SERVICE}/drivers/offers/pending/${driver.driverId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const pending = response.data?.offers || [];
        if (!Array.isArray(pending) || pending.length === 0) {
          return;
        }

        setIncomingOffers((prev) => {
          const existing = new Set(prev.map((item) => item.offerId));
          const merged = [...prev];
          pending.forEach((offer) => {
            if (!existing.has(offer.offerId)) {
              merged.unshift(offer);
            }
          });
          return merged;
        });
      } catch (pollError) {
        // Silent fallback polling
      }
    };

    syncPendingOffers();
    const interval = setInterval(syncPendingOffers, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [driver?.driverId, token]);

  const toggleAvailability = async () => {
    if (!driver?.driverId) return;
    setUpdatingStatus(true);
    setError('');
    try {
      const response = await axios.patch(
        `${API.DRIVER_SERVICE}/drivers/${driver.driverId}/availability`,
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

  const getCurrentLocationWithRetry = (retryCount = 1) => new Promise((resolve, reject) => {
    const tryGetLocation = (remainingRetries) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        },
        (geoError) => {
          if (remainingRetries > 0) {
            setTimeout(() => tryGetLocation(remainingRetries - 1), 1500);
          } else {
            reject(geoError);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };
    tryGetLocation(retryCount);
  });

  const updateLocation = useCallback(async ({ silent = false, withRetry = true } = {}) => {
    if (!driver?.driverId) return;
    if (!navigator.geolocation) {
      if (!silent) setError('Geolocation is not supported in this browser.');
      return;
    }
    setUpdatingLocation(true);
    if (!silent) setError('');
    try {
      const location = await getCurrentLocationWithRetry(withRetry ? 1 : 0);
      const response = await axios.patch(
        `${API.DRIVER_SERVICE}/drivers/${driver.driverId}/location`,
        { latitude: location.latitude, longitude: location.longitude },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDriver(response.data.driver);
      setLastLocationUpdatedAt(new Date());
      if (silent) setAutoSyncStatus('updated');
    } catch (err) {
      if (silent) {
        setAutoSyncStatus('failed');
      } else {
        setError('Location permission denied or unavailable. Please enable location access.');
      }
    } finally {
      setUpdatingLocation(false);
    }
  }, [driver?.driverId, token]);

  useEffect(() => {
    if (!driver?.driverId || !driver.isAvailable || !autoSyncEnabled) return undefined;
    setAutoSyncStatus('active');
    const interval = setInterval(() => {
      updateLocation({ silent: true, withRetry: true });
    }, 30000);
    return () => {
      clearInterval(interval);
      setAutoSyncStatus('idle');
    };
  }, [driver?.driverId, driver?.isAvailable, autoSyncEnabled, updateLocation]);

  const respondToOffer = async (offerId, action) => {
    if (!driver?.driverId) return;
    setRespondingOfferId(offerId);
    setError('');
    try {
      const endpoint = action === 'accept'
        ? `${API.DRIVER_SERVICE}/drivers/offers/${offerId}/accept`
        : `${API.DRIVER_SERVICE}/drivers/offers/${offerId}/reject`;

      const response = await axios.post(
        endpoint,
        { driverId: driver.driverId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIncomingOffers((prev) => prev.filter((offer) => offer.offerId !== offerId));
      if (action === 'accept') setDriver((prev) => ({ ...prev, isAvailable: false }));
      if (response.data?.driver) setDriver(response.data.driver);
    } catch (err) {
      setError(err.response?.data?.message || `Could not ${action} request`);
    } finally {
      setRespondingOfferId('');
    }
  };

  if (loading) return <div style={styles.container}>Loading driver dashboard...</div>;

  const currentLatitude = driver?.currentLocation?.latitude ?? 'N/A';
  const currentLongitude = driver?.currentLocation?.longitude ?? 'N/A';

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Driver Dashboard</h1>
      {error && <div style={styles.error}>{error}</div>}
      <div style={styles.statusBar}>
        <span><strong>Socket:</strong> {socketStatus}</span>
        <span><strong>Pending Requests:</strong> {incomingOffers.length}</span>
      </div>
      {!driver ? (
        <div style={styles.card}>No driver data available.</div>
      ) : (
        <>
          <div style={styles.card}>
            <h2 style={styles.heading}>Quick Overview</h2>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}><span style={styles.statLabel}>Current Status</span><span style={styles.statValue}>{driver.isAvailable ? 'Online' : 'On Delivery'}</span></div>
              <div style={styles.statCard}><span style={styles.statLabel}>Rating</span><span style={styles.statValue}>{driver.rating?.toFixed(1)}</span></div>
              <div style={styles.statCard}><span style={styles.statLabel}>Deliveries</span><span style={styles.statValue}>{driver.totalDeliveries || 0}</span></div>
              <div style={styles.statCard}><span style={styles.statLabel}>Vehicle</span><span style={styles.statValue}>{driver.vehicleType?.toUpperCase()}</span></div>
            </div>
            <div style={styles.profileGrid}>
              <p><strong>Name:</strong> {driver.name}</p>
              <p><strong>Phone:</strong> {driver.phone}</p>
              <p><strong>Driver ID:</strong> {driver.driverId}</p>
              <p><strong>Current Location:</strong> {currentLatitude}, {currentLongitude}</p>
            </div>
            <div style={styles.actionRow}>
              <button onClick={toggleAvailability} disabled={updatingStatus} style={{ ...styles.button, backgroundColor: driver.isAvailable ? '#d84315' : '#2e7d32' }}>
                {updatingStatus ? 'Updating...' : driver.isAvailable ? 'Go Offline' : 'Go Online'}
              </button>
              <button onClick={refreshProfile} style={styles.secondaryButton}>Refresh Profile</button>
            </div>
          </div>
          <div style={styles.card}>
            <h2 style={styles.heading}>Update Live Location</h2>
            <div style={styles.form}>
              <p style={styles.driverHint}>Use your device GPS to sync live location automatically.</p>
              {lastLocationUpdatedAt && (<p style={styles.metaText}><strong>Last Updated:</strong> {lastLocationUpdatedAt.toLocaleTimeString()}</p>)}
              <label style={styles.toggleRow}>
                <input type="checkbox" checked={autoSyncEnabled} onChange={(e) => setAutoSyncEnabled(e.target.checked)} />
                <span>Auto sync every 30 seconds while Online</span>
              </label>
              <p style={styles.metaText}><strong>Auto Sync:</strong> {autoSyncStatus}</p>
              <button type="button" onClick={updateLocation} disabled={updatingLocation} style={styles.button}>
                {updatingLocation ? 'Fetching GPS...' : 'Use Current Location'}
              </button>
            </div>
          </div>
          <div style={styles.card}>
            <h2 style={styles.heading}>Incoming Booking Requests</h2>
            {incomingOffers.length === 0 ? (
              <p style={styles.driverHint}>No new booking requests right now.</p>
            ) : (
              <div style={styles.offerList}>
                {incomingOffers.map((offer) => (
                  <div key={offer.offerId} style={styles.offerCard}>
                    <div style={styles.offerHeader}>
                      <strong>{offer.pickup?.name || 'Pickup'} → {offer.drop?.name || 'Drop'}</strong>
                      <span>{offer.vehicleType?.toUpperCase()}</span>
                    </div>
                    <p><strong>Booking ID:</strong> {offer.bookingId}</p>
                    <p><strong>Service:</strong> {offer.serviceType}</p>
                    <p><strong>Weight:</strong> {offer.parcelWeightKg} kg</p>
                    <p><strong>Fare:</strong> ₹{offer.fareBreakdown?.totalFare}</p>
                    <div style={styles.offerActions}>
                      <button onClick={() => respondToOffer(offer.offerId, 'accept')} disabled={respondingOfferId === offer.offerId} style={styles.acceptButton}>
                        {respondingOfferId === offer.offerId ? 'Processing...' : 'Accept'}
                      </button>
                      <button onClick={() => respondToOffer(offer.offerId, 'reject')} disabled={respondingOfferId === offer.offerId} style={styles.rejectButton}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const styles = {
  container: { maxWidth: '900px', margin: '0 auto', padding: '20px' },
  title: { color: '#FF6B35', marginBottom: '18px' },
  statusBar: { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '12px 16px', backgroundColor: '#fff8f4', border: '1px solid #ffd8c5', borderRadius: '10px', marginBottom: '16px', color: '#7c2d12' },
  card: { backgroundColor: 'white', borderRadius: '8px', padding: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: '16px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' },
  statCard: { backgroundColor: '#fff8f4', border: '1px solid #ffd8c5', borderRadius: '8px', padding: '14px' },
  statLabel: { display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '6px' },
  statValue: { fontSize: '18px', fontWeight: 700, color: '#222' },
  profileGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px 18px' },
  actionRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '14px' },
  heading: { marginTop: 0, color: '#222' },
  button: { marginTop: '12px', color: 'white', border: 'none', borderRadius: '4px', padding: '10px 14px', cursor: 'pointer', backgroundColor: '#FF6B35' },
  secondaryButton: { marginTop: '12px', backgroundColor: '#111827', color: 'white', border: 'none', borderRadius: '4px', padding: '10px 14px', cursor: 'pointer' },
  form: { display: 'grid', gap: '12px', maxWidth: '420px' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontWeight: 600 },
  metaText: { margin: 0, color: '#4b5563', fontSize: '13px' },
  offerList: { display: 'grid', gap: '12px' },
  offerCard: { border: '1px solid #fde2d2', borderRadius: '10px', padding: '14px', backgroundColor: '#fffdfb' },
  offerHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '8px' },
  offerActions: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' },
  acceptButton: { backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 14px', cursor: 'pointer' },
  rejectButton: { backgroundColor: '#b91c1c', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 14px', cursor: 'pointer' },
  error: { backgroundColor: '#ffe6e6', color: '#b71c1c', padding: '10px', borderRadius: '4px', marginBottom: '14px' },
  driverHint: { margin: 0, color: '#666' }
};

export default DriverDashboard;