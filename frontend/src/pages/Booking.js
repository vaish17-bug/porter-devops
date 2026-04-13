import React, { useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../utils/AuthContext';
import LocationAutocomplete from '../components/LocationAutocomplete';

const Booking = () => {
  const { user, token } = useContext(AuthContext);
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bookings, setBookings] = useState([]);

  const fetchUserBookings = useCallback(async () => {
    try {
      const response = await axios.get(
        `http://localhost:5002/bookings/user/${user?.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBookings(response.data.bookings);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    }
  }, [user?.id, token]);

  useEffect(() => {
    fetchUserBookings();
  }, [fetchUserBookings]);

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!pickup || !drop) {
      setError('Please select both pickup and drop locations from suggestions.');
      setLoading(false);
      return;
    }

    try {
      await axios.post(
        'http://localhost:5002/bookings',
        {
          userId: user?.id,
          pickup,
          drop
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Booking created successfully!');
      setPickup(null);
      setDrop(null);
      fetchUserBookings();
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📦 Create Booking</h1>
      
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <form onSubmit={handleCreateBooking} style={styles.form}>
        <div style={styles.section}>
          <h3>Pickup Location</h3>
          <LocationAutocomplete
            label="Pickup Address"
            placeholder="Search pickup location (e.g. IGI Airport Delhi)"
            onSelectLocation={setPickup}
          />
          {pickup && (
            <p style={styles.meta}>
              Selected: {pickup.latitude.toFixed(4)}, {pickup.longitude.toFixed(4)}
            </p>
          )}
        </div>

        <div style={styles.section}>
          <h3>Drop Location</h3>
          <LocationAutocomplete
            label="Drop Address"
            placeholder="Search destination (e.g. Connaught Place)"
            onSelectLocation={setDrop}
          />
          {drop && (
            <p style={styles.meta}>
              Selected: {drop.latitude.toFixed(4)}, {drop.longitude.toFixed(4)}
            </p>
          )}
        </div>

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Creating...' : 'Create Booking'}
        </button>
      </form>

      <div style={styles.bookingsSection}>
        <h2>Your Bookings</h2>
        {bookings.length === 0 ? (
          <p>No bookings yet</p>
        ) : (
          <div>
            {bookings.map((b) => (
              <div key={b._id} style={styles.bookingCard}>
                <p><strong>ID:</strong> {b.bookingId}</p>
                <p><strong>From:</strong> {b.pickup?.name}</p>
                <p><strong>To:</strong> {b.drop?.name}</p>
                <p><strong>Status:</strong> {b.status}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '20px', maxWidth: '800px', margin: '0 auto' },
  title: { color: '#FF6B35', textAlign: 'center' },
  form: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' },
  section: { marginBottom: '20px' },
  meta: { marginTop: '8px', marginBottom: '0', color: '#666', fontSize: '13px' },
  input: { width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' },
  button: { width: '100%', padding: '10px', backgroundColor: '#FF6B35', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  error: { backgroundColor: '#ffe6e6', color: 'red', padding: '10px', borderRadius: '4px', marginBottom: '15px' },
  success: { backgroundColor: '#e6ffe6', color: 'green', padding: '10px', borderRadius: '4px', marginBottom: '15px' },
  bookingsSection: { marginTop: '30px' },
  bookingCard: { backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '10px', borderLeft: '4px solid #FF6B35' }
};

export default Booking;
