jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn(() => Promise.resolve())
  };
});

jest.mock('../models/Driver', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn()
}));

jest.mock('../models/DriverOffer', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn()
}));

const request = require('supertest');
const app = require('../index');
const Driver = require('../models/Driver');
const DriverOffer = require('../models/DriverOffer');

describe('Driver Service routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a driver profile by driver id', async () => {
    Driver.findOne.mockResolvedValue({
      driverId: 'driver-123',
      name: 'Aman Singh',
      phone: '9999999999'
    });

    const response = await request(app).get('/drivers/profile/driver-123');

    expect(response.status).toBe(200);
    expect(response.body.driver).toMatchObject({
      driverId: 'driver-123',
      name: 'Aman Singh'
    });
  });

  it('updates driver location', async () => {
    Driver.findOneAndUpdate.mockResolvedValue({
      driverId: 'driver-123',
      currentLocation: {
        latitude: 28.5,
        longitude: 77.2
      }
    });

    const response = await request(app)
      .patch('/drivers/driver-123/location')
      .send({ latitude: 28.5, longitude: 77.2 });

    expect(response.status).toBe(200);
    expect(Driver.findOneAndUpdate).toHaveBeenCalledWith(
      { driverId: 'driver-123' },
      { currentLocation: { latitude: 28.5, longitude: 77.2 } },
      { new: true }
    );
    expect(response.body.driver.currentLocation).toMatchObject({
      latitude: 28.5,
      longitude: 77.2
    });
  });

  it('rejects invalid location values', async () => {
    const response = await request(app)
      .patch('/drivers/driver-123/location')
      .send({ latitude: 'abc', longitude: 77.2 });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('latitude and longitude must be valid numbers');
  });

  it('assigns only compatible vehicle for selected service', async () => {
    app.set('onlineDriverCounts', new Map([
      ['bike-driver', 1],
      ['auto-driver', 1]
    ]));

    Driver.find.mockResolvedValue([
      {
        _id: 'bike-driver-id',
        driverId: 'bike-driver',
        name: 'Bike Driver',
        phone: '9990001111',
        vehicleType: 'bike',
        currentLocation: { latitude: 28.5, longitude: 77.1 },
        toObject() {
          return this;
        }
      },
      {
        _id: 'auto-driver-id',
        driverId: 'auto-driver',
        name: 'Auto Driver',
        phone: '9990002222',
        vehicleType: 'auto',
        currentLocation: { latitude: 28.52, longitude: 77.12 },
        toObject() {
          return this;
        }
      }
    ]);
    DriverOffer.create.mockResolvedValue({
      offerId: 'offer-123',
      bookingId: 'booking-123',
      driverId: 'auto-driver',
      driverName: 'Auto Driver',
      driverPhone: '9990002222',
      vehicleType: 'auto',
      pickup: { latitude: 28.55, longitude: 77.1 },
      drop: { latitude: 28.6, longitude: 77.2 },
      serviceType: 'small_tempo',
      parcelWeightKg: 12,
      fareBreakdown: { totalFare: 100 },
      distanceKm: 1.23,
      expiresAt: new Date()
    });

    const response = await request(app)
      .post('/drivers/assign/booking-123')
      .send({
        bookingId: 'booking-123',
        serviceType: 'small_tempo',
        pickupLat: 28.55,
        pickupLon: 77.1,
        dropLat: 28.6,
        dropLon: 77.2
      });

    expect(response.status).toBe(200);
    expect(response.body.assigned).toBe(false);
    expect(response.body.offersCreated).toBe(1);
    expect(DriverOffer.create).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 'booking-123',
      driverId: 'auto-driver',
      vehicleType: 'auto',
      serviceType: 'small_tempo'
    }));
  });
});