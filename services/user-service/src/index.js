const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Database Connection
const mongoUri = process.env.MONGODB_URI;
const connectDb = async () => {
  if (!mongoUri) {
    const message = '❌ MONGODB_URI is missing. Set MONGODB_URI in Docker Compose or .env before starting the service.';
    console.error(message);
    if (require.main === module) {
      process.exit(1);
    }
    throw new Error(message);
  }

  return mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
};

// Routes
app.use('/auth', authRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    service: 'user-service',
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = process.env.PORT || 5001;

if (require.main === module) {
  connectDb()
    .then(() => console.log('✅ User Service MongoDB connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

  app.listen(PORT, () => {
    console.log(`🚀 User Service running on port ${PORT}`);
  });
}

module.exports = app;
