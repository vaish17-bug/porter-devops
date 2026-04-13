const express = require('express');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.post('/send', notificationController.sendNotification);
router.get('/:bookingId', notificationController.getNotifications);
router.get('/user/:userId', notificationController.getUserNotifications);

module.exports = router;
