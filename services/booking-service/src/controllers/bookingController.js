const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');

const createBooking = async (req, res) => {
  try {
    const { userId, pickup, drop } = req.body;

    if (!userId || !pickup || !drop) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!pickup.name || !pickup.latitude || !pickup.longitude || 
        !drop.name || !drop.latitude || !drop.longitude) {
      return res.status(400).json({ message: 'Invalid location data' });
    }

    const bookingId = uuidv4();
    const booking = new Booking({
      bookingId,
      userId,
      pickup,
      drop,
      status: 'pending'
    });

    await booking.save();

    // Trigger driver assignment
    try {
      await axios.post(`${process.env.DRIVER_SERVICE_URL}/drivers/assign/${bookingId}`, {
        bookingId,
        userId,
        pickupLat: pickup.latitude,
        pickupLon: pickup.longitude,
        dropLat: drop.latitude,
        dropLon: drop.longitude
      });
    } catch (driverError) {
      console.warn('⚠️ Driver assignment failed:', driverError.message);
    }

    res.status(201).json({
      message: 'Booking created successfully',
      booking
    });
  } catch (error) {
    console.error('Create Booking Error:', error);
    res.status(500).json({ message: 'Booking creation failed', error: error.message });
  }
};

const getBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.status(200).json({ booking });
  } catch (error) {
    console.error('Get Booking Error:', error);
    res.status(500).json({ message: 'Failed to fetch booking', error: error.message });
  }
};

const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.status(200).json({ bookings });
  } catch (error) {
    console.error('Get User Bookings Error:', error);
    res.status(500).json({ message: 'Failed to fetch bookings', error: error.message });
  }
};

module.exports = {
  createBooking,
  getBooking,
  getUserBookings
};
