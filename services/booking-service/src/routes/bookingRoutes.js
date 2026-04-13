const express = require('express');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

router.post('/', bookingController.createBooking);
router.get('/:bookingId', bookingController.getBooking);
router.get('/user/:userId', bookingController.getUserBookings);

module.exports = router;
