const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const Driver = require('../models/Driver');
const DriverOffer = require('../models/DriverOffer');

const OFFER_EXPIRY_MS = 300000;
const offerTimeouts = new Map();

// Helper to calculate distance using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const SERVICE_TO_VEHICLE = {
  bike: ['bike', 'two_wheeler'],
  small_tempo: ['auto', 'small_tempo'],
  truck: ['truck']
};

const toNumber = (value) => Number(value);

const getIo = (req) => req.app.get('io');
const getOnlineDriverCounts = (req) => req.app.get('onlineDriverCounts') || new Map();
const isDriverOnline = (req, driverId) => (getOnlineDriverCounts(req).get(driverId) || 0) > 0;

const emitToDriver = (req, driverId, eventName, payload) => {
  const io = getIo(req);
  if (!io || !driverId) {
    return;
  }

  io.to(`driver:${driverId}`).emit(eventName, payload);
};

const clearOfferTimeout = (offerId) => {
  const timeout = offerTimeouts.get(offerId);
  if (timeout) {
    clearTimeout(timeout);
    offerTimeouts.delete(offerId);
  }
};

const scheduleOfferExpiry = (req, offer) => {
  const expiresInMs = Math.max(0, new Date(offer.expiresAt).getTime() - Date.now());

  const timeout = setTimeout(async () => {
    try {
      const expiredOffer = await DriverOffer.findOneAndUpdate(
        { offerId: offer.offerId, status: 'pending' },
        { status: 'expired', respondedAt: new Date() },
        { new: true }
      );

      if (expiredOffer) {
        emitToDriver(req, expiredOffer.driverId, 'driver:offer-expired', {
          offerId: expiredOffer.offerId,
          bookingId: expiredOffer.bookingId
        });
      }
    } catch (error) {
      console.warn('⚠️ Offer expiry failed:', error.message);
    } finally {
      offerTimeouts.delete(offer.offerId);
    }
  }, expiresInMs);

  offerTimeouts.set(offer.offerId, timeout);
};

const buildOfferPayload = (offer) => ({
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

const createAndSendOffer = async (req, {
  bookingId,
  candidate,
  pickup,
  drop,
  serviceType,
  parcelWeightKg,
  fareBreakdown
}) => {
  const distance = calculateDistance(
    candidate.currentLocation.latitude,
    candidate.currentLocation.longitude,
    pickup.latitude,
    pickup.longitude
  );

  const offer = await DriverOffer.create({
    offerId: uuidv4(),
    bookingId,
    driverId: candidate.driverId,
    driverName: candidate.name,
    driverPhone: candidate.phone,
    vehicleType: candidate.vehicleType,
    pickup,
    drop,
    serviceType,
    parcelWeightKg,
    fareBreakdown,
    distanceKm: Number(distance.toFixed(2)),
    expiresAt: new Date(Date.now() + OFFER_EXPIRY_MS)
  });

  emitToDriver(req, candidate.driverId, 'driver:offer', buildOfferPayload(offer));
  scheduleOfferExpiry(req, offer);

  return offer;
};

const getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ drivers });
  } catch (error) {
    console.error('Get Drivers Error:', error);
    res.status(500).json({ message: 'Failed to fetch drivers', error: error.message });
  }
};

const getDriverProfile = async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    res.status(200).json({ driver });
  } catch (error) {
    console.error('Get Driver Profile Error:', error);
    res.status(500).json({ message: 'Failed to fetch driver profile', error: error.message });
  }
};

const createDriver = async (req, res) => {
  try {
    const { name, phone, vehicleType } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone are required' });
    }

    const driverId = uuidv4();
    const driver = new Driver({
      driverId,
      name,
      phone,
      vehicleType: vehicleType || 'bike'
    });

    await driver.save();

    res.status(201).json({
      message: 'Driver created successfully',
      driver
    });
  } catch (error) {
    console.error('Create Driver Error:', error);
    res.status(500).json({ message: 'Driver creation failed', error: error.message });
  }
};

