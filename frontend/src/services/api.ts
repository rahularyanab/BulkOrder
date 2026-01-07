import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
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

  // Health check
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const api = new ApiService();
