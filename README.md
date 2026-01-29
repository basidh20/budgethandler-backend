# Budget Tracker - Backend API

RESTful API server for the Budget Tracker mobile application built with Node.js, Express, and MongoDB.

## 🏗️ Architecture

```
backend/
├── server.js           # Entry point, Express setup
└── src/
    ├── config/
    │   ├── db.js       # MongoDB connection
    │   └── env.js      # Environment variables
    ├── controllers/    # Request handlers
    │   ├── auth.controller.js
    │   ├── budget.controller.js
    │   ├── category.controller.js
    │   ├── summary.controller.js
    │   └── transaction.controller.js
    ├── middleware/
    │   ├── auth.js         # JWT verification
    │   ├── errorHandler.js # Global error handling
    │   └── validate.js     # Input validation
    ├── models/         # Mongoose schemas
    │   ├── User.js
    │   ├── Category.js
    │   ├── Transaction.js
    │   └── Budget.js
    ├── routes/         # API routes
    │   ├── auth.routes.js
    │   ├── budget.routes.js
    │   ├── category.routes.js
    │   ├── summary.routes.js
    │   └── transaction.routes.js
    ├── services/       # Business logic
    │   ├── auth.service.js
    │   ├── budget.service.js
    │   ├── category.service.js
    │   ├── summary.service.js
    │   └── transaction.service.js
    └── utils/
        ├── apiResponse.js  # Standard response format
        └── validators.js   # Validation schemas
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Start development server
npm run dev

# Start production server
npm start
```

### Environment Variables

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/budget_tracker
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
```

## 📌 API Endpoints

### Health Check
```
GET /api/health
```

### Authentication
```
POST /api/auth/register   - Register new user
POST /api/auth/login      - Login user
GET  /api/auth/profile    - Get user profile (protected)
PUT  /api/auth/profile    - Update profile (protected)
PUT  /api/auth/password   - Change password (protected)
```

### Categories (Protected)
```
GET    /api/categories     - Get all categories
GET    /api/categories/:id - Get category by ID
POST   /api/categories     - Create category
PUT    /api/categories/:id - Update category
DELETE /api/categories/:id - Delete category
```

### Transactions (Protected)
```
GET    /api/transactions     - Get transactions (with filters)
GET    /api/transactions/:id - Get transaction by ID
POST   /api/transactions     - Create transaction
PUT    /api/transactions/:id - Update transaction
DELETE /api/transactions/:id - Delete transaction
```

Query parameters for GET /api/transactions:
- `type`: income | expense
- `categoryId`: Filter by category
- `month`: Filter by month (1-12)
- `year`: Filter by year
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search in description

### Budgets (Protected)
```
GET    /api/budgets          - Get budgets for month
GET    /api/budgets/summary  - Get budget summary
GET    /api/budgets/:id      - Get budget by ID
POST   /api/budgets          - Create/update budget
DELETE /api/budgets/:id      - Delete budget
```

### Summary/Dashboard (Protected)
```
GET /api/summary/dashboard - Dashboard data (balance, recent transactions)
GET /api/summary/monthly   - Monthly breakdown
GET /api/summary/category  - Category-wise breakdown
GET /api/summary/yearly    - Yearly overview
```

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Success message",
  "data": { ... }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "currentPage": 1,
    "itemsPerPage": 20,
    "totalItems": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ]
}
```

## 🔐 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Token-based auth with expiration
- **Input Validation**: express-validator for all inputs
- **CORS**: Configurable cross-origin requests
- **Helmet**: Security headers
- **User Isolation**: Users can only access their own data

## 📦 Dependencies

### Production
- **express**: Web framework
- **mongoose**: MongoDB ODM
- **jsonwebtoken**: JWT authentication
- **bcryptjs**: Password hashing
- **express-validator**: Input validation
- **cors**: Cross-origin requests
- **helmet**: Security headers
- **morgan**: HTTP logging
- **dotenv**: Environment variables

### Development
- **nodemon**: Auto-restart on changes

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test
```

## 📝 Database Indexes

### User
- `email`: unique index

### Category
- `userId, type`: compound index
- `userId, name, type`: unique compound index

### Transaction
- `userId, date`: compound index (descending)
- `userId, type, date`: compound index
- `userId, categoryId, date`: compound index

### Budget
- `userId, categoryId, month, year`: unique compound index
- `userId, month, year`: compound index

## 🔄 Business Rules

1. Users can only access their own data
2. Categories are created per user (default categories on registration)
3. Budgets are unique per user/category/month/year
4. Budgets can only be set for expense categories
5. Transaction type must match category type
6. Password minimum 6 characters

## 📋 Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized / Invalid Token |
| 404 | Resource Not Found |
| 500 | Internal Server Error |

## 🚀 Deployment

### Production Checklist
1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure MongoDB Atlas connection
4. Set appropriate `CORS_ORIGIN`
5. Enable HTTPS

### Recommended Platforms
- Heroku
- Railway
- Render
- DigitalOcean App Platform
- AWS EC2

## 👥 Author

Student Final Year Project

## 📄 License

Educational purposes only.
