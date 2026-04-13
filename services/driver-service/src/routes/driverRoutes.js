const express = require('express');
const driverController = require('../controllers/driverController');

const router = express.Router();

router.get('/', driverController.getAllDrivers);
router.post('/', driverController.createDriver);
router.post('/assign/:bookingId', driverController.assignDriver);
router.post('/release', driverController.releaseDriver);
router.patch('/:driverId/availability', driverController.updateAvailability);

module.exports = router;
