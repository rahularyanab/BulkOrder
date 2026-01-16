import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';

// Get backend URL from app.json extra config or environment variable
const BASE_URL = Constants.expoConfig?.extra?.backendUrl || 
                 process.env.EXPO_PUBLIC_BACKEND_URL || 
                 'https://saudasetu-api.fly.dev';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    console.log('API Base URL:', BASE_URL);
    this.client = axios.create({
      baseURL: `${BASE_URL}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  setToken(token: string | null) {
    this.token = token;
  }

  // Auth endpoints
  async sendOTP(phone: string) {
    const response = await this.client.post('/auth/send-otp', { phone });
    return response.data;
  }

  async verifyOTP(phone: string, otp: string) {
    const response = await this.client.post('/auth/verify-otp', { phone, otp });
    return response.data;
  }

  async adminPasswordLogin(phone: string, password: string) {
    const response = await this.client.post(`/auth/admin-login?phone=${phone}&password=${encodeURIComponent(password)}`);
    return response.data;
  }

  // Retailer endpoints
  async createRetailer(data: {
    shop_name: string;
    owner_name: string;
    phone: string;
    address: string;
    location: { latitude: number; longitude: number };
  }) {
    const response = await this.client.post('/retailers', data);
    return response.data;
  }

  async getCurrentRetailer() {
    const response = await this.client.get('/retailers/me');
    return response.data;
  }

  async updateRetailer(data: {
    shop_name?: string;
    owner_name?: string;
    address?: string;
    location?: { latitude: number; longitude: number };
  }) {
    const response = await this.client.put('/retailers/me', data);
    return response.data;
  }

  // Zone endpoints
  async getAllZones() {
    const response = await this.client.get('/zones');
    return response.data;
  }

  async getRetailerZones() {
    const response = await this.client.get('/retailers/me/zones');
    return response.data;
  }

  // Supplier endpoints
  async getSuppliers() {
    const response = await this.client.get('/suppliers');
    return response.data;
  }

  // Product endpoints
  async getProducts(category?: string, brand?: string) {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (brand) params.append('brand', brand);
    const response = await this.client.get(`/products?${params.toString()}`);
    return response.data;
  }

  async getProductCategories() {
    const response = await this.client.get('/products/categories');
    return response.data;
  }

  async getProductBrands() {
    const response = await this.client.get('/products/brands');
    return response.data;
  }

  // Admin product management
  async createProduct(data: {
    name: string;
    brand: string;
    barcode?: string;
    unit: string;
    category: string;
    description?: string;
    images?: string[];  // Up to 3 image URLs or base64
  }) {
    const response = await this.client.post('/admin/products', data);
    return response.data;
  }

  // Admin update product
  async updateProduct(productId: string, data: {
    name?: string;
    brand?: string;
    barcode?: string;
    unit?: string;
    category?: string;
    description?: string;
    images?: string[];
  }) {
    const response = await this.client.put(`/admin/products/${productId}`, data);
    return response.data;
  }

  // Admin offer management  
  async createOffer(data: {
    product_id: string;
    supplier_id: string;
    zone_id: string;
    quantity_slabs: Array<{ min_qty: number; max_qty: number | null; price_per_unit: number }>;
    min_fulfillment_qty: number;
    lead_time_days: number;
  }) {
    const response = await this.client.post('/admin/offers', data);
    return response.data;
  }

  // Category endpoints
  async getCategories() {
    const response = await this.client.get('/categories');
    return response.data;
  }

  async createCategory(data: { name: string; parent_id?: string; description?: string }) {
    const response = await this.client.post('/admin/categories', data);
    return response.data;
  }

  async deleteCategory(categoryId: string) {
    const response = await this.client.delete(`/admin/categories/${categoryId}`);
    return response.data;
  }

  // Bid Request endpoints
  async createBidRequest(data: { product_id: string; zone_id: string; requested_quantity: number; notes?: string }) {
    const response = await this.client.post('/bid-requests', data);
    return response.data;
  }

  async getMyBidRequests() {
    const response = await this.client.get('/bid-requests/me');
    return response.data;
  }

  async getAdminBidRequests(status?: string) {
    const params = status ? `?status=${status}` : '';
    const response = await this.client.get(`/admin/bid-requests${params}`);
    return response.data;
  }

  async approveBidRequest(requestId: string) {
    const response = await this.client.put(`/admin/bid-requests/${requestId}/approve`);
    return response.data;
  }

  async rejectBidRequest(requestId: string, reason?: string) {
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    const response = await this.client.put(`/admin/bid-requests/${requestId}/reject${params}`);
    return response.data;
  }

  async createOrderForRetailer(retailerId: string, offerId: string, quantity: number) {
    const response = await this.client.post(`/admin/orders/create-for-retailer?retailer_id=${retailerId}&offer_id=${offerId}&quantity=${quantity}`);
    return response.data;
  }

  // Offer endpoints
  async getZoneOffers(zoneId: string) {
    const response = await this.client.get(`/offers/zone/${zoneId}`);
    return response.data;
  }

  async getOfferDetails(offerId: string) {
    const response = await this.client.get(`/offers/${offerId}`);
    return response.data;
  }

  // Order endpoints
  async createOrder(offerId: string, quantity: number) {
    const response = await this.client.post('/orders', { offer_id: offerId, quantity });
    return response.data;
  }

  async getMyOrders() {
    const response = await this.client.get('/orders/me');
    return response.data;
  }

  async getOrderDetails(orderId: string) {
    const response = await this.client.get(`/orders/${orderId}`);
    return response.data;
  }

  // Payment endpoints (retailer)
  async getMyPayments() {
    const response = await this.client.get('/payments/me');
    return response.data;
  }

  async raiseDispute(paymentId: string, reason: string) {
    const response = await this.client.post('/payments/dispute', { payment_id: paymentId, reason });
    return response.data;
  }

  // Admin endpoints
  async getAdminDashboardStats() {
    const response = await this.client.get('/admin/dashboard/stats');
    return response.data;
  }

  async getReadyToPackOffers() {
    const response = await this.client.get('/admin/fulfillment/ready');
    return response.data;
  }

  async getAllFulfillmentOffers(status?: string) {
    const params = status ? `?status=${status}` : '';
    const response = await this.client.get(`/admin/fulfillment/all${params}`);
    return response.data;
  }

  async updateOfferStatus(offerId: string, newStatus: string) {
    const response = await this.client.put(`/admin/fulfillment/offer/${offerId}/status?new_status=${newStatus}`);
    return response.data;
  }

  async getAdminOrders(status?: string, zoneId?: string) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (zoneId) params.append('zone_id', zoneId);
    const response = await this.client.get(`/admin/orders?${params.toString()}`);
    return response.data;
  }

  async recordPayment(orderId: string, amount: number, paymentMethod: string, referenceNumber?: string, notes?: string) {
    const response = await this.client.post('/admin/payments', {
      order_id: orderId,
      amount,
      payment_method: paymentMethod,
      reference_number: referenceNumber,
      notes
    });
    return response.data;
  }

  async getAdminPayments(status?: string) {
    const params = status ? `?status=${status}` : '';
    const response = await this.client.get(`/admin/payments${params}`);
    return response.data;
  }

  async releasePayment(paymentId: string) {
    const response = await this.client.put(`/admin/payments/${paymentId}/release`);
    return response.data;
  }

  async resolveDispute(paymentId: string, resolution: string, refund: boolean) {
    const response = await this.client.put(`/admin/payments/${paymentId}/resolve-dispute?resolution=${encodeURIComponent(resolution)}&refund=${refund}`);
    return response.data;
  }

  // Health check
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Push Notifications
  async savePushToken(token: string, isAdmin: boolean = false) {
    const response = await this.client.post('/notifications/register', { 
      push_token: token,
      is_admin: isAdmin 
    });
    return response.data;
  }

  async removePushToken(token: string) {
    const response = await this.client.post('/notifications/unregister', { push_token: token });
    return response.data;
  }
}

export const api = new ApiService();
