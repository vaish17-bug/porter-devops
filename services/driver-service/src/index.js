const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');
require('dotenv').config();

const driverRoutes = require('./routes/driverRoutes');
const DriverOffer = require('./models/DriverOffer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH']
  }
});

app.set('io', io);
app.set('onlineDriverCounts', new Map());

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

io.on('connection', (socket) => {
  socket.on('driver:register', async ({ driverId }) => {
    if (!driverId) {
      return;
    }

    const onlineDriverCounts = app.get('onlineDriverCounts');
    const previousDriverId = socket.data.driverId;

    if (previousDriverId && previousDriverId !== driverId) {
      const previousCount = onlineDriverCounts.get(previousDriverId) || 0;
      if (previousCount <= 1) {
        onlineDriverCounts.delete(previousDriverId);
      } else {
        onlineDriverCounts.set(previousDriverId, previousCount - 1);
      }
    }

    socket.join(`driver:${driverId}`);
    socket.data.driverId = driverId;
    onlineDriverCounts.set(driverId, (onlineDriverCounts.get(driverId) || 0) + 1);
    socket.emit('driver:registered', { driverId });

    try {
      const pendingOffers = await DriverOffer.find({
        driverId,
        status: 'pending',
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      pendingOffers.forEach((offer) => {
        socket.emit('driver:offer', {
          offerId: offer.offerId,
          bookingId: offer.bookingId,
          driverId: offer.driverId,
          driverName: offer.driverName,
          driverPhone: offer.driverPhone,
          vehicleType: offer.vehicleType,
          pickup: offer.pickup,
          drop: offer.drop,
          serviceType: offer.serviceType,
          parcelWeightKg: offer.parcelWeightKg,
          fareBreakdown: offer.fareBreakdown,
          distanceKm: offer.distanceKm,
          expiresAt: offer.expiresAt
        });
      });
    } catch (error) {
      console.warn('⚠️ Failed to sync pending offers:', error.message);
    }
  });

  socket.on('disconnect', () => {
    const onlineDriverCounts = app.get('onlineDriverCounts');
    const driverId = socket.data.driverId;

    if (driverId) {
      const currentCount = onlineDriverCounts.get(driverId) || 0;
      if (currentCount <= 1) {
        onlineDriverCounts.delete(driverId);
      } else {
        onlineDriverCounts.set(driverId, currentCount - 1);
      }
    }

    socket.leaveAll();
  });
});

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✅ Driver Service MongoDB connected');
  
  if (process.env.SEED_ON_START === 'true') {
    try {
      await require('../scripts/seedDrivers').seedDrivers();
      console.log('✅ Seed drivers completed');
    } catch (error) {
      console.error('❌ Seed drivers error:', error.message);
    }
  }
})
.catch(err => console.error('❌ MongoDB Connection Error:', err));

app.use('/drivers', driverRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    service: 'driver-service',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = process.env.PORT || 5003;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 Driver Service running on port ${PORT}`);
  });
}

module.exports = app;
