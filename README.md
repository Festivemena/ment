# PIC-ME Backend

PIC-ME is a **photography booking platform** that connects clients with professional photographers and videographers. This is the **backend API** built using **Node.js, Express.js, and MongoDB**. It includes authentication, bookings, payments, messaging, and notifications.

## Features
- **User Authentication** (JWT-based login & registration)
- **Profile Management** (Clients & Creatives)
- **AI-driven Photographer Matching**
- **Booking & Scheduling System**
- **Secure Payment Processing** (Stripe/Paystack)
- **Ratings & Reviews**
- **Real-time Messaging**
- **Push Notifications**

## Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose ORM)
- **Authentication**: JWT & OAuth
- **Payments**: Stripe/Paystack
- **Messaging**: WebSockets, Firebase Cloud Messaging (FCM)
- **Storage**: AWS S3 / Cloudinary
- **Caching**: Redis
- **Logging & Monitoring**: Winston & Prometheus

## Getting Started

### Prerequisites
Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v14+ recommended)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas Cloud Database)
- [Redis](https://redis.io/) (for caching, optional)
- [Stripe](https://stripe.com/) or [Paystack](https://paystack.com/) account (for payments, optional)

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/your-username/pic-me-backend.git
   cd pic-me-backend
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add the following:
   ```ini
   PORT=5000
   MONGO_URI=mongodb+srv://your_mongo_uri
   JWT_SECRET=your_jwt_secret
   STRIPE_SECRET_KEY=your_stripe_secret
   CLOUDINARY_URL=your_cloudinary_url
   ```

4. **Run the server:**
   ```sh
   npm start  # or nodemon server.js (for development)
   ```

## API Endpoints & Examples

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/register` | Register a new user |
| POST | `/login` | User login (returns JWT) |
| POST | `/logout` | Logs out the user |

#### Example: Register User
**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "client"
}
```
**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "_id": "60f7a5c3e8a1a9b3a8e4b123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "client"
  }
}
```

### User Management (`/api/users`)
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/profile/:id` | Get user profile |
| PUT | `/profile/update` | Update user profile |
| DELETE | `/profile/delete` | Delete user profile |

#### Example: Get User Profile
**Request:**
```sh
GET /api/users/profile/60f7a5c3e8a1a9b3a8e4b123
Authorization: Bearer <token>
```
**Response:**
```json
{
  "user": {
    "_id": "60f7a5c3e8a1a9b3a8e4b123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "client",
    "profile_picture": "https://s3.amazonaws.com/profile.jpg"
  }
}
```

### Booking System (`/api/bookings`)
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/create` | Create a booking |
| GET | `/list/:userId` | Get all bookings for a user |
| PUT | `/update/:id` | Update a booking |
| DELETE | `/cancel/:id` | Cancel a booking |

#### Example: Create Booking
**Request:**
```json
{
  "client_id": "60f7a5c3e8a1a9b3a8e4b123",
  "creative_id": "60f7a5c3e8a1a9b3a8e4b456",
  "date_time": "2025-03-12T14:00:00Z",
  "location": { "lat": 6.5244, "lng": 3.3792 },
  "total_price": 150.00
}
```
**Response:**
```json
{
  "message": "Booking created",
  "booking": {
    "_id": "60f8a7b3e9b3c9d8e4b789",
    "client_id": "60f7a5c3e8a1a9b3a8e4b123",
    "creative_id": "60f7a5c3e8a1a9b3a8e4b456",
    "date_time": "2025-03-12T14:00:00Z",
    "total_price": 150.00
  }
}
```

## Deployment
You can deploy the backend using **Docker**, **AWS**, or **Heroku**.

### Docker Setup
```sh
docker build -t picme-backend .
docker run -p 5000:5000 picme-backend
```

### Deploy to Heroku
```sh
heroku create picme-backend
heroku config:set MONGO_URI=your_mongo_uri JWT_SECRET=your_jwt_secret
heroku push origin main
```

## Frontend Integration
- The backend serves as an API that can be integrated with a frontend built using **React.js**, **Next.js**, or a mobile app (Flutter, React Native).
- Use the JWT from authentication in `Authorization: Bearer <token>` for secured requests.

## Contributors
- **Efemena Festus** - Backend & Architecture
- **Your Name** - Contributions & Features

## License
This project is licensed under the MIT License.

---
Feel free to contribute by opening issues or submitting pull requests!