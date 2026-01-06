from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import random
import string
import jwt
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

# Create the main app
app = FastAPI(title="GroupBuy Retail API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===================== MODELS =====================

# Auth Models
class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    otp: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool
    retailer_id: Optional[str] = None

# Retailer Models
class Location(BaseModel):
    latitude: float
    longitude: float

class RetailerCreate(BaseModel):
    shop_name: str
    owner_name: str
    phone: str
    address: str
    location: Location

class RetailerUpdate(BaseModel):
    shop_name: Optional[str] = None
    owner_name: Optional[str] = None
    address: Optional[str] = None
    location: Optional[Location] = None

class Retailer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shop_name: str
    owner_name: str
    phone: str
    address: str
    location: Location
    zone_ids: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Zone Models
class ZoneCreate(BaseModel):
    name: str
    center: Location
    radius_km: float = 5.0

class Zone(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    center: Location
    radius_km: float = 5.0
    retailer_count: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

# OTP Storage (in production, use Redis)
class OTPStore(BaseModel):
    phone: str
    otp: str
    expires_at: datetime
    attempts: int = 0

# ===================== UTILITIES =====================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in km using Haversine formula"""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def generate_otp() -> str:
    """Generate 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        phone = payload.get("sub")
        if phone is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ===================== AUTH ENDPOINTS =====================

@api_router.post("/auth/send-otp")
async def send_otp(request: OTPRequest):
    """Send OTP to phone number"""
    phone = request.phone.strip()
    
    # Validate phone
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    # Generate OTP
    otp = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Store OTP (replace existing)
    await db.otp_store.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "otp": otp, "expires_at": expires_at, "attempts": 0}},
        upsert=True
    )
    
    # In production, send SMS here. For MVP, log OTP
    logger.info(f"OTP for {phone}: {otp}")
    
    return {
        "success": True,
        "message": "OTP sent successfully",
        "otp": otp  # Remove in production! For testing only
    }

@api_router.post("/auth/verify-otp", response_model=TokenResponse)
async def verify_otp(request: OTPVerify):
    """Verify OTP and return JWT token"""
    phone = request.phone.strip()
    
    # Find OTP record
    otp_record = await db.otp_store.find_one({"phone": phone})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new one.")
    
    # Check expiry
    if datetime.utcnow() > otp_record["expires_at"]:
        await db.otp_store.delete_one({"phone": phone})
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    # Check attempts
    if otp_record["attempts"] >= 5:
        await db.otp_store.delete_one({"phone": phone})
        raise HTTPException(status_code=400, detail="Too many attempts. Please request a new OTP.")
    
    # Verify OTP
    if otp_record["otp"] != request.otp:
        await db.otp_store.update_one({"phone": phone}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # OTP verified - delete it
    await db.otp_store.delete_one({"phone": phone})
    
    # Check if retailer exists
    retailer = await db.retailers.find_one({"phone": phone})
    is_new_user = retailer is None
    retailer_id = retailer["id"] if retailer else None
    
    # Create token
    access_token = create_access_token({"sub": phone, "retailer_id": retailer_id})
    
    return TokenResponse(
        access_token=access_token,
        is_new_user=is_new_user,
        retailer_id=retailer_id
    )

# ===================== RETAILER ENDPOINTS =====================

@api_router.post("/retailers", response_model=Retailer)
async def create_retailer(retailer_data: RetailerCreate, user=Depends(get_current_user)):
    """Create a new retailer (during signup)"""
    phone = user.get("sub")
    
    # Check if retailer already exists
    existing = await db.retailers.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="Retailer already registered with this phone")
    
    # Validate phone matches token
    if retailer_data.phone != phone:
        raise HTTPException(status_code=400, detail="Phone number mismatch")
    
    # Create retailer
    retailer = Retailer(**retailer_data.model_dump())
    
    # Find zones within 5km radius
    zones = await db.zones.find({"is_active": True}).to_list(1000)
    applicable_zone_ids = []
    
    for zone in zones:
        distance = haversine_distance(
            retailer.location.latitude,
            retailer.location.longitude,
            zone["center"]["latitude"],
            zone["center"]["longitude"]
        )
        if distance <= zone["radius_km"]:
            applicable_zone_ids.append(zone["id"])
    
    # If no zones found, create a new zone centered on retailer
    if not applicable_zone_ids:
        new_zone = Zone(
            name=f"Zone-{retailer.shop_name[:10]}",
            center=retailer.location,
            radius_km=5.0,
            retailer_count=1
        )
        await db.zones.insert_one(new_zone.model_dump())
        applicable_zone_ids.append(new_zone.id)
        logger.info(f"Created new zone: {new_zone.name} for retailer {retailer.shop_name}")
    else:
        # Update retailer count in applicable zones
        await db.zones.update_many(
            {"id": {"$in": applicable_zone_ids}},
            {"$inc": {"retailer_count": 1}}
        )
    
    retailer.zone_ids = applicable_zone_ids
    
    # Save retailer
    await db.retailers.insert_one(retailer.model_dump())
    
    logger.info(f"Retailer {retailer.shop_name} registered in zones: {applicable_zone_ids}")
    
    return retailer

@api_router.get("/retailers/me", response_model=Retailer)
async def get_current_retailer(user=Depends(get_current_user)):
    """Get current logged-in retailer's details"""
    phone = user.get("sub")
    retailer = await db.retailers.find_one({"phone": phone})
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    return Retailer(**retailer)

@api_router.put("/retailers/me", response_model=Retailer)
async def update_retailer(update_data: RetailerUpdate, user=Depends(get_current_user)):
    """Update current retailer's details"""
    phone = user.get("sub")
    retailer = await db.retailers.find_one({"phone": phone})
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = datetime.utcnow()
        await db.retailers.update_one({"phone": phone}, {"$set": update_dict})
    
    updated = await db.retailers.find_one({"phone": phone})
    return Retailer(**updated)

# ===================== ZONE ENDPOINTS =====================

@api_router.get("/zones", response_model=List[Zone])
async def get_all_zones():
    """Get all active zones"""
    zones = await db.zones.find({"is_active": True}).to_list(1000)
    return [Zone(**zone) for zone in zones]

@api_router.get("/retailers/me/zones", response_model=List[Zone])
async def get_retailer_zones(user=Depends(get_current_user)):
    """Get zones for current retailer"""
    phone = user.get("sub")
    retailer = await db.retailers.find_one({"phone": phone})
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    zones = await db.zones.find({"id": {"$in": retailer.get("zone_ids", [])}}).to_list(100)
    return [Zone(**zone) for zone in zones]

# ===================== ADMIN ENDPOINTS =====================

@api_router.post("/admin/zones", response_model=Zone)
async def create_zone(zone_data: ZoneCreate):
    """Admin: Create a new zone"""
    zone = Zone(**zone_data.model_dump())
    await db.zones.insert_one(zone.model_dump())
    return zone

@api_router.get("/admin/retailers", response_model=List[Retailer])
async def get_all_retailers():
    """Admin: Get all retailers"""
    retailers = await db.retailers.find({}).to_list(1000)
    return [Retailer(**r) for r in retailers]

# ===================== HEALTH CHECK =====================

@api_router.get("/")
async def root():
    return {"message": "GroupBuy Retail API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
