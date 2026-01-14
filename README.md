# 🛒 SaudaSetu - B2B Group Buying Platform for Retailers

A mobile-first B2B platform that enables retailers to place group orders from suppliers, unlocking bulk pricing through aggregated demand within geographic zones.

![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-blue)
![Framework](https://img.shields.io/badge/Framework-Expo%20%7C%20React%20Native-purple)
![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20MongoDB%20Atlas-green)
![Deployment](https://img.shields.io/badge/Deployment-Fly.io-orange)

---

## 🌟 Key Features

### For Retailers
| Feature | Description |
|---------|-------------|
| **📱 Phone OTP Login** | Secure authentication with OTP (Mock mode: OTP is `123456`) |
| **🛍️ Product Catalog** | Browse products with categories and search |
| **💰 Group Buying** | Join active bids with other retailers for better prices |
| **📊 Dynamic Pricing** | Watch prices drop as more retailers join - see next slab pricing |
| **🗺️ Zone-based Orders** | Automatic grouping with nearby retailers (5km radius) |
| **📦 Order Tracking** | Real-time status updates for all orders |
| **✋ Bid Requests** | Request new products to be added to catalog |
| **👤 Profile Management** | Manage shop details, address, and location |

### For Admins
| Feature | Description |
|---------|-------------|
| **🔐 Password Login** | Secure admin access with password authentication |
| **📈 Dashboard** | Overview of offers, orders, bids, and revenue metrics |
| **📦 Catalog Management** | Add/edit products with hierarchical category picker |
| **👥 Supplier Management** | Manage supplier information and codes |
| **✅ Bid Management** | Approve/reject retailer bid requests with offer creation |
| **🚚 Fulfillment** | Track and manage order fulfillment status |
| **💳 Payments** | Track payment status and handle disputes |
| **🔔 Bid Count Badge** | Real-time badge showing pending bid requests |

---

## 🏗️ Architecture

```
saudasetu/
├── frontend/                 # Expo React Native App
│   ├── app/                  # Screen components (file-based routing)
│   │   ├── (auth)/          # Authentication screens
│   │   │   ├── phone.tsx    # Phone number input
│   │   │   ├── otp.tsx      # OTP verification
│   │   │   └── admin-login.tsx # Admin password login
│   │   ├── (tabs)/          # Retailer screens
│   │   │   ├── home.tsx     # Dashboard
│   │   │   ├── catalog.tsx  # Products & bidding
│   │   │   ├── orders.tsx   # Order history
│   │   │   └── profile.tsx  # User profile
│   │   └── (admin)/         # Admin dashboard screens
│   │       ├── dashboard.tsx
│   │       ├── catalog.tsx  # Product/Category management
│   │       ├── bids.tsx     # Bid request management
│   │       ├── fulfillment.tsx
│   │       └── payments.tsx
│   ├── src/
│   │   ├── context/         # React Context (Auth)
│   │   └── services/        # API service layer
│   ├── app.json             # Expo configuration
│   └── eas.json             # EAS Build configuration
│
└── backend/                  # FastAPI Server
    ├── server.py            # Main API server (all endpoints)
    ├── Dockerfile           # Docker configuration for deployment
    ├── fly.toml             # Fly.io deployment config
    └── requirements.txt     # Python dependencies
```

---

## 🚀 Production Setup

### Live Deployment
- **Backend API**: `https://saudasetu-api.fly.dev`
- **Database**: MongoDB Atlas (cloud-hosted)
- **SMS Provider**: MSG91 (DLT registration pending - currently using mock OTP)

### Current Configuration
| Component | Status | Details |
|-----------|--------|---------|
| Backend | ✅ Live | Fly.io (Mumbai region) |
| Database | ✅ Live | MongoDB Atlas |
| SMS OTP | ⏳ Mock | MSG91 configured, DLT pending |
| APK | ✅ Ready | EAS Build configured |

---

## 🔐 Authentication

### Retailer Login
1. Enter phone number
2. Enter OTP: **`123456`** (mock mode)
3. Complete profile (shop name, address, location)
4. Auto-assigned to nearest zone or new zone created

### Admin Login
- **Phone**: `9999999999`
- **Password**: `Password123`
- Or use OTP method (OTP: `123456`)

---

## 🗺️ Dynamic Zone System

Zones are created automatically based on retailer location:

1. When a new retailer registers with location
2. System checks for existing zones within **5km radius**
3. If zone found → Retailer assigned to that zone
4. If no zone found → **New zone auto-created** centered on retailer's location

This enables:
- Automatic retailer grouping by geography
- Scalable zone management
- Location-based offer targeting

---

## 💰 Pricing Model

### Quantity Slabs (Group Buying)
| Aggregated Quantity | Price per Unit |
|---------------------|----------------|
| 1-20 units | ₹150 |
| 21-50 units | ₹130 |
| 51+ units | ₹110 |

**How it works:**
- Multiple retailers in a zone order the same product
- Orders are aggregated until min fulfillment quantity is met
- **All participants get the best price** based on total quantity
- UI shows current price AND next slab incentive

---

## 📱 Building APK

### Prerequisites
- Expo account (free): https://expo.dev
- EAS CLI installed

### Build Commands
```bash
cd frontend

# Login to EAS
npx eas-cli login

# Build APK (preview - for testing)
npx eas-cli build --platform android --profile preview

# Build AAB (production - for Play Store)
npx eas-cli build --platform android --profile production
```

Build takes ~15-20 minutes. Download link provided after completion.

---

## 🖥️ Local Development

### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL="your-mongodb-atlas-url"
DB_NAME="saudasetu"
JWT_SECRET="your-secret-key"
MSG91_AUTH_KEY="your-msg91-key"
MSG91_SENDER_ID="GRPBUY"
MSG91_TEMPLATE_ID="your-template-id"
SMS_ENABLED="false"
EOF

# Run server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend Setup
```bash
cd frontend

# Install dependencies
yarn install

# Create .env file
cat > .env << EOF
EXPO_PUBLIC_BACKEND_URL="https://saudasetu-api.fly.dev"
EOF

# Start Expo
npx expo start
```

---

## 🚀 Deployment (Fly.io)

### Initial Deployment
```bash
cd backend

# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login and deploy
fly auth login
fly launch

# Set secrets
fly secrets set MONGO_URL="your-mongodb-url" \
  DB_NAME="saudasetu" \
  MSG91_AUTH_KEY="your-key" \
  MSG91_SENDER_ID="GRPBUY" \
  MSG91_TEMPLATE_ID="your-template-id" \
  SMS_ENABLED="false" \
  JWT_SECRET="your-secret"
```

### Keep App Always Running
```bash
fly scale count 1 --app saudasetu-api
```

### Useful Commands
```bash
fly status -a saudasetu-api    # Check status
fly logs -a saudasetu-api      # View logs
fly deploy                      # Redeploy
```

---

## 📊 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to phone |
| POST | `/api/auth/verify-otp` | Verify OTP & get token |
| POST | `/api/auth/admin-login` | Admin password login |

### Retailers
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/retailers` | Create/register retailer |
| GET | `/api/retailers/me` | Get current retailer |
| PUT | `/api/retailers/me` | Update retailer profile |
| GET | `/api/retailers/me/zones` | Get retailer's zones |

### Products & Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List all products |
| GET | `/api/categories` | List all categories |
| GET | `/api/suppliers` | List all suppliers |
| POST | `/api/admin/products` | Create product (admin) |
| POST | `/api/admin/categories` | Create category (admin) |

### Offers & Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offers/zone/{zone_id}` | Get zone offers |
| GET | `/api/offers/{offer_id}` | Get offer details |
| POST | `/api/orders` | Place order |
| GET | `/api/orders/me` | Get my orders |
| POST | `/api/admin/offers` | Create offer (admin) |

### Bid Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bid-requests` | Create bid request |
| GET | `/api/bid-requests/me` | Get my bid requests |
| GET | `/api/admin/bid-requests` | List all bids (admin) |
| PUT | `/api/admin/bid-requests/{id}/approve` | Approve bid |
| PUT | `/api/admin/bid-requests/{id}/reject` | Reject bid |

### Fulfillment (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/fulfillment/pending` | Get pending fulfillments |
| PUT | `/api/admin/fulfillment/{id}/status` | Update fulfillment status |

---

## 🗄️ Database Schema (MongoDB)

### Collections
| Collection | Description |
|------------|-------------|
| `retailers` | Retailer profiles with location & zone assignments |
| `zones` | Geographic zones with center coordinates |
| `products` | Product catalog with categories |
| `categories` | Hierarchical product categories |
| `suppliers` | Supplier information |
| `supplier_offers` | Active offers with quantity-based pricing |
| `order_items` | Individual retailer orders |
| `bid_requests` | Product requests from retailers |
| `otp_store` | OTP storage for verification |

---

## 🔧 Environment Variables

### Backend (.env)
```env
# Database
MONGO_URL="mongodb+srv://..."
DB_NAME="saudasetu"

# Authentication
JWT_SECRET="your-secure-secret"

# SMS (MSG91)
MSG91_AUTH_KEY="your-auth-key"
MSG91_SENDER_ID="GRPBUY"
MSG91_TEMPLATE_ID="your-dlt-template-id"
SMS_ENABLED="false"  # Set to "true" after DLT approval
```

### Frontend (.env)
```env
EXPO_PUBLIC_BACKEND_URL="https://saudasetu-api.fly.dev"
```

---

## 📋 Pending Features

| Feature | Status | Notes |
|---------|--------|-------|
| Real SMS OTP | ⏳ Pending | MSG91 DLT registration required |
| Push Notifications | 📋 Planned | For bid status alerts |
| Payment Gateway | 📋 Planned | Integration pending |
| iOS Build | 📋 Planned | Requires Apple Developer account |

---

## 🧪 Testing

### Test OTP Flow
```bash
# Send OTP
curl -X POST https://saudasetu-api.fly.dev/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'

# Response (mock mode)
{"success": true, "otp": "123456", "sms_status": "disabled"}

# Verify OTP
curl -X POST https://saudasetu-api.fly.dev/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "otp": "123456"}'
```

### Test Admin Login
```bash
curl -X POST "https://saudasetu-api.fly.dev/api/auth/admin-login?phone=9999999999&password=Password123"
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `backend/server.py` | All API endpoints and business logic |
| `backend/fly.toml` | Fly.io deployment configuration |
| `backend/Dockerfile` | Container configuration |
| `frontend/app.json` | Expo app configuration |
| `frontend/eas.json` | EAS Build profiles |
| `frontend/src/services/api.ts` | API client service |
| `frontend/src/context/AuthContext.tsx` | Authentication state management |

---

## 🤝 Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile App | React Native + Expo |
| Navigation | Expo Router (file-based) |
| State | React Context API |
| Backend | FastAPI (Python) |
| Database | MongoDB Atlas |
| Hosting | Fly.io |
| SMS | MSG91 |
| Build | EAS Build |

---

## 📞 Credentials for Testing

| Role | Phone | Password/OTP |
|------|-------|--------------|
| Admin | 9999999999 | Password123 |
| Any Retailer | Any 10-digit | 123456 |

---

## 📄 License

This project is licensed under the MIT License.

---

Made with ❤️ for Indian retailers