const assignDriver = async (req, res) => {
  try {
    const {
      bookingId,
      pickupLat,
      pickupLon,
      dropLat,
      dropLon,
      serviceType,
      pickup,
      drop,
      parcelWeightKg,
      fareBreakdown
    } = req.body;

    const parsedPickupLat = toNumber(pickupLat);
    const parsedPickupLon = toNumber(pickupLon);
    const parsedDropLat = toNumber(dropLat);
    const parsedDropLon = toNumber(dropLon);

    // Get available drivers
    const availableDrivers = await Driver.find({ isAvailable: true });
    const allowedVehicles = SERVICE_TO_VEHICLE[serviceType] || null;
    const vehicleEligibleDrivers = allowedVehicles
      ? availableDrivers.filter((driver) => allowedVehicles.includes(driver.vehicleType))
      : availableDrivers;
    const eligibleDrivers = vehicleEligibleDrivers.filter((driver) => isDriverOnline(req, driver.driverId));

    if (eligibleDrivers.length === 0) {
      console.warn('⚠️ No available drivers for booking:', bookingId);
      return res.status(200).json({ 
        message: 'No online drivers available',
        assigned: false,
        offersCreated: 0
      });
    }

    // Sort by distance to pickup
    const driversWithDistance = eligibleDrivers.map(driver => ({
      ...driver.toObject(),
      distance: calculateDistance(
        driver.currentLocation.latitude,
        driver.currentLocation.longitude,
        parsedPickupLat,
        parsedPickupLon
      )
    })).sort((a, b) => a.distance - b.distance);

    const selectedDrivers = driversWithDistance.slice(0, 3);
    const normalizedPickup = pickup || {
      latitude: parsedPickupLat,
      longitude: parsedPickupLon
    };

    const normalizedDrop = drop || {
      latitude: parsedDropLat,
      longitude: parsedDropLon
    };

    const offers = [];

    for (const driver of selectedDrivers) {
      const offer = await createAndSendOffer(req, {
        bookingId,
        candidate: driver,
        pickup: normalizedPickup,
        drop: normalizedDrop,
        serviceType,
        parcelWeightKg,
        fareBreakdown
      });

      offers.push(offer);
    }

    res.status(200).json({
      message: 'Driver offers sent to nearby drivers',
      assigned: false,
      offersCreated: offers.length
    });
  } catch (error) {
    console.error('Assign Driver Error:', error);
    res.status(500).json({ message: 'Driver assignment failed', error: error.message });
  }
};

const acceptDriverOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId is required' });
    }

    const offer = await DriverOffer.findOne({ offerId, driverId });

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    if (offer.status !== 'pending' || new Date(offer.expiresAt).getTime() < Date.now()) {
      return res.status(409).json({ message: 'Offer is no longer available' });
    }

    const lockedDriver = await Driver.findOneAndUpdate(
      { driverId, isAvailable: true },
      { isAvailable: false },
      { new: true }
    );

    if (!lockedDriver) {
      return res.status(409).json({ message: 'Driver is no longer available' });
    }

    const bookingResponse = await axios.patch(
      `${process.env.BOOKING_SERVICE_URL}/bookings/${offer.bookingId}/assign`,
      {
        driverId: lockedDriver.driverId,
        status: 'confirmed',
        expectedStatus: 'pending_driver'
      }
    );

    if (!bookingResponse.data?.booking) {
      await Driver.findOneAndUpdate({ driverId }, { isAvailable: true });
      return res.status(409).json({ message: 'Booking could not be confirmed' });
    }

    const acceptedOffer = await DriverOffer.findOneAndUpdate(
      { offerId, driverId, status: 'pending' },
      { status: 'accepted', respondedAt: new Date() },
      { new: true }
    );

    if (!acceptedOffer) {
      await Driver.findOneAndUpdate({ driverId }, { isAvailable: true });
      return res.status(409).json({ message: 'Offer is no longer available' });
    }

    clearOfferTimeout(offerId);

    const otherOffers = await DriverOffer.find({ bookingId: offer.bookingId, status: 'pending', offerId: { $ne: offerId } });
    await DriverOffer.updateMany(
      { bookingId: offer.bookingId, status: 'pending', offerId: { $ne: offerId } },
      { status: 'expired', respondedAt: new Date() }
    );

    otherOffers.forEach((otherOffer) => {
      clearOfferTimeout(otherOffer.offerId);
      emitToDriver(req, otherOffer.driverId, 'driver:offer-expired', {
        offerId: otherOffer.offerId,
        bookingId: otherOffer.bookingId
      });
    });

    if (process.env.TRACKING_SERVICE_URL) {
      try {
        await axios.post(`${process.env.TRACKING_SERVICE_URL}/tracking/start/${offer.bookingId}`, {
          driverId: lockedDriver.driverId,
          pickupLat: offer.pickup?.latitude,
          pickupLon: offer.pickup?.longitude,
          dropLat: offer.drop?.latitude,
          dropLon: offer.drop?.longitude
        });
      } catch (trackingError) {
        console.warn('⚠️ Tracking start failed:', trackingError.message);
      }
    }

    emitToDriver(req, lockedDriver.driverId, 'driver:offer-accepted', {
      offerId: acceptedOffer.offerId,
      bookingId: acceptedOffer.bookingId
    });

    res.status(200).json({
      message: 'Offer accepted successfully',
      driver: lockedDriver,
      booking: bookingResponse.data.booking,
      offer: acceptedOffer
    });
  } catch (error) {
    console.error('Accept Driver Offer Error:', error);
    res.status(500).json({ message: 'Failed to accept offer', error: error.message });
  }
};

const rejectDriverOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId is required' });
    }

    const offer = await DriverOffer.findOneAndUpdate(
      { offerId, driverId, status: 'pending' },
      { status: 'rejected', respondedAt: new Date() },
      { new: true }
    );

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found or already handled' });
    }

    clearOfferTimeout(offerId);

    const pendingOffersCount = await DriverOffer.countDocuments({
      bookingId: offer.bookingId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (pendingOffersCount === 0) {
      const offeredDriverIds = await DriverOffer.distinct('driverId', { bookingId: offer.bookingId });
      const allowedVehicles = SERVICE_TO_VEHICLE[offer.serviceType] || null;

      const query = {
        isAvailable: true,
        driverId: { $nin: offeredDriverIds }
      };

      if (allowedVehicles) {
        query.vehicleType = { $in: allowedVehicles };
      }

      const additionalCandidates = (await Driver.find(query)).filter((candidate) =>
        isDriverOnline(req, candidate.driverId)
      );

      if (additionalCandidates.length > 0) {
        const sortedCandidates = additionalCandidates.sort((a, b) => {
          const distanceA = calculateDistance(
            a.currentLocation.latitude,
            a.currentLocation.longitude,
            offer.pickup?.latitude,
            offer.pickup?.longitude
          );

          const distanceB = calculateDistance(
            b.currentLocation.latitude,
            b.currentLocation.longitude,
            offer.pickup?.latitude,
            offer.pickup?.longitude
          );

          return distanceA - distanceB;
        });

        await createAndSendOffer(req, {
          bookingId: offer.bookingId,
          candidate: sortedCandidates[0],
          pickup: offer.pickup,
          drop: offer.drop,
          serviceType: offer.serviceType,
          parcelWeightKg: offer.parcelWeightKg,
          fareBreakdown: offer.fareBreakdown
        });
      }
    }

    emitToDriver(req, driverId, 'driver:offer-rejected', {
      offerId: offer.offerId,
      bookingId: offer.bookingId
    });

    res.status(200).json({
      message: 'Offer rejected successfully',
      offer
    });
  } catch (error) {
    console.error('Reject Driver Offer Error:', error);
    res.status(500).json({ message: 'Failed to reject offer', error: error.message });
  }
};

const getPendingOffers = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId is required' });
    }

    const offers = await DriverOffer.find({
      driverId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.status(200).json({
      offers: offers.map((offer) => buildOfferPayload(offer))
    });
  } catch (error) {
    console.error('Get Pending Offers Error:', error);
    res.status(500).json({ message: 'Failed to fetch pending offers', error: error.message });
  }
};

const releaseDriver = async (req, res) => {
  try {
    const { driverId, latitude, longitude } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId is required' });
    }

    const updates = {
      isAvailable: true,
      $inc: { totalDeliveries: 1 }
    };

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      updates.currentLocation = { latitude, longitude };
    }

    const driver = await Driver.findOneAndUpdate(
      { driverId },
      updates,
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    res.status(200).json({
      message: 'Driver released successfully',
      driver
    });
  } catch (error) {
    console.error('Release Driver Error:', error);
    res.status(500).json({ message: 'Failed to release driver', error: error.message });
  }
};

const updateLocation = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { latitude, longitude } = req.body;

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      return res.status(400).json({ message: 'latitude and longitude must be valid numbers' });
    }

    const driver = await Driver.findOneAndUpdate(
      { driverId },
      { currentLocation: { latitude: parsedLatitude, longitude: parsedLongitude } },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    res.status(200).json({
      message: 'Driver location updated',
      driver
    });
  } catch (error) {
    console.error('Update Location Error:', error);
    res.status(500).json({ message: 'Failed to update location', error: error.message });
  }
};

const updateAvailability = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ message: 'isAvailable must be boolean' });
    }

    const driver = await Driver.findOneAndUpdate(
      { driverId },
      { isAvailable },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    res.status(200).json({
      message: 'Driver availability updated',
      driver
    });
  } catch (error) {
    console.error('Update Availability Error:', error);
    res.status(500).json({ message: 'Failed to update availability', error: error.message });
  }
};

module.exports = {
  getAllDrivers,
  getDriverProfile,
  createDriver,
  assignDriver,
  releaseDriver,
  updateAvailability,
  updateLocation,
  acceptDriverOffer,
  rejectDriverOffer,
  getPendingOffers
};
