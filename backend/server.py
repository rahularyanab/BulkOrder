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
import httpx  # For MSG91 API calls

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
    city: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

# OTP Storage (in production, use Redis)
class OTPStore(BaseModel):
    phone: str
    otp: str
    expires_at: datetime
    attempts: int = 0

# ===================== SUPPLIER MODELS =====================

class Supplier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: str  # HUL, ITC, FORTUNE
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ===================== CATEGORY MODELS =====================

class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None  # For subcategories
    description: Optional[str] = None

class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    parent_id: Optional[str] = None  # None means top-level category
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ===================== PRODUCT MODELS =====================

class ProductCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    barcode: Optional[str] = None
    unit: str  # e.g., "kg", "piece", "pack", "litre"
    category: Optional[str] = None  # Backward compatible - category name as string
    category_id: Optional[str] = None  # Reference to category
    subcategory_id: Optional[str] = None  # Reference to subcategory
    description: Optional[str] = None
    images: Optional[List[str]] = []  # Up to 3 image URLs or base64

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    barcode: Optional[str] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    brand: Optional[str] = None
    barcode: Optional[str] = None
    unit: str
    category: Optional[str] = None  # Backward compatible - category name
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []  # Up to 3 image URLs or base64
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# ===================== BID REQUEST MODELS =====================

class BidRequestCreate(BaseModel):
    product_id: str
    zone_id: str
    requested_quantity: int
    notes: Optional[str] = None

class BidRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    product_name: str
    product_brand: str
    zone_id: str
    zone_name: str
    retailer_id: str
    retailer_name: str
    requested_quantity: int
    notes: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ===================== SUPPLIER OFFER MODELS =====================

class QuantitySlab(BaseModel):
    min_qty: int
    max_qty: Optional[int] = None  # None means unlimited
    price_per_unit: float

class SupplierOfferCreate(BaseModel):
    product_id: str
    supplier_id: str
    zone_id: str
    quantity_slabs: List[QuantitySlab]
    min_fulfillment_qty: int  # Minimum quantity needed to fulfill
    lead_time_days: int  # Delivery lead time in days

class SupplierOfferUpdate(BaseModel):
    quantity_slabs: Optional[List[QuantitySlab]] = None
    min_fulfillment_qty: Optional[int] = None
    lead_time_days: Optional[int] = None
    is_active: Optional[bool] = None

class SupplierOffer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    supplier_id: str
    zone_id: str
    quantity_slabs: List[QuantitySlab]
    min_fulfillment_qty: int
    lead_time_days: int
    current_aggregated_qty: int = 0  # Running total of orders
    status: str = "open"  # open, ready_to_pack, fulfilled
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Response model with joined data
class SupplierOfferWithDetails(BaseModel):
    id: str
    product_id: str
    product_name: str
    product_brand: str
    product_unit: str
    product_category: str  # Category name for display
    product_category_id: Optional[str] = None
    product_category_name: Optional[str] = None
    product_images: List[str] = []
    supplier_id: str
    supplier_name: str
    supplier_code: str
    zone_id: str
    zone_name: str
    quantity_slabs: List[QuantitySlab]
    min_fulfillment_qty: int
    lead_time_days: int
    current_aggregated_qty: int
    status: str
    is_active: bool
    progress_percentage: float  # How close to min fulfillment

# ===================== ORDER MODELS =====================

class OrderItemCreate(BaseModel):
    offer_id: str
    quantity: int

class OrderItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    offer_id: str
    retailer_id: str
    retailer_name: str
    zone_id: str
    product_id: str
    product_name: str
    product_brand: str
    product_unit: str
    supplier_id: str
    supplier_name: str
    supplier_code: str
    quantity: int
    price_per_unit: float  # Price at time of order based on aggregated qty
    total_amount: float
    status: str = "pending"  # pending, ready_to_pack, picked_up, out_for_delivery, delivered
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class OrderItemWithOffer(BaseModel):
    id: str
    offer_id: str
    retailer_id: str
    retailer_name: str
    zone_id: str
    zone_name: str
    product_id: str
    product_name: str
    product_brand: str
    product_unit: str
    supplier_id: str
    supplier_name: str
    supplier_code: str
    quantity: int
    price_per_unit: float
    total_amount: float
    status: str
    offer_status: str
    offer_aggregated_qty: int
    offer_min_fulfillment_qty: int
    offer_progress_percentage: float
    created_at: datetime

# ===================== PAYMENT MODELS =====================

class PaymentMethod(str):
    CASH = "cash"
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"
    CHEQUE = "cheque"

class PaymentCreate(BaseModel):
    order_id: str
    amount: float
    payment_method: str  # cash, upi, bank_transfer, cheque
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    retailer_id: str
    retailer_name: str
    supplier_id: str
    supplier_name: str
    amount: float
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    status: str = "locked"  # locked, released, disputed, refunded
    lock_expires_at: datetime = None  # 48 hours from creation
    dispute_reason: Optional[str] = None
    dispute_raised_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class DisputeCreate(BaseModel):
    payment_id: str
    reason: str

# ===================== PUSH NOTIFICATION MODELS =====================

class PushTokenRegister(BaseModel):
    push_token: str
    is_admin: bool = False

class PushTokenUnregister(BaseModel):
    push_token: str

# Admin phone numbers (in production, store in DB)
ADMIN_PHONES = ["9999999999", "8888888888", "1234567890"]

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

def get_price_for_quantity(slabs: List[dict], quantity: int) -> float:
    """Get price per unit based on quantity and slabs"""
    for slab in slabs:
        min_qty = slab.get("min_qty", 0)
        max_qty = slab.get("max_qty")
        if quantity >= min_qty and (max_qty is None or quantity <= max_qty):
            return slab.get("price_per_unit", 0)
    # Return first slab price as default
    return slabs[0].get("price_per_unit", 0) if slabs else 0

def generate_otp() -> str:
    """Generate 6-digit OTP"""
    # In mock mode (SMS disabled), use fixed OTP for easy testing
    sms_enabled = os.environ.get('SMS_ENABLED', 'false').lower() == 'true'
    if not sms_enabled:
        return '123456'  # Fixed OTP for testing
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

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify user is admin"""
    payload = await get_current_user(credentials)
    phone = payload.get("sub")
    if phone not in ADMIN_PHONES:
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload

# ===================== MSG91 SMS HELPER =====================

async def send_sms_via_msg91(phone: str, otp: str) -> dict:
    """Send OTP via MSG91 API"""
    auth_key = os.environ.get('MSG91_AUTH_KEY', '')
    sender_id = os.environ.get('MSG91_SENDER_ID', 'GRPBUY')
    template_id = os.environ.get('MSG91_TEMPLATE_ID', '')
    
    if not auth_key:
        logger.warning("MSG91 auth key not configured")
        return {"success": False, "error": "SMS service not configured"}
    
    # Format phone number (add country code if not present)
    formatted_phone = phone
    if not phone.startswith('+') and not phone.startswith('91'):
        formatted_phone = f"91{phone}"
    elif phone.startswith('+'):
        formatted_phone = phone[1:]  # Remove + sign
    
    try:
        # MSG91 Send OTP API with template_id
        url = "https://control.msg91.com/api/v5/otp"
        
        params = {
            "authkey": auth_key,
            "mobile": formatted_phone,
            "otp": otp,
            "sender": sender_id,
        }
        
        # Add template_id if available (required for DLT compliance in India)
        if template_id:
            params["template_id"] = template_id
            logger.info(f"Using DLT template: {template_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            result = response.json()
            logger.info(f"MSG91 Response: {result}")
            
            if result.get("type") == "success":
                return {"success": True, "message": "OTP sent via SMS"}
            else:
                error_msg = result.get("message", "SMS sending failed")
                logger.error(f"MSG91 Error: {error_msg}")
                return {"success": False, "error": error_msg}
                    
    except Exception as e:
        logger.error(f"MSG91 API error: {str(e)}")
        return {"success": False, "error": str(e)}

# ===================== EXPO PUSH NOTIFICATION HELPER =====================

async def send_push_notification(push_tokens: List[str], title: str, body: str, data: dict = None):
    """Send push notification via Expo Push API"""
    if not push_tokens:
        return {"success": False, "error": "No push tokens provided"}
    
    messages = []
    for token in push_tokens:
        if not token or not token.startswith("ExponentPushToken"):
            continue
        message = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        messages.append(message)
    
    if not messages:
        return {"success": False, "error": "No valid push tokens"}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                timeout=10.0
            )
            result = response.json()
            logger.info(f"Expo Push Response: {result}")
            return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"Expo Push API error: {str(e)}")
        return {"success": False, "error": str(e)}

async def notify_admins(title: str, body: str, data: dict = None):
    """Send notification to all admin devices"""
    # Get all admin push tokens
    admin_tokens = await db.push_tokens.find({"is_admin": True}).to_list(100)
    tokens = [t["push_token"] for t in admin_tokens if t.get("push_token")]
    if tokens:
        await send_push_notification(tokens, title, body, data)

async def notify_retailer(retailer_id: str, title: str, body: str, data: dict = None):
    """Send notification to a specific retailer"""
    # Get retailer's push tokens
    retailer_tokens = await db.push_tokens.find({"retailer_id": retailer_id}).to_list(10)
    tokens = [t["push_token"] for t in retailer_tokens if t.get("push_token")]
    if tokens:
        await send_push_notification(tokens, title, body, data)

async def notify_zone_retailers(zone_id: str, title: str, body: str, data: dict = None, exclude_retailer_id: str = None):
    """Send notification to all retailers in a zone"""
    # Get all retailers in the zone
    retailers = await db.retailers.find({"zone_ids": zone_id}).to_list(1000)
    retailer_ids = [r["id"] for r in retailers if r["id"] != exclude_retailer_id]
    
    if not retailer_ids:
        return
    
    # Get push tokens for these retailers
    retailer_tokens = await db.push_tokens.find({
        "retailer_id": {"$in": retailer_ids}
    }).to_list(1000)
    tokens = [t["push_token"] for t in retailer_tokens if t.get("push_token")]
    if tokens:
        await send_push_notification(tokens, title, body, data)

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
    
    # Check if SMS is enabled
    sms_enabled = os.environ.get('SMS_ENABLED', 'false').lower() == 'true'
    sms_sent = False
    sms_error = None
    
    if sms_enabled:
        # Send OTP via MSG91
        sms_result = await send_sms_via_msg91(phone, otp)
        sms_sent = sms_result.get("success", False)
        if not sms_sent:
            sms_error = sms_result.get("error", "Unknown error")
            logger.warning(f"SMS sending failed for {phone}: {sms_error}")
    
    # Log OTP (for debugging)
    if not sms_sent:
        logger.info(f"OTP for {phone}: {otp} (SMS not sent: {sms_error or 'disabled'})")
    else:
        logger.info(f"OTP sent via SMS to {phone}")
    
    response = {
        "success": True,
        "message": "OTP sent successfully" if sms_sent else "OTP generated (check logs for testing)"
    }
    
    # Include OTP in response only if SMS was NOT sent (for testing)
    if not sms_sent:
        response["otp"] = otp
        response["sms_status"] = "disabled" if not sms_enabled else f"failed: {sms_error}"
    else:
        response["sms_status"] = "sent"
    
    return response

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

# Admin password login
ADMIN_PHONE = "9999999999"
ADMIN_PASSWORD = "Password123"

@api_router.post("/auth/admin-login")
async def admin_password_login(phone: str, password: str):
    """Admin login with password"""
    if phone != ADMIN_PHONE:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Create admin token
    access_token = create_access_token({"sub": phone, "is_admin": True})
    
    logger.info(f"Admin logged in with password")
    
    return {
        "token": access_token,
        "is_admin": True
    }


# ===================== PUSH NOTIFICATION ENDPOINTS =====================

@api_router.post("/notifications/register")
async def register_push_token(data: PushTokenRegister, user=Depends(get_current_user)):
    """Register a push notification token for the current user"""
    phone = user.get("sub")
    is_admin = user.get("is_admin", False) or data.is_admin
    
    # Get retailer_id if not admin
    retailer_id = None
    if not is_admin:
        retailer = await db.retailers.find_one({"phone": phone})
        if retailer:
            retailer_id = retailer["id"]
    
    # Upsert push token
    await db.push_tokens.update_one(
        {"push_token": data.push_token},
        {
            "$set": {
                "push_token": data.push_token,
                "phone": phone,
                "retailer_id": retailer_id,
                "is_admin": is_admin,
                "updated_at": datetime.utcnow()
            },
            "$setOnInsert": {
                "created_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    
    logger.info(f"Push token registered for {'admin' if is_admin else 'retailer'}: {phone}")
    return {"success": True, "message": "Push token registered"}

@api_router.post("/notifications/unregister")
async def unregister_push_token(data: PushTokenUnregister, user=Depends(get_current_user)):
    """Remove a push notification token"""
    await db.push_tokens.delete_one({"push_token": data.push_token})
    return {"success": True, "message": "Push token removed"}


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
    nearest_zone = None
    min_distance = float('inf')
    
    for zone in zones:
        # Handle both old and new zone data structures
        zone_center = zone.get("center", {})
        if isinstance(zone_center, dict):
            zone_lat = zone_center.get("latitude", 0)
            zone_lng = zone_center.get("longitude", 0)
        else:
            # Skip zones with invalid center data
            continue
            
        distance = haversine_distance(
            retailer.location.latitude,
            retailer.location.longitude,
            zone_lat,
            zone_lng
        )
        # Check if retailer is within this zone's radius
        if distance <= zone.get("radius_km", 5.0):
            applicable_zone_ids.append(zone["id"])
        # Track nearest zone for logging
        if distance < min_distance:
            min_distance = distance
            nearest_zone = zone
    
    # If no zones found within range, create a new zone centered on retailer
    if not applicable_zone_ids:
        # Generate a zone name based on location or shop name
        zone_number = await db.zones.count_documents({}) + 1
        new_zone = Zone(
            name=f"Zone {zone_number}",
            center=retailer.location,
            radius_km=5.0,  # 5km radius for group buying
            retailer_count=1,
            city=retailer_data.address.split(',')[-1].strip() if retailer_data.address else "Unknown"
        )
        await db.zones.insert_one(new_zone.model_dump())
        applicable_zone_ids.append(new_zone.id)
        logger.info(f"Created new zone: {new_zone.name} (5km radius) for retailer {retailer.shop_name}")
        if nearest_zone:
            logger.info(f"Nearest existing zone was {nearest_zone['name']} at {min_distance:.2f}km away")
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

# ===================== CATEGORY ENDPOINTS =====================

@api_router.get("/categories")
async def get_all_categories():
    """Get all categories with subcategories"""
    categories = await db.categories.find({"is_active": True, "parent_id": None}).to_list(100)
    result = []
    for cat in categories:
        cat_dict = {k: v for k, v in cat.items() if k != "_id"}
        # Get subcategories
        subcategories = await db.categories.find({"parent_id": cat["id"], "is_active": True}).to_list(100)
        cat_dict["subcategories"] = [{k: v for k, v in sub.items() if k != "_id"} for sub in subcategories]
        result.append(cat_dict)
    return result

@api_router.get("/categories/{category_id}")
async def get_category(category_id: str):
    """Get category by ID with subcategories"""
    category = await db.categories.find_one({"id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    cat_dict = {k: v for k, v in category.items() if k != "_id"}
    subcategories = await db.categories.find({"parent_id": category_id, "is_active": True}).to_list(100)
    cat_dict["subcategories"] = [{k: v for k, v in sub.items() if k != "_id"} for sub in subcategories]
    return cat_dict

@api_router.post("/admin/categories")
async def create_category(category_data: CategoryCreate, admin=Depends(get_admin_user)):
    """Admin: Create a new category or subcategory"""
    # If parent_id is provided, verify parent exists
    if category_data.parent_id:
        parent = await db.categories.find_one({"id": category_data.parent_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
    
    category = Category(**category_data.model_dump())
    await db.categories.insert_one(category.model_dump())
    return {k: v for k, v in category.model_dump().items()}

@api_router.delete("/admin/categories/{category_id}")
async def delete_category(category_id: str, admin=Depends(get_admin_user)):
    """Admin: Delete a category (soft delete)"""
    result = await db.categories.update_one(
        {"id": category_id},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

# ===================== SUPPLIER ENDPOINTS =====================

@api_router.get("/suppliers", response_model=List[Supplier])
async def get_all_suppliers():
    """Get all active suppliers"""
    suppliers = await db.suppliers.find({"is_active": True}).to_list(100)
    return [Supplier(**s) for s in suppliers]

@api_router.get("/suppliers/{supplier_id}", response_model=Supplier)
async def get_supplier(supplier_id: str):
    """Get supplier by ID"""
    supplier = await db.suppliers.find_one({"id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return Supplier(**supplier)

# ===================== PRODUCT ENDPOINTS =====================

@api_router.get("/products")
async def get_all_products(category_id: Optional[str] = None, category: Optional[str] = None, brand: Optional[str] = None, search: Optional[str] = None):
    """Get all active products with optional filters"""
    query = {"is_active": True}
    if category_id:
        query["category_id"] = category_id
    if category:
        query["category"] = category
    if brand:
        query["brand"] = brand
    
    products = await db.products.find(query).to_list(1000)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        products = [p for p in products if search_lower in p.get("name", "").lower() or search_lower in p.get("brand", "").lower()]
    
    result = []
    for p in products:
        p_dict = {k: v for k, v in p.items() if k != "_id"}
        # Get category name - support both category_id and category string
        if p.get("category_id"):
            cat_doc = await db.categories.find_one({"id": p.get("category_id")})
            p_dict["category_name"] = cat_doc["name"] if cat_doc else p.get("category", "Uncategorized")
        else:
            p_dict["category_name"] = p.get("category", "Uncategorized")
        
        if p.get("subcategory_id"):
            subcategory = await db.categories.find_one({"id": p.get("subcategory_id")})
            p_dict["subcategory_name"] = subcategory["name"] if subcategory else None
        result.append(p_dict)
    
    return result

@api_router.get("/products/categories")
async def get_product_categories():
    """Get all unique product categories"""
    categories = await db.categories.find({"is_active": True, "parent_id": None}).to_list(100)
    return {"categories": [{k: v for k, v in c.items() if k != "_id"} for c in categories]}

@api_router.get("/products/brands")
async def get_product_brands():
    """Get all unique product brands"""
    brands = await db.products.distinct("brand", {"is_active": True})
    return {"brands": brands}

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    """Get product by ID"""
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**product)

# ===================== SUPPLIER OFFER ENDPOINTS =====================

@api_router.get("/offers/zone/{zone_id}")
async def get_zone_offers(zone_id: str, user=Depends(get_current_user), active_only: bool = False, search: Optional[str] = None):
    """Get all active offers for a specific zone with full details"""
    query = {
        "zone_id": zone_id,
        "is_active": True,
        "status": {"$in": ["open", "ready_to_pack"]}
    }
    
    # If active_only, only return offers that have orders (active bids)
    if active_only:
        query["current_aggregated_qty"] = {"$gt": 0}
    
    offers = await db.supplier_offers.find(query).to_list(1000)
    
    result = []
    for offer in offers:
        # Get product details
        product = await db.products.find_one({"id": offer["product_id"]})
        supplier = await db.suppliers.find_one({"id": offer["supplier_id"]})
        zone = await db.zones.find_one({"id": offer["zone_id"]})
        
        if product and supplier and zone:
            # Apply search filter
            if search:
                search_lower = search.lower()
                if search_lower not in product["name"].lower() and search_lower not in product["brand"].lower():
                    continue
            
            progress = (offer["current_aggregated_qty"] / offer["min_fulfillment_qty"]) * 100 if offer["min_fulfillment_qty"] > 0 else 0
            
            # Get category name - support both category_id and category string
            category_name = product.get("category", "Uncategorized")
            if product.get("category_id"):
                category = await db.categories.find_one({"id": product.get("category_id")})
                if category:
                    category_name = category["name"]
            
            result.append(SupplierOfferWithDetails(
                id=offer["id"],
                product_id=offer["product_id"],
                product_name=product["name"],
                product_brand=product["brand"],
                product_unit=product["unit"],
                product_category=category_name,
                product_category_id=product.get("category_id"),
                product_category_name=category_name,
                product_images=product.get("images", []),
                supplier_id=offer["supplier_id"],
                supplier_name=supplier["name"],
                supplier_code=supplier["code"],
                zone_id=offer["zone_id"],
                zone_name=zone["name"],
                quantity_slabs=[QuantitySlab(**slab) for slab in offer["quantity_slabs"]],
                min_fulfillment_qty=offer["min_fulfillment_qty"],
                lead_time_days=offer["lead_time_days"],
                current_aggregated_qty=offer["current_aggregated_qty"],
                status=offer["status"],
                is_active=offer["is_active"],
                progress_percentage=min(progress, 100)
            ))
    
    return result

@api_router.get("/offers/{offer_id}")
async def get_offer_details(offer_id: str, user=Depends(get_current_user)):
    """Get specific offer with full details"""
    offer = await db.supplier_offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    product = await db.products.find_one({"id": offer["product_id"]})
    supplier = await db.suppliers.find_one({"id": offer["supplier_id"]})
    zone = await db.zones.find_one({"id": offer["zone_id"]})
    
    if not all([product, supplier, zone]):
        raise HTTPException(status_code=404, detail="Related data not found")
    
    progress = (offer["current_aggregated_qty"] / offer["min_fulfillment_qty"]) * 100 if offer["min_fulfillment_qty"] > 0 else 0
    
    # Get category name - support both category_id and category string
    category_name = product.get("category", "Uncategorized")
    if product.get("category_id"):
        category = await db.categories.find_one({"id": product.get("category_id")})
        if category:
            category_name = category["name"]
    
    return SupplierOfferWithDetails(
        id=offer["id"],
        product_id=offer["product_id"],
        product_name=product["name"],
        product_brand=product["brand"],
        product_unit=product["unit"],
        product_category=category_name,
        product_category_id=product.get("category_id"),
        product_category_name=category_name,
        product_images=product.get("images", []),
        supplier_id=offer["supplier_id"],
        supplier_name=supplier["name"],
        supplier_code=supplier["code"],
        zone_id=offer["zone_id"],
        zone_name=zone["name"],
        quantity_slabs=[QuantitySlab(**slab) for slab in offer["quantity_slabs"]],
        min_fulfillment_qty=offer["min_fulfillment_qty"],
        lead_time_days=offer["lead_time_days"],
        current_aggregated_qty=offer["current_aggregated_qty"],
        status=offer["status"],
        is_active=offer["is_active"],
        progress_percentage=min(progress, 100)
    )

# ===================== ORDER ENDPOINTS =====================

@api_router.post("/orders")
async def create_order(order_data: OrderItemCreate, user=Depends(get_current_user)):
    """Create a new order item for an offer"""
    phone = user.get("sub")
    retailer = await db.retailers.find_one({"phone": phone})
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    # Get the offer
    offer = await db.supplier_offers.find_one({"id": order_data.offer_id, "is_active": True})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Check if offer is still open
    if offer["status"] not in ["open", "ready_to_pack"]:
        raise HTTPException(status_code=400, detail="This offer is no longer accepting orders")
    
    # Get product and supplier details
    product = await db.products.find_one({"id": offer["product_id"]})
    supplier = await db.suppliers.find_one({"id": offer["supplier_id"]})
    
    if not product or not supplier:
        raise HTTPException(status_code=404, detail="Product or supplier not found")
    
    # Calculate new aggregated quantity
    new_aggregated_qty = offer["current_aggregated_qty"] + order_data.quantity
    
    # Get price based on NEW aggregated quantity (group benefit!)
    price_per_unit = get_price_for_quantity(offer["quantity_slabs"], new_aggregated_qty)
    total_amount = price_per_unit * order_data.quantity
    
    # Create order item
    order_item = OrderItem(
        offer_id=order_data.offer_id,
        retailer_id=retailer["id"],
        retailer_name=retailer["shop_name"],
        zone_id=offer["zone_id"],
        product_id=offer["product_id"],
        product_name=product["name"],
        product_brand=product["brand"],
        product_unit=product["unit"],
        supplier_id=offer["supplier_id"],
        supplier_name=supplier["name"],
        supplier_code=supplier["code"],
        quantity=order_data.quantity,
        price_per_unit=price_per_unit,
        total_amount=total_amount
    )
    
    # Save order item
    await db.order_items.insert_one(order_item.model_dump())
    
    # Update offer's aggregated quantity
    update_data = {
        "current_aggregated_qty": new_aggregated_qty,
        "updated_at": datetime.utcnow()
    }
    
    # Check if min fulfillment qty is met
    if new_aggregated_qty >= offer["min_fulfillment_qty"] and offer["status"] == "open":
        update_data["status"] = "ready_to_pack"
        logger.info(f"Offer {offer['id']} is now ready to pack! Aggregated: {new_aggregated_qty}")
    
    await db.supplier_offers.update_one({"id": order_data.offer_id}, {"$set": update_data})
    
    # Update all existing orders for this offer with new price (group benefit!)
    await db.order_items.update_many(
        {"offer_id": order_data.offer_id},
        {"$set": {"price_per_unit": price_per_unit, "updated_at": datetime.utcnow()}}
    )
    
    # Recalculate total_amount for all orders
    all_orders = await db.order_items.find({"offer_id": order_data.offer_id}).to_list(1000)
    for o in all_orders:
        new_total = o["quantity"] * price_per_unit
        await db.order_items.update_one({"id": o["id"]}, {"$set": {"total_amount": new_total}})
    
    logger.info(f"Order created by {retailer['shop_name']}: {order_data.quantity} {product['unit']} of {product['name']} at ₹{price_per_unit}/{product['unit']}")
    
    # Notify admins about new order (non-blocking)
    try:
        await notify_admins(
            title="🛒 New Order Placed",
            body=f"{retailer['shop_name']} ordered {order_data.quantity} {product['unit']} of {product['name']}",
            data={"type": "new_order", "order_id": order_item.id, "offer_id": order_data.offer_id}
        )
    except Exception as e:
        logger.warning(f"Failed to send order notification to admins: {e}")
    
    # If price dropped due to higher quantity, notify other retailers in zone
    old_price = get_price_for_quantity(offer["quantity_slabs"], offer["current_aggregated_qty"])
    if price_per_unit < old_price and len(all_orders) > 1:
        # Notify other retailers about price drop (non-blocking)
        try:
            await notify_zone_retailers(
                offer["zone_id"],
                title="💰 Price Dropped!",
                body=f"{product['name']} price dropped to ₹{price_per_unit}/{product['unit']}! More retailers joined.",
                data={"type": "price_drop", "offer_id": order_data.offer_id},
                exclude_retailer_id=retailer["id"]
            )
        except Exception as e:
            logger.warning(f"Failed to send price drop notification: {e}")
    
    return {
        "success": True,
        "order_id": order_item.id,
        "quantity": order_data.quantity,
        "price_per_unit": price_per_unit,
        "total_amount": total_amount,
        "new_aggregated_qty": new_aggregated_qty,
        "offer_status": update_data.get("status", offer["status"]),
        "message": f"Order placed successfully! New zone total: {new_aggregated_qty} {product['unit']}"
    }

@api_router.get("/orders/me")
async def get_my_orders(user=Depends(get_current_user)):
    """Get all orders for current retailer"""
    phone = user.get("sub")
    retailer = await db.retailers.find_one({"phone": phone})
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    orders = await db.order_items.find({"retailer_id": retailer["id"]}).sort("created_at", -1).to_list(1000)
    
    result = []
    for order in orders:
        # Get offer details
        offer = await db.supplier_offers.find_one({"id": order["offer_id"]})
        zone = await db.zones.find_one({"id": order["zone_id"]})
        
        if offer and zone:
            progress = (offer["current_aggregated_qty"] / offer["min_fulfillment_qty"]) * 100 if offer["min_fulfillment_qty"] > 0 else 0
            
            result.append(OrderItemWithOffer(
                id=order["id"],
                offer_id=order["offer_id"],
                retailer_id=order["retailer_id"],
                retailer_name=order["retailer_name"],
                zone_id=order["zone_id"],
                zone_name=zone["name"],
                product_id=order["product_id"],
                product_name=order["product_name"],
                product_brand=order["product_brand"],
                product_unit=order["product_unit"],
                supplier_id=order["supplier_id"],
                supplier_name=order["supplier_name"],
                supplier_code=order["supplier_code"],
                quantity=order["quantity"],
                price_per_unit=order["price_per_unit"],
                total_amount=order["total_amount"],
                status=order["status"],
                offer_status=offer["status"],
                offer_aggregated_qty=offer["current_aggregated_qty"],
                offer_min_fulfillment_qty=offer["min_fulfillment_qty"],
                offer_progress_percentage=min(progress, 100),
                created_at=order["created_at"]
            ))
    
    return result

@api_router.get("/orders/{order_id}")
async def get_order_details(order_id: str, user=Depends(get_current_user)):
    """Get specific order details"""
    phone = user.get("sub")
    retailer = await db.retailers.find_one({"phone": phone})
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    order = await db.order_items.find_one({"id": order_id, "retailer_id": retailer["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    offer = await db.supplier_offers.find_one({"id": order["offer_id"]})
    zone = await db.zones.find_one({"id": order["zone_id"]})
    
    if not offer or not zone:
        raise HTTPException(status_code=404, detail="Related data not found")
    
    progress = (offer["current_aggregated_qty"] / offer["min_fulfillment_qty"]) * 100 if offer["min_fulfillment_qty"] > 0 else 0
    
    return OrderItemWithOffer(
        id=order["id"],
        offer_id=order["offer_id"],
        retailer_id=order["retailer_id"],
        retailer_name=order["retailer_name"],
        zone_id=order["zone_id"],
        zone_name=zone["name"],
        product_id=order["product_id"],
        product_name=order["product_name"],
        product_brand=order["product_brand"],
        product_unit=order["product_unit"],
        supplier_id=order["supplier_id"],
        supplier_name=order["supplier_name"],
        supplier_code=order["supplier_code"],
        quantity=order["quantity"],
        price_per_unit=order["price_per_unit"],
        total_amount=order["total_amount"],
        status=order["status"],
        offer_status=offer["status"],
        offer_aggregated_qty=offer["current_aggregated_qty"],
        offer_min_fulfillment_qty=offer["min_fulfillment_qty"],
        offer_progress_percentage=min(progress, 100),
        created_at=order["created_at"]
    )

# ===================== BID REQUEST ENDPOINTS =====================

@api_router.post("/bid-requests")
async def create_bid_request(request_data: BidRequestCreate, user=Depends(get_current_user)):
    """Retailer: Request a bid for a product that doesn't have an active offer"""
    phone = user.get("sub")
    retailer = await db.retailers.find_one({"phone": phone})
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    # Verify product exists
    product = await db.products.find_one({"id": request_data.product_id, "is_active": True})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Verify zone exists and retailer belongs to it
    zone = await db.zones.find_one({"id": request_data.zone_id})
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    
    if request_data.zone_id not in retailer.get("zone_ids", []):
        raise HTTPException(status_code=400, detail="You don't belong to this zone")
    
    # Check if there's already an active offer for this product in this zone
    existing_offer = await db.supplier_offers.find_one({
        "product_id": request_data.product_id,
        "zone_id": request_data.zone_id,
        "is_active": True,
        "status": {"$in": ["open", "ready_to_pack"]}
    })
    
    if existing_offer:
        raise HTTPException(status_code=400, detail="An active offer already exists for this product in your zone. Please join that offer instead.")
    
    # Check if there's already a pending request from this retailer
    existing_request = await db.bid_requests.find_one({
        "product_id": request_data.product_id,
        "zone_id": request_data.zone_id,
        "retailer_id": retailer["id"],
        "status": "pending"
    })
    
    if existing_request:
        raise HTTPException(status_code=400, detail="You already have a pending bid request for this product")
    
    # Create bid request
    bid_request = BidRequest(
        product_id=request_data.product_id,
        product_name=product["name"],
        product_brand=product["brand"],
        zone_id=request_data.zone_id,
        zone_name=zone["name"],
        retailer_id=retailer["id"],
        retailer_name=retailer["shop_name"],
        requested_quantity=request_data.requested_quantity,
        notes=request_data.notes
    )
    
    await db.bid_requests.insert_one(bid_request.model_dump())
    
    logger.info(f"Bid request created by {retailer['shop_name']} for {product['name']} in {zone['name']}")
    
    # Notify admins about new bid request
    await notify_admins(
        title="📥 New Bid Request",
        body=f"{retailer['shop_name']} requested {request_data.requested_quantity} units of {product['name']}",
        data={"type": "bid_request", "request_id": bid_request.id}
    )
    
    return {
        "success": True,
        "request_id": bid_request.id,
        "message": f"Bid request submitted for {product['name']}. Admin will review and create an offer."
    }

