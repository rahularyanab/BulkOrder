import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/services/api';

interface OrderItem {
  id: string;
  offer_id: string;
  retailer_id: string;
  retailer_name: string;
  zone_id: string;
  zone_name: string;
  product_id: string;
  product_name: string;
  product_brand: string;
  product_unit: string;
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  quantity: number;
  price_per_unit: number;
  total_amount: number;
  status: string;
  offer_status: string;
  offer_aggregated_qty: number;
  offer_min_fulfillment_qty: number;
  offer_progress_percentage: number;
  created_at: string;
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    try {
      const data = await api.getMyOrders();
      setOrders(data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch orders when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const getSupplierColor = (code: string) => {
    switch (code) {
      case 'HUL': return '#0066cc';
      case 'ITC': return '#cc6600';
      case 'FORTUNE': return '#006633';
      default: return '#6c5ce7';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f39c12';
      case 'ready_to_pack': return '#27ae60';
      case 'picked_up': return '#3498db';
      case 'out_for_delivery': return '#9b59b6';
      case 'delivered': return '#2ecc71';
      default: return '#666';
    }
  };

  const getStatusLabel = (orderStatus: string, offerStatus: string) => {
    if (offerStatus === 'open') return 'Aggregating';
    if (offerStatus === 'ready_to_pack') return 'Ready to Pack';
    return orderStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6c5ce7" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />
        }
      >
        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={80} color="#666" />
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptySubtitle}>
              Your orders will appear here once you start ordering from the catalog.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Your Orders ({orders.length})</Text>
            {orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.productInfo}>
                    <View style={styles.productIcon}>
                      <Ionicons name="cube" size={20} color="#6c5ce7" />
                    </View>
                    <View style={styles.productDetails}>
                      <Text style={styles.productName}>{order.product_name}</Text>
                      <Text style={styles.productBrand}>{order.product_brand}</Text>
                    </View>
                  </View>
                  <View style={[styles.supplierBadge, { backgroundColor: getSupplierColor(order.supplier_code) }]}>
                    <Text style={styles.supplierCode}>{order.supplier_code}</Text>
                  </View>
                </View>

                <View style={styles.orderDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Your Quantity</Text>
                    <Text style={styles.detailValue}>{order.quantity} {order.product_unit}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Price per Unit</Text>
                    <Text style={styles.detailValue}>₹{order.price_per_unit}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Your Total</Text>
                    <Text style={styles.totalValue}>₹{order.total_amount}</Text>
                  </View>
                </View>

                {/* Zone Progress */}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>
                      Zone Total: {order.offer_aggregated_qty}/{order.offer_min_fulfillment_qty} {order.product_unit}
                    </Text>
                    <Text style={styles.progressPercent}>{Math.round(order.offer_progress_percentage)}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(order.offer_progress_percentage, 100)}%` },
                        order.offer_progress_percentage >= 100 && styles.progressBarComplete,
                      ]}
                    />
                  </View>
                </View>

                {/* Status Badge */}
                <View style={styles.statusRow}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.offer_status) }]}>
                    <Ionicons
                      name={order.offer_status === 'ready_to_pack' ? 'checkmark-circle' : 'time'}
                      size={14}
                      color="#fff"
                    />
                    <Text style={styles.statusText}>
                      {getStatusLabel(order.status, order.offer_status)}
                    </Text>
                  </View>
                  <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                </View>

                {/* Zone Info */}
                <View style={styles.zoneInfo}>
                  <Ionicons name="location-outline" size={14} color="#666" />
                  <Text style={styles.zoneText}>{order.zone_name}</Text>
                </View>
              </View>
            ))}
          </>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#a0a0a0',
    marginTop: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
  },
  emptySubtitle: {
    color: '#a0a0a0',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  orderCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  productIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productDetails: {
    marginLeft: 12,
    flex: 1,
  },
  productName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  productBrand: {
    color: '#a0a0a0',
    fontSize: 13,
    marginTop: 2,
  },
  supplierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  supplierCode: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  orderDetails: {
    marginTop: 16,
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    color: '#a0a0a0',
    fontSize: 13,
  },
  detailValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  totalValue: {
    color: '#27ae60',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressSection: {
    marginTop: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: '#a0a0a0',
    fontSize: 12,
  },
  progressPercent: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#2d2d44',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6c5ce7',
    borderRadius: 3,
  },
  progressBarComplete: {
    backgroundColor: '#27ae60',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderDate: {
    color: '#666',
    fontSize: 11,
  },
  zoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  zoneText: {
    color: '#666',
    fontSize: 12,
  },
});
