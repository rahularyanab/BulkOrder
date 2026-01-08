# 🛒 B2B RetailHub - Group Buying Platform for Retailers

A mobile-first B2B platform that enables retailers to place group orders from suppliers, unlocking bulk pricing through aggregated demand within geographic zones.

![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-blue)
![Framework](https://img.shields.io/badge/Framework-Expo%20%7C%20React%20Native-purple)
![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20MongoDB-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 📱 Features

### For Retailers
- **Group Buying** - Join bids with other retailers to unlock better prices
- **Dynamic Pricing** - Watch prices drop as more retailers join
- **Zone-based Orders** - Automatic grouping with nearby retailers
- **Order Tracking** - Real-time status updates
- **Bid Requests** - Request new products to be added

### For Admins
- **Dashboard** - Overview of offers, orders, and revenue
- **Catalog Management** - Add products, categories, and suppliers
- **Bid Management** - Approve/reject retailer bid requests
- **Fulfillment** - Track and manage order fulfillment
- **Price Slabs** - Configure quantity-based pricing tiers

---

## 🏗️ Architecture

```
├── frontend/                 # Expo React Native App
│   ├── app/                  # Screen components (file-based routing)
│   │   ├── (auth)/          # Authentication screens
│   │   ├── (tabs)/          # Retailer screens
│   │   └── (admin)/         # Admin dashboard screens
│   ├── src/
│   │   ├── context/         # React Context (Auth)
│   │   └── services/        # API service layer
│   └── assets/              # Images and icons
│
├── backend/                  # FastAPI Server
│   ├── server.py            # Main API server
│   └── requirements.txt     # Python dependencies
│
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.9+
- MongoDB (local or Atlas)
- Expo Go app (for mobile testing)

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/b2b-retailhub.git
cd b2b-retailhub
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="b2b_retailhub"
JWT_SECRET="your-secret-key-here"
EOF

# Run server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install
# OR
yarn install

# Create .env file
cat > .env << EOF
EXPO_PUBLIC_BACKEND_URL="http://localhost:8001"
EOF

# Start Expo
npx expo start
```

### 4. Access the App
- **Web**: http://localhost:3000
- **Mobile**: Scan QR code with Expo Go app
- **Admin Login**: Phone `9999999999`, Password `Password123`

---

## 📱 Building APK for Android

### One-time Setup
```bash
# Create free account at https://expo.dev

# Login to EAS
cd frontend
npx eas-cli login
npx eas-cli init
```

### Build APK
```bash
# Preview build (for testing & distribution)
npx eas-cli build --platform android --profile preview

# Production build (for Play Store)
npx eas-cli build --platform android --profile production
```

Build takes ~15-20 minutes. Download link provided after completion.

### Distribution Options
| Method | Cost | Steps |
|--------|------|-------|
| Direct APK | FREE | Share via WhatsApp/Email |
| Firebase App Distribution | FREE | Upload to Firebase console |
| Google Play Store | $25 one-time | Submit via EAS |

---

## 🔐 Authentication

### Retailer Login
1. Enter phone number
2. Receive OTP (in dev mode, OTP is returned in response)
3. Enter OTP to login
4. Complete profile (shop name, address, location)

### Admin Login
- **Phone**: `9999999999`
- **Password**: `Password123`
- Or use OTP method

---

## 📊 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to phone |
| POST | `/api/auth/verify-otp` | Verify OTP |
| POST | `/api/auth/admin-login` | Admin password login |

### Products & Catalog
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List all products |
| POST | `/api/products` | Create product |
| GET | `/api/categories` | List categories |
| POST | `/api/admin/categories` | Create category |

### Offers & Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offers/zone/{zone_id}` | Get zone offers |
| POST | `/api/orders` | Place order |
| GET | `/api/orders/me` | Get my orders |
| POST | `/api/admin/offers` | Create offer |

### Bid Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bid-requests` | Create bid request |
| GET | `/api/admin/bid-requests` | List bid requests |
| PUT | `/api/admin/bid-requests/{id}/approve` | Approve bid |

---

## 💰 Pricing Model

### Quantity Slabs Example
| Quantity | Price per Unit |
|----------|----------------|
| 1-20 units | ₹150 |
| 21-50 units | ₹130 |
| 51+ units | ₹110 |

As more retailers join, everyone pays the lower price!

---

## 🗄️ Database Schema

### Collections
- `products` - Product catalog
- `categories` - Product categories
- `suppliers` - Supplier information
- `zones` - Geographic zones
- `retailers` - Retailer profiles
- `supplier_offers` - Active offers with pricing
- `order_items` - Individual orders
- `bid_requests` - Product requests from retailers

---

## 🚀 Deployment

### Backend (Recommended: Railway.app)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

### Alternative Backend Hosts
| Service | Cost | Notes |
|---------|------|-------|
| Railway | $5/month | Easy setup |
| Render | FREE tier | 750 hrs/month |
| Fly.io | FREE tier | 3 VMs free |
| Heroku | $5/month | Simple deploy |

### Database (MongoDB Atlas)
1. Create free cluster at https://mongodb.com/atlas
2. Get connection string
3. Update `MONGO_URL` in backend `.env`

---

## 🔧 Environment Variables

### Backend (.env)
```env
MONGO_URL="mongodb+srv://..."
DB_NAME="b2b_retailhub"
JWT_SECRET="your-secret-key"
```

### Frontend (.env)
```env
EXPO_PUBLIC_BACKEND_URL="https://your-backend.com"
```

---

## 📁 Project Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── phone.tsx        # Phone input screen
│   │   ├── otp.tsx          # OTP verification
│   │   └── admin-login.tsx  # Admin password login
│   ├── (tabs)/
│   │   ├── home.tsx         # Retailer home
│   │   ├── catalog.tsx      # Product catalog & bidding
│   │   ├── orders.tsx       # Order history
│   │   └── profile.tsx      # User profile
│   └── (admin)/
│       ├── dashboard.tsx    # Admin dashboard
│       ├── catalog.tsx      # Product/Category management
│       ├── bids.tsx         # Bid request management
│       ├── fulfillment.tsx  # Order fulfillment
│       └── payments.tsx     # Payment tracking
├── src/
│   ├── context/
│   │   └── AuthContext.tsx  # Authentication state
│   └── services/
│       └── api.ts           # API client
├── app.json                 # Expo config
├── eas.json                 # EAS Build config
└── package.json
```

---

## 🧪 Testing

### Backend Health Check
```bash
curl http://localhost:8001/api/health
# Response: {"status":"healthy"}
```

### Test OTP Flow
```bash
# Send OTP
curl -X POST http://localhost:8001/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "1234567890"}'

# Verify OTP
curl -X POST http://localhost:8001/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "1234567890", "otp": "123456"}'
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support

- Create an issue for bug reports
- Start a discussion for feature requests
- Email: support@b2bretailhub.com

---

## 🙏 Acknowledgments

- [Expo](https://expo.dev) - React Native framework
- [FastAPI](https://fastapi.tiangolo.com) - Python web framework
- [MongoDB](https://mongodb.com) - Database
- [React Native](https://reactnative.dev) - Mobile framework

---

Made with ❤️ for retailers
