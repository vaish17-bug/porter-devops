export const USER_SERVICE = process.env.REACT_APP_USER_SERVICE_URL || 'http://localhost:5001';
export const BOOKING_SERVICE = process.env.REACT_APP_BOOKING_SERVICE_URL || 'http://localhost:5002';
export const DRIVER_SERVICE = process.env.REACT_APP_DRIVER_SERVICE_URL || 'http://localhost:5003';
export const TRACKING_SERVICE = process.env.REACT_APP_TRACKING_SERVICE_URL || 'http://localhost:5004';
export const NOTIFICATION_SERVICE = process.env.REACT_APP_NOTIFICATION_SERVICE_URL || 'http://localhost:5005';

const API = {
    USER_SERVICE,
    BOOKING_SERVICE,
    DRIVER_SERVICE,
    TRACKING_SERVICE,
    NOTIFICATION_SERVICE,
};

export default API;