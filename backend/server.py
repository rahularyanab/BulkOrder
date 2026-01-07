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

# ===================== SUPPLIER MODELS =====================

class Supplier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: str  # HUL, ITC, FORTUNE
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ===================== PRODUCT MODELS =====================

class ProductCreate(BaseModel):
    name: str
    brand: str
    barcode: Optional[str] = None
    unit: str  # e.g., "kg", "piece", "pack", "litre"
    category: str
    description: Optional[str] = None
    image_base64: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    barcode: Optional[str] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    image_base64: Optional[str] = None

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    brand: str
    barcode: Optional[str] = None
    unit: str
    category: str
    description: Optional[str] = None
    image_base64: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

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
    product_category: str
    product_image: Optional[str] = None
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

@api_router.get("/products", response_model=List[Product])
async def get_all_products(category: Optional[str] = None, brand: Optional[str] = None):
    """Get all active products with optional filters"""
    query = {"is_active": True}
    if category:
        query["category"] = category
    if brand:
        query["brand"] = brand
    
    products = await db.products.find(query).to_list(1000)
    return [Product(**p) for p in products]

@api_router.get("/products/categories")
async def get_product_categories():
    """Get all unique product categories"""
    categories = await db.products.distinct("category", {"is_active": True})
    return {"categories": categories}

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
async def get_zone_offers(zone_id: str, user=Depends(get_current_user)):
    """Get all active offers for a specific zone with full details"""
    offers = await db.supplier_offers.find({
        "zone_id": zone_id,
        "is_active": True,
        "status": {"$in": ["open", "ready_to_pack"]}
    }).to_list(1000)
    
    result = []
    for offer in offers:
        # Get product details
        product = await db.products.find_one({"id": offer["product_id"]})
        supplier = await db.suppliers.find_one({"id": offer["supplier_id"]})
        zone = await db.zones.find_one({"id": offer["zone_id"]})
        
        if product and supplier and zone:
            progress = (offer["current_aggregated_qty"] / offer["min_fulfillment_qty"]) * 100 if offer["min_fulfillment_qty"] > 0 else 0
            
            result.append(SupplierOfferWithDetails(
                id=offer["id"],
                product_id=offer["product_id"],
                product_name=product["name"],
                product_brand=product["brand"],
                product_unit=product["unit"],
                product_category=product["category"],
                product_image=product.get("image_base64"),
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
    
    return SupplierOfferWithDetails(
        id=offer["id"],
        product_id=offer["product_id"],
        product_name=product["name"],
        product_brand=product["brand"],
        product_unit=product["unit"],
        product_category=product["category"],
        product_image=product.get("image_base64"),
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
