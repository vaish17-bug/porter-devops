const mongoose = require('mongoose');

const DriverOfferSchema = new mongoose.Schema({
  offerId: {
    type: String,
    unique: true,
    required: true
  },
  bookingId: {
    type: String,
    required: true,
    index: true
  },
  driverId: {
    type: String,
    required: true,
    index: true
  },
  driverName: String,
  driverPhone: String,
  vehicleType: String,
  pickup: {
    name: String,
    latitude: Number,
    longitude: Number
  },
  drop: {
    name: String,
    latitude: Number,
    longitude: Number
  },
  serviceType: {
    type: String,
    enum: ['bike', 'small_tempo', 'truck']
  },
  parcelWeightKg: Number,
  fareBreakdown: {
    baseFare: Number,
    distanceFare: Number,
    weightFare: Number,
    totalFare: Number
  },
  distanceKm: Number,
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },
  respondedAt: Date,
  expiresAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DriverOffer', DriverOfferSchema);