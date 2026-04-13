# 🚚 Mini Porter - Delivery System

A microservices-based delivery platform inspired by Porter with DevOps best practices.

## 📋 Project Structure

```
Porter/
├── services/
│   ├── user-service/        # User authentication & profiles
│   ├── booking-service/     # Delivery booking management
│   ├── driver-service/      # Driver assignment logic
│   ├── tracking-service/    # Real-time delivery tracking
│   └── notification-service/ # Status notifications
├── frontend/                 # React UI
├── infra/
│   ├── docker/              # Docker Compose setup
│   └── github-actions/      # CI/CD workflows
├── docs/                    # Documentation
└── tests/                   # Test suites
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x
- Docker & Docker Compose
- MongoDB (local or Atlas)
- Git

### Setup & Run

1. **Clone & Navigate**
   ```bash
   cd Porter
   ```

2. **Configure Environment**
   ```bash
   # Copy .env.example to .env in each service
   cp services/user-service/.env.example services/user-service/.env
   cp services/booking-service/.env.example services/booking-service/.env
   # ... repeat for all services
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Access Services**
   - Frontend: http://localhost:3000
   - User Service: http://localhost:5001
   - Booking Service: http://localhost:5002
   - Driver Service: http://localhost:5003
   - Tracking Service: http://localhost:5004
   - Notification Service: http://localhost:5005

5. **Seed Drivers**
   ```bash
   cd services/driver-service
   npm install
   npm run seed
   ```

## 🏗️ Architecture

### Microservices

| Service | Port | Responsibility |
|---------|------|-----------------|
| User Service | 5001 | JWT authentication, user management |
| Booking Service | 5002 | Delivery booking creation |
| Driver Service | 5003 | Driver assignment (nearest-first) |
| Tracking Service | 5004 | Real-time status updates |
| Notification Service | 5005 | Console + email notifications |

### Database
- Single MongoDB instance with collection-level ownership
- Collections: users, bookings, drivers, tracking, notifications

### Communication
- REST APIs between services
- Automatic driver assignment on booking
- Event-driven status updates

## 📝 API Endpoints

### User Service
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login & get JWT token
- `GET /auth/profile` - Get user profile (requires token)

### Booking Service
- `POST /bookings` - Create booking
- `GET /bookings/:bookingId` - Get booking details
- `GET /bookings/user/:userId` - Get user's bookings

### Driver Service
- `GET /drivers` - List all drivers
- `POST /drivers` - Create driver
- `POST /drivers/assign/:bookingId` - Assign driver (auto-called)

### Tracking Service
- `POST /tracking/start/:bookingId` - Start tracking
- `GET /tracking/:bookingId` - Get current tracking status

### Notification Service
- `POST /notifications/send` - Send notification
- `GET /notifications/:bookingId` - Get booking notifications
- `GET /notifications/user/:userId` - Get user notifications

## 🧪 Testing

### Manual Testing
1. Use Postman collection: `tests/postman/Porter.postman_collection.json`
2. Happy path: Register → Login → Create Booking → Track Delivery

### Automated Testing
```bash
npm test
```

## 🐳 Docker Compose

All services start automatically with dependencies in correct order:

```bash
docker-compose up -d          # Start all services
docker-compose logs -f        # View logs
docker-compose down           # Stop all services
```

## 🔄 CI/CD Pipeline

**Triggered on:** Push to `main` or `develop`, Pull requests

**Steps:**
1. Checkout code
2. Install dependencies
3. Run linting
4. Build all Docker images
5. Generate test reports
6. Upload artifacts

View workflow: `.github/workflows/ci.yml`

## 📊 Features

✅ User authentication with JWT  
✅ Booking with location coordinates  
✅ Nearest-driver assignment  
✅ Automatic status simulation  
✅ Real-time tracking updates  
✅ Console + Email notifications  
✅ Docker containerization  
✅ GitHub Actions CI pipeline  
✅ Health checks on all services  
✅ Microservices architecture  

## 🎯 Demo Scenario

1. User registers & logs in
2. Creates booking with pickup/drop locations
3. System assigns nearest available driver
4. Tracking service simulates delivery journey:
   - Order Placed → Picked Up → In Transit → Delivered
5. Notifications sent at each status change
6. Frontend shows live tracking timeline

## 📚 Documentation

- [Architecture Diagram](docs/ARCHITECTURE.md)
- [API Contracts](docs/API_CONTRACTS.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## 🛠️ Development

### Running Services Locally
```bash
# Terminal 1
cd services/user-service && npm install && npm run dev

# Terminal 2
cd services/booking-service && npm install && npm run dev

# Terminal 3
cd services/driver-service && npm install && npm run seed && npm run dev

# Terminal 4
cd services/tracking-service && npm install && npm run dev

# Terminal 5
cd services/notification-service && npm install && npm run dev

# Terminal 6
cd frontend && npm install && npm start
```

## 📈 Known Limitations & Future Enhancements

| Item | Status |
|------|--------|
| Real payment integration | Future |
| Actual GPS tracking | Future |
| Mobile app | Future |
| Multi-database per service | Future |
| Service mesh (Istio) | Future |
| Message queue (RabbitMQ) | Future |
| Kubernetes deployment | Future |

## 🤝 Team Roles

- **Backend:** Microservices development, API contracts
- **Frontend:** React UI, location selection, live tracking
- **DevOps:** Docker Compose, CI/CD pipeline, deployment

## 📞 Contact & Support

For issues or questions:
- Check [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- Review service logs: `docker-compose logs service-name`
- Verify all services healthy: `GET /health` on each service

---

**Submission Date:** Wednesday (Deadline)  
**Project Status:** Ready for Demo ✅