@api_router.get("/bid-requests/me")
async def get_my_bid_requests(user=Depends(get_current_user)):
    """Retailer: Get all my bid requests"""
    phone = user.get("sub")
    retailer = await db.retailers.find_one({"phone": phone})
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    requests = await db.bid_requests.find({"retailer_id": retailer["id"]}).sort("created_at", -1).to_list(1000)
    return [{k: v for k, v in r.items() if k != "_id"} for r in requests]

@api_router.get("/admin/bid-requests")
async def get_all_bid_requests(admin=Depends(get_admin_user), status: Optional[str] = None):
    """Admin: Get all bid requests"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.bid_requests.find(query).sort("created_at", -1).to_list(1000)
    return [{k: v for k, v in r.items() if k != "_id"} for r in requests]

@api_router.put("/admin/bid-requests/{request_id}/approve")
async def approve_bid_request(request_id: str, admin=Depends(get_admin_user)):
    """Admin: Approve a bid request (marks as approved, admin should then create an offer)"""
    request = await db.bid_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Bid request not found")
    
    await db.bid_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved"}}
    )
    
    # Notify retailer about approval (non-blocking, ignore errors)
    try:
        await notify_retailer(
            request["retailer_id"],
            title="✅ Bid Approved!",
            body=f"Your bid request for {request.get('product_name', 'product')} has been approved. An offer will be created soon.",
            data={"type": "bid_approved", "request_id": request_id}
        )
    except Exception as e:
        logger.warning(f"Failed to send approval notification: {e}")
    
    return {"success": True, "message": "Bid request approved. Please create an offer for this product."}

@api_router.put("/admin/bid-requests/{request_id}/reject")
async def reject_bid_request(request_id: str, reason: Optional[str] = None, admin=Depends(get_admin_user)):
    """Admin: Reject a bid request"""
    request = await db.bid_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Bid request not found")
    
    await db.bid_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "notes": reason or request.get("notes")}}
    )
    
    # Notify retailer about rejection (non-blocking, ignore errors)
    try:
        rejection_msg = f"Reason: {reason}" if reason else "Contact admin for details."
        await notify_retailer(
            request["retailer_id"],
            title="❌ Bid Rejected",
            body=f"Your bid request for {request.get('product_name', 'product')} was rejected. {rejection_msg}",
            data={"type": "bid_rejected", "request_id": request_id}
        )
    except Exception as e:
        logger.warning(f"Failed to send rejection notification: {e}")
    
    return {"success": True, "message": "Bid request rejected."}

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

# Admin: Supplier Management
@api_router.post("/admin/suppliers", response_model=Supplier)
async def create_supplier(name: str, code: str, description: Optional[str] = None):
    """Admin: Create a new supplier"""
    # Check if supplier code exists
    existing = await db.suppliers.find_one({"code": code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Supplier with this code already exists")
    
    supplier = Supplier(name=name, code=code.upper(), description=description)
    await db.suppliers.insert_one(supplier.model_dump())
    return supplier

# Admin: Product Management
@api_router.post("/admin/products", response_model=Product)
async def create_product(product_data: ProductCreate):
    """Admin: Create a new product"""
    product = Product(**product_data.model_dump())
    await db.products.insert_one(product.model_dump())
    return product

@api_router.put("/admin/products/{product_id}", response_model=Product)
async def update_product(product_id: str, update_data: ProductUpdate):
    """Admin: Update a product"""
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = datetime.utcnow()
        await db.products.update_one({"id": product_id}, {"$set": update_dict})
    
    updated = await db.products.find_one({"id": product_id})
    return Product(**updated)

@api_router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str):
    """Admin: Soft delete a product"""
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

# Admin: Supplier Offer Management
@api_router.post("/admin/offers", response_model=SupplierOffer)
async def create_supplier_offer(offer_data: SupplierOfferCreate):
    """Admin: Create a new supplier offer for a zone"""
    # Validate product exists
    product = await db.products.find_one({"id": offer_data.product_id, "is_active": True})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Validate supplier exists
    supplier = await db.suppliers.find_one({"id": offer_data.supplier_id, "is_active": True})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Validate zone exists
    zone = await db.zones.find_one({"id": offer_data.zone_id, "is_active": True})
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    
    # Check if same offer already exists
    existing = await db.supplier_offers.find_one({
        "product_id": offer_data.product_id,
        "supplier_id": offer_data.supplier_id,
        "zone_id": offer_data.zone_id,
        "status": "open",
        "is_active": True
    })
    if existing:
        raise HTTPException(status_code=400, detail="Active offer already exists for this product/supplier/zone combination")
    
    offer = SupplierOffer(**offer_data.model_dump())
    await db.supplier_offers.insert_one(offer.model_dump())
    
    # Notify all retailers in the zone about new offer
    starting_price = offer_data.quantity_slabs[0]["price"] if offer_data.quantity_slabs else 0
    await notify_zone_retailers(
        offer_data.zone_id,
        title="🎉 New Offer Available!",
        body=f"New offer on {product['name']} starting at ₹{starting_price}/{product['unit']}. Order now to get group discounts!",
        data={"type": "new_offer", "offer_id": offer.id, "product_id": product["id"]}
    )
    
    return offer

@api_router.put("/admin/offers/{offer_id}", response_model=SupplierOffer)
async def update_supplier_offer(offer_id: str, update_data: SupplierOfferUpdate):
    """Admin: Update a supplier offer"""
    offer = await db.supplier_offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    update_dict = {}
    if update_data.quantity_slabs is not None:
        update_dict["quantity_slabs"] = [slab.model_dump() for slab in update_data.quantity_slabs]
    if update_data.min_fulfillment_qty is not None:
        update_dict["min_fulfillment_qty"] = update_data.min_fulfillment_qty
    if update_data.lead_time_days is not None:
        update_dict["lead_time_days"] = update_data.lead_time_days
    if update_data.is_active is not None:
        update_dict["is_active"] = update_data.is_active
    
    if update_dict:
        update_dict["updated_at"] = datetime.utcnow()
        await db.supplier_offers.update_one({"id": offer_id}, {"$set": update_dict})
    
    updated = await db.supplier_offers.find_one({"id": offer_id})
    return SupplierOffer(**updated)

@api_router.get("/admin/offers")
async def get_all_offers(zone_id: Optional[str] = None, supplier_id: Optional[str] = None):
    """Admin: Get all supplier offers with optional filters"""
    query = {}
    if zone_id:
        query["zone_id"] = zone_id
    if supplier_id:
        query["supplier_id"] = supplier_id
    
    offers = await db.supplier_offers.find(query).to_list(1000)
    return [SupplierOffer(**o) for o in offers]

@api_router.post("/admin/orders/create-for-retailer")
async def create_order_for_retailer(retailer_id: str, offer_id: str, quantity: int):
    """Admin: Create an order on behalf of a retailer (used when approving bid requests)"""
    # Validate retailer exists
    retailer = await db.retailers.find_one({"id": retailer_id})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    # Validate offer exists and is open
    offer = await db.supplier_offers.find_one({"id": offer_id, "is_active": True})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["status"] not in ["open", "ready_to_pack"]:
        raise HTTPException(status_code=400, detail="Offer is not accepting orders")
    
    # Get product details
    product = await db.products.find_one({"id": offer["product_id"]})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get supplier details
    supplier = await db.suppliers.find_one({"id": offer["supplier_id"]})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Calculate price based on slabs (using new aggregated quantity)
    new_total_qty = offer["current_aggregated_qty"] + quantity
    price_per_unit = offer["quantity_slabs"][0]["price_per_unit"]  # Default to first slab
    
    for slab in offer["quantity_slabs"]:
        if new_total_qty >= slab["min_qty"] and (slab["max_qty"] is None or new_total_qty <= slab["max_qty"]):
            price_per_unit = slab["price_per_unit"]
            break
    
    # Create the order using OrderItem model with all required fields
    order = OrderItem(
        retailer_id=retailer_id,
        retailer_name=retailer.get("shop_name", retailer.get("phone", "Unknown")),
        offer_id=offer_id,
        zone_id=offer["zone_id"],
        product_id=product["id"],
        product_name=product["name"],
        product_brand=product["brand"],
        product_unit=product["unit"],
        supplier_id=supplier["id"],
        supplier_name=supplier["name"],
        supplier_code=supplier["code"],
        quantity=quantity,
        price_per_unit=price_per_unit,
        total_amount=quantity * price_per_unit,
        status="placed"
    )
    
    await db.order_items.insert_one(order.model_dump())
    
    # Update offer's aggregated quantity
    await db.supplier_offers.update_one(
        {"id": offer_id},
        {"$inc": {"current_aggregated_qty": quantity}}
    )
    
    # Check if minimum fulfillment is reached
    updated_offer = await db.supplier_offers.find_one({"id": offer_id})
    if updated_offer["current_aggregated_qty"] >= updated_offer["min_fulfillment_qty"]:
        await db.supplier_offers.update_one(
            {"id": offer_id},
            {"$set": {"status": "ready_to_pack"}}
        )
    
    # Update all orders for this offer with new price
    await db.order_items.update_many(
        {"offer_id": offer_id, "status": "placed"},
        {"$set": {"price_per_unit": price_per_unit}}
    )
    
    # Recalculate total amount for all orders
    all_orders = await db.order_items.find({"offer_id": offer_id, "status": "placed"}).to_list(1000)
    for o in all_orders:
        new_total = o["quantity"] * price_per_unit
        await db.order_items.update_one(
            {"id": o["id"]},
            {"$set": {"total_amount": new_total}}
        )
    
    logger.info(f"Admin created order for retailer {retailer.get('shop_name', retailer_id)} - {quantity} units at ₹{price_per_unit}")
    
    return {
        "order_id": order.id,
        "price_per_unit": price_per_unit,
        "total_amount": order.total_amount,
        "new_aggregated_qty": updated_offer["current_aggregated_qty"] if updated_offer else new_total_qty,
        "offer_status": updated_offer["status"] if updated_offer else offer["status"]
    }

# ===================== SEED DATA ENDPOINT =====================

@api_router.post("/admin/seed")
async def seed_initial_data():
    """Admin: Seed initial suppliers and sample products"""
    
    # Create suppliers if not exist
    suppliers_data = [
        {"name": "Hindustan Unilever Limited", "code": "HUL", "description": "Leading FMCG company"},
        {"name": "ITC Limited", "code": "ITC", "description": "Diversified conglomerate"},
        {"name": "Fortune", "code": "FORTUNE", "description": "Adani Wilmar - Edible oils and foods"},
    ]
    
    created_suppliers = []
    for s in suppliers_data:
        existing = await db.suppliers.find_one({"code": s["code"]})
        if not existing:
            supplier = Supplier(**s)
            await db.suppliers.insert_one(supplier.model_dump())
            created_suppliers.append(supplier.model_dump())
        else:
            created_suppliers.append(existing)
    
    # Create sample products
    products_data = [
        # HUL Products
        {"name": "Surf Excel Quick Wash", "brand": "Surf Excel", "unit": "kg", "category": "Detergent", "barcode": "8901030705533"},
        {"name": "Vim Dishwash Bar", "brand": "Vim", "unit": "piece", "category": "Cleaning", "barcode": "8901030715253"},
        {"name": "Lifebuoy Total Soap", "brand": "Lifebuoy", "unit": "piece", "category": "Personal Care", "barcode": "8901030725351"},
        {"name": "Clinic Plus Shampoo", "brand": "Clinic Plus", "unit": "ml", "category": "Personal Care", "barcode": "8901030735450"},
        # ITC Products
        {"name": "Aashirvaad Atta", "brand": "Aashirvaad", "unit": "kg", "category": "Grocery", "barcode": "8901063155602"},
        {"name": "Sunfeast Dark Fantasy", "brand": "Sunfeast", "unit": "pack", "category": "Biscuits", "barcode": "8901063165608"},
        {"name": "Bingo Mad Angles", "brand": "Bingo", "unit": "pack", "category": "Snacks", "barcode": "8901063175607"},
        {"name": "Classmate Notebook", "brand": "Classmate", "unit": "piece", "category": "Stationery", "barcode": "8901063185606"},
        # Fortune Products
        {"name": "Fortune Sunflower Oil", "brand": "Fortune", "unit": "litre", "category": "Edible Oil", "barcode": "8901058852349"},
        {"name": "Fortune Soya Chunks", "brand": "Fortune", "unit": "kg", "category": "Grocery", "barcode": "8901058862340"},
        {"name": "Fortune Basmati Rice", "brand": "Fortune", "unit": "kg", "category": "Grocery", "barcode": "8901058872341"},
        {"name": "Fortune Besan", "brand": "Fortune", "unit": "kg", "category": "Grocery", "barcode": "8901058882342"},
    ]
    
    created_products = []
    for p in products_data:
        existing = await db.products.find_one({"name": p["name"], "brand": p["brand"]})
        if not existing:
            product = Product(**p)
            await db.products.insert_one(product.model_dump())
            created_products.append(product.model_dump())
        else:
            created_products.append(existing)
    
    return {
        "message": "Seed data created successfully",
        "suppliers_created": len([s for s in created_suppliers if "id" in s]),
        "products_created": len([p for p in created_products if "id" in p]),
        "suppliers": created_suppliers,
        "products": created_products
    }

# ===================== ADMIN FULFILLMENT ENDPOINTS =====================

@api_router.get("/admin/fulfillment/ready")
async def get_ready_to_pack_offers(admin=Depends(get_admin_user)):
    """Admin: Get all offers ready to pack"""
    offers = await db.supplier_offers.find({
        "status": "ready_to_pack",
        "is_active": True
    }).to_list(1000)
    
    result = []
    for offer in offers:
        product = await db.products.find_one({"id": offer["product_id"]})
        supplier = await db.suppliers.find_one({"id": offer["supplier_id"]})
        zone = await db.zones.find_one({"id": offer["zone_id"]})
        
        # Get all orders for this offer
        orders = await db.order_items.find({"offer_id": offer["id"]}).to_list(1000)
        
        if product and supplier and zone:
            # Convert MongoDB docs to dict and remove _id
            offer_dict = {k: v for k, v in offer.items() if k != "_id"}
            product_dict = {k: v for k, v in product.items() if k != "_id"}
            supplier_dict = {k: v for k, v in supplier.items() if k != "_id"}
            zone_dict = {k: v for k, v in zone.items() if k != "_id"}
            orders_list = [{k: v for k, v in o.items() if k != "_id"} for o in orders]
            
            result.append({
                "offer": offer_dict,
                "product": product_dict,
                "supplier": supplier_dict,
                "zone": zone_dict,
                "orders": orders_list,
                "total_quantity": offer["current_aggregated_qty"],
                "total_retailers": len(set(o["retailer_id"] for o in orders))
            })
    
    return result

@api_router.get("/admin/fulfillment/all")
async def get_all_offers_for_fulfillment(admin=Depends(get_admin_user), status: Optional[str] = None):
    """Admin: Get all offers with optional status filter"""
    query = {"is_active": True}
    if status:
        query["status"] = status
    
    offers = await db.supplier_offers.find(query).sort("updated_at", -1).to_list(1000)
    
    result = []
    for offer in offers:
        product = await db.products.find_one({"id": offer["product_id"]})
        supplier = await db.suppliers.find_one({"id": offer["supplier_id"]})
        zone = await db.zones.find_one({"id": offer["zone_id"]})
        orders = await db.order_items.find({"offer_id": offer["id"]}).to_list(1000)
        
        if product and supplier and zone:
            # Convert MongoDB docs to dict and remove _id
            offer_dict = {k: v for k, v in offer.items() if k != "_id"}
            product_dict = {k: v for k, v in product.items() if k != "_id"}
            supplier_dict = {k: v for k, v in supplier.items() if k != "_id"}
            zone_dict = {k: v for k, v in zone.items() if k != "_id"}
            orders_list = [{k: v for k, v in o.items() if k != "_id"} for o in orders]
            
            result.append({
                "offer": offer_dict,
                "product": product_dict,
                "supplier": supplier_dict,
                "zone": zone_dict,
                "orders": orders_list,
                "total_quantity": offer["current_aggregated_qty"],
                "total_retailers": len(set(o["retailer_id"] for o in orders))
            })
    
    return result

@api_router.put("/admin/fulfillment/offer/{offer_id}/status")
async def update_offer_status(offer_id: str, new_status: str, admin=Depends(get_admin_user)):
    """Admin: Update offer status (picked_up, out_for_delivery, delivered)"""
    valid_statuses = ["open", "ready_to_pack", "picked_up", "out_for_delivery", "delivered"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    offer = await db.supplier_offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Update offer status
    await db.supplier_offers.update_one(
        {"id": offer_id},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )
    
    # Update all orders for this offer
    await db.order_items.update_many(
        {"offer_id": offer_id},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )
    
    logger.info(f"Offer {offer_id} status updated to {new_status}")
    
    # Get product name for notification
    product = await db.products.find_one({"id": offer["product_id"]})
    product_name = product["name"] if product else "your order"
    
    # Send notification to all retailers who ordered from this offer
    orders = await db.order_items.find({"offer_id": offer_id}).to_list(1000)
    retailer_ids = list(set(o["retailer_id"] for o in orders))
    
    # Status-specific notification messages
    status_messages = {
        "ready_to_pack": ("📦 Order Ready", f"Your order for {product_name} is ready to be packed!"),
        "picked_up": ("🚛 Order Picked Up", f"Your order for {product_name} has been picked up for delivery!"),
        "out_for_delivery": ("🚚 Out for Delivery", f"Your order for {product_name} is out for delivery!"),
        "delivered": ("✅ Order Delivered", f"Your order for {product_name} has been delivered!")
    }
    
    if new_status in status_messages:
        title, body = status_messages[new_status]
        for retailer_id in retailer_ids:
            await notify_retailer(
                retailer_id,
                title=title,
                body=body,
                data={"type": "order_status", "offer_id": offer_id, "status": new_status}
            )
    
    return {"success": True, "message": f"Offer status updated to {new_status}"}

@api_router.get("/admin/orders")
async def get_all_orders(admin=Depends(get_admin_user), status: Optional[str] = None, zone_id: Optional[str] = None):
    """Admin: Get all orders with optional filters"""
    query = {}
    if status:
        query["status"] = status
    if zone_id:
        query["zone_id"] = zone_id
    
    orders = await db.order_items.find(query).sort("created_at", -1).to_list(1000)
    return [{k: v for k, v in o.items() if k != "_id"} for o in orders]

# ===================== ADMIN PAYMENT ENDPOINTS =====================

@api_router.post("/admin/payments")
async def record_payment(payment_data: PaymentCreate, admin=Depends(get_admin_user)):
    """Admin: Record payment for an order on delivery"""
    # Get order
    order = await db.order_items.find_one({"id": payment_data.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if payment already exists
    existing_payment = await db.payments.find_one({"order_id": payment_data.order_id})
    if existing_payment:
        raise HTTPException(status_code=400, detail="Payment already recorded for this order")
    
    # Get supplier details
    supplier = await db.suppliers.find_one({"id": order["supplier_id"]})
    
    # Create payment with 48-hour lock
    lock_expires = datetime.utcnow() + timedelta(hours=48)
    
    payment = Payment(
        order_id=payment_data.order_id,
        retailer_id=order["retailer_id"],
        retailer_name=order["retailer_name"],
        supplier_id=order["supplier_id"],
        supplier_name=supplier["name"] if supplier else "Unknown",
        amount=payment_data.amount,
        payment_method=payment_data.payment_method,
        reference_number=payment_data.reference_number,
        notes=payment_data.notes,
        lock_expires_at=lock_expires
    )
    
    await db.payments.insert_one(payment.model_dump())
    
    logger.info(f"Payment recorded: ₹{payment_data.amount} for order {payment_data.order_id}, locked until {lock_expires}")
    
    return {
        "success": True,
        "payment_id": payment.id,
        "lock_expires_at": lock_expires.isoformat(),
        "message": f"Payment of ₹{payment_data.amount} recorded. Locked for 48 hours until {lock_expires.strftime('%Y-%m-%d %H:%M')}"
    }

@api_router.get("/admin/payments")
async def get_all_payments(admin=Depends(get_admin_user), status: Optional[str] = None):
    """Admin: Get all payments with optional status filter"""
    query = {}
    if status:
        query["status"] = status
    
    payments = await db.payments.find(query).sort("created_at", -1).to_list(1000)
    
    # Check and update expired locks
    now = datetime.utcnow()
    for payment in payments:
        if payment["status"] == "locked" and payment.get("lock_expires_at") and payment["lock_expires_at"] < now:
            # Auto-release payment to supplier
            await db.payments.update_one(
                {"id": payment["id"]},
                {"$set": {"status": "released", "released_at": now, "updated_at": now}}
            )
            payment["status"] = "released"
            payment["released_at"] = now
            logger.info(f"Payment {payment['id']} auto-released to supplier")
    
    return payments

@api_router.put("/admin/payments/{payment_id}/release")
async def release_payment(payment_id: str, admin=Depends(get_admin_user)):
    """Admin: Manually release payment to supplier"""
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] not in ["locked"]:
        raise HTTPException(status_code=400, detail=f"Cannot release payment with status: {payment['status']}")
    
    now = datetime.utcnow()
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": "released", "released_at": now, "updated_at": now}}
    )
    
    logger.info(f"Payment {payment_id} manually released to supplier")
    
    return {"success": True, "message": "Payment released to supplier"}

# ===================== RETAILER DISPUTE ENDPOINTS =====================

@api_router.get("/payments/me")
async def get_my_payments(user=Depends(get_current_user)):
    """Retailer: Get all my payments"""
    phone = user.get("sub")
    retailer = await db.retailers.find_one({"phone": phone})
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    payments = await db.payments.find({"retailer_id": retailer["id"]}).sort("created_at", -1).to_list(1000)
    
    # Add time remaining for lock
    now = datetime.utcnow()
    result = []
    for p in payments:
        payment_data = dict(p)
        if p["status"] == "locked" and p.get("lock_expires_at"):
            remaining = (p["lock_expires_at"] - now).total_seconds()
            payment_data["lock_remaining_seconds"] = max(0, remaining)
            payment_data["can_dispute"] = remaining > 0
        else:
            payment_data["lock_remaining_seconds"] = 0
            payment_data["can_dispute"] = False
        result.append(payment_data)
    
    return result

@api_router.post("/payments/dispute")
async def raise_dispute(dispute_data: DisputeCreate, user=Depends(get_current_user)):
    """Retailer: Raise dispute within 48-hour lock window"""
    phone = user.get("sub")
    retailer = await db.retailers.find_one({"phone": phone})
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    payment = await db.payments.find_one({"id": dispute_data.payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Verify retailer owns this payment
    if payment["retailer_id"] != retailer["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to dispute this payment")
    
    # Check if within lock window
    if payment["status"] != "locked":
        raise HTTPException(status_code=400, detail="Can only dispute locked payments")
    
    now = datetime.utcnow()
    if payment.get("lock_expires_at") and now > payment["lock_expires_at"]:
        raise HTTPException(status_code=400, detail="Lock window expired. Cannot raise dispute.")
    
    # Update payment with dispute
    await db.payments.update_one(
        {"id": dispute_data.payment_id},
        {"$set": {
            "status": "disputed",
            "dispute_reason": dispute_data.reason,
            "dispute_raised_at": now,
            "updated_at": now
        }}
    )
    
    logger.info(f"Dispute raised by {retailer['shop_name']} for payment {dispute_data.payment_id}: {dispute_data.reason}")
    
    return {"success": True, "message": "Dispute raised successfully. Admin will review."}

@api_router.put("/admin/payments/{payment_id}/resolve-dispute")
async def resolve_dispute(payment_id: str, resolution: str, refund: bool = False, admin=Depends(get_admin_user)):
    """Admin: Resolve a disputed payment"""
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] != "disputed":
        raise HTTPException(status_code=400, detail="Payment is not disputed")
    
    now = datetime.utcnow()
    new_status = "refunded" if refund else "released"
    
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {
            "status": new_status,
            "released_at": now if not refund else None,
            "notes": f"{payment.get('notes', '')} | Resolution: {resolution}",
            "updated_at": now
        }}
    )
    
    logger.info(f"Dispute for payment {payment_id} resolved: {resolution}, refund={refund}")
    
    return {"success": True, "message": f"Dispute resolved. Payment status: {new_status}"}

# ===================== ADMIN DASHBOARD STATS =====================

@api_router.get("/admin/dashboard/stats")
async def get_dashboard_stats(admin=Depends(get_admin_user)):
    """Admin: Get dashboard statistics"""
    # Count offers by status
    open_offers = await db.supplier_offers.count_documents({"status": "open", "is_active": True})
    ready_offers = await db.supplier_offers.count_documents({"status": "ready_to_pack", "is_active": True})
    delivered_offers = await db.supplier_offers.count_documents({"status": "delivered", "is_active": True})
    
    # Count orders
    total_orders = await db.order_items.count_documents({})
    pending_orders = await db.order_items.count_documents({"status": "pending"})
    delivered_orders = await db.order_items.count_documents({"status": "delivered"})
    
    # Count retailers
    total_retailers = await db.retailers.count_documents({})
    
    # Count zones
    total_zones = await db.zones.count_documents({"is_active": True})
    
    # Payment stats
    total_payments = await db.payments.count_documents({})
    locked_payments = await db.payments.count_documents({"status": "locked"})
    disputed_payments = await db.payments.count_documents({"status": "disputed"})
    
    # Calculate total revenue
    payments = await db.payments.find({}).to_list(10000)
    total_revenue = sum(p.get("amount", 0) for p in payments)
    
    return {
        "offers": {
            "open": open_offers,
            "ready_to_pack": ready_offers,
            "delivered": delivered_offers
        },
        "orders": {
            "total": total_orders,
            "pending": pending_orders,
            "delivered": delivered_orders
        },
        "retailers": total_retailers,
        "zones": total_zones,
        "payments": {
            "total": total_payments,
            "locked": locked_payments,
            "disputed": disputed_payments,
            "total_revenue": total_revenue
        }
    }

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
