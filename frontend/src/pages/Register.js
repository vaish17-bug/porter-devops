import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [vehicleType, setVehicleType] = useState('bike');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        'http://localhost:5001/auth/register',
        { name, email, phone, password, role, vehicleType }
      );

      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      navigate(user.role === 'driver' ? '/driver' : '/bookings');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🚚 Porter</h1>
        <h2 style={styles.subtitle}>Register</h2>
        
        {error && <div style={styles.error}>{error}</div>}
        
        <form onSubmit={handleRegister}>
          <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} style={styles.input} required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required />
          <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={styles.input} required />

          <div style={styles.roleWrap}>
            <label style={styles.roleLabel}>Register As</label>
            <div style={styles.roleOptions}>
              <label style={styles.roleOption}>
                <input
                  type="radio"
                  value="user"
                  checked={role === 'user'}
                  onChange={() => setRole('user')}
                />
                <span>User</span>
              </label>
              <label style={styles.roleOption}>
                <input
                  type="radio"
                  value="driver"
                  checked={role === 'driver'}
                  onChange={() => setRole('driver')}
                />
                <span>Driver</span>
              </label>
            </div>
          </div>

          {role === 'driver' && (
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              style={styles.input}
            >
              <option value="bike">Bike</option>
              <option value="auto">Auto</option>
              <option value="car">Car</option>
            </select>
          )}

          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} required />
          <button type="submit" style={styles.button} disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
        </form>

        <p style={styles.link}>
          Already have an account? <Link to="/login" style={styles.anchor}>Login here</Link>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f5f5f5' },
  card: { padding: '40px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
  title: { textAlign: 'center', color: '#FF6B35', marginBottom: '10px' },
  subtitle: { textAlign: 'center', color: '#333', marginBottom: '20px' },
  roleWrap: { marginBottom: '15px' },
  roleLabel: { display: 'block', marginBottom: '8px', color: '#333', fontWeight: 'bold' },
  roleOptions: { display: 'flex', gap: '16px' },
  roleOption: { display: 'flex', alignItems: 'center', gap: '6px', color: '#333' },
  input: { width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' },
  button: { width: '100%', padding: '10px', backgroundColor: '#FF6B35', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' },
  error: { color: 'red', marginBottom: '15px', padding: '10px', backgroundColor: '#ffe6e6', borderRadius: '4px' },
  link: { textAlign: 'center', marginTop: '15px' },
  anchor: { color: '#FF6B35', textDecoration: 'none' }
};

export default Register;
