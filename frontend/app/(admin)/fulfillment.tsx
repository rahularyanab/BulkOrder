import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/services/api';

interface FulfillmentOffer {
  offer: any;
  product: any;
  supplier: any;
  zone: any;
  orders: any[];
  total_quantity: number;
  total_retailers: number;
}

export default function FulfillmentScreen() {
  const insets = useSafeAreaInsets();
  const [offers, setOffers] = useState<FulfillmentOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<FulfillmentOffer | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ready_to_pack');

  const fetchOffers = async () => {
    try {
      const data = await api.getAllFulfillmentOffers(statusFilter);
      setOffers(data);
    } catch (error) {
      console.error('Failed to fetch offers:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchOffers();
    }, [statusFilter])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOffers();
    setRefreshing(false);
  };

  const updateStatus = async (offerId: string, newStatus: string) => {
    try {
      await api.updateOfferStatus(offerId, newStatus);
      Alert.alert('Success', `Status updated to ${newStatus.replace(/_/g, ' ')}`);
      fetchOffers();
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    }
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
      case 'open': return '#f39c12';
      case 'ready_to_pack': return '#27ae60';
      case 'picked_up': return '#3498db';
      case 'out_for_delivery': return '#9b59b6';
      case 'delivered': return '#2ecc71';
      default: return '#666';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Loading fulfillment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Status Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {['ready_to_pack', 'picked_up', 'out_for_delivery', 'delivered', 'open'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              statusFilter === status && styles.filterChipActive,
              { borderColor: getStatusColor(status) }
            ]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[
              styles.filterText,
              statusFilter === status && styles.filterTextActive
            ]}>
              {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e74c3c" />
        }
      >
        {offers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color="#666" />
            <Text style={styles.emptyTitle}>No Offers</Text>
            <Text style={styles.emptySubtitle}>No offers with this status</Text>
          </View>
        ) : (
          offers.map((item) => (
            <TouchableOpacity
              key={item.offer.id}
              style={styles.offerCard}
              onPress={() => {
                setSelectedOffer(item);
                setModalVisible(true);
              }}
            >
              <View style={styles.offerHeader}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.product.name}</Text>
                  <Text style={styles.productBrand}>{item.product.brand}</Text>
                </View>
                <View style={[styles.supplierBadge, { backgroundColor: getSupplierColor(item.supplier.code) }]}>
                  <Text style={styles.supplierCode}>{item.supplier.code}</Text>
                </View>
              </View>

              <View style={styles.offerStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{item.total_quantity}</Text>
                  <Text style={styles.statLabel}>{item.product.unit}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{item.total_retailers}</Text>
                  <Text style={styles.statLabel}>Retailers</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{item.orders.length}</Text>
                  <Text style={styles.statLabel}>Orders</Text>
                </View>
              </View>

              <View style={styles.offerFooter}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.offer.status) }]}>
                  <Text style={styles.statusText}>
                    {item.offer.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Text>
                </View>
                <Text style={styles.zoneName}>{item.zone.name}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Offer Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            {selectedOffer && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedOffer.product.name}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Offer Details</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Supplier</Text>
                    <Text style={styles.detailValue}>{selectedOffer.supplier.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Zone</Text>
                    <Text style={styles.detailValue}>{selectedOffer.zone.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Quantity</Text>
                    <Text style={styles.detailValue}>{selectedOffer.total_quantity} {selectedOffer.product.unit}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Lead Time</Text>
                    <Text style={styles.detailValue}>{selectedOffer.offer.lead_time_days} days</Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Orders ({selectedOffer.orders.length})</Text>
                  {selectedOffer.orders.map((order: any) => (
                    <View key={order.id} style={styles.orderItem}>
                      <View style={styles.orderInfo}>
                        <Text style={styles.orderRetailer}>{order.retailer_name}</Text>
                        <Text style={styles.orderQty}>{order.quantity} {selectedOffer.product.unit}</Text>
                      </View>
                      <Text style={styles.orderAmount}>Rs. {order.total_amount}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Update Status</Text>
                  <View style={styles.statusButtons}>
                    {selectedOffer.offer.status === 'ready_to_pack' && (
                      <TouchableOpacity
                        style={[styles.statusButton, { backgroundColor: '#3498db' }]}
                        onPress={() => updateStatus(selectedOffer.offer.id, 'picked_up')}
                      >
                        <Ionicons name="cube" size={20} color="#fff" />
                        <Text style={styles.statusButtonText}>Mark Picked Up</Text>
                      </TouchableOpacity>
                    )}
                    {selectedOffer.offer.status === 'picked_up' && (
                      <TouchableOpacity
                        style={[styles.statusButton, { backgroundColor: '#9b59b6' }]}
                        onPress={() => updateStatus(selectedOffer.offer.id, 'out_for_delivery')}
                      >
                        <Ionicons name="car" size={20} color="#fff" />
                        <Text style={styles.statusButtonText}>Out for Delivery</Text>
                      </TouchableOpacity>
                    )}
                    {selectedOffer.offer.status === 'out_for_delivery' && (
                      <TouchableOpacity
                        style={[styles.statusButton, { backgroundColor: '#27ae60' }]}
                        onPress={() => updateStatus(selectedOffer.offer.id, 'delivered')}
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.statusButtonText}>Mark Delivered</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  filterScroll: {
    maxHeight: 56,
    paddingVertical: 8,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderColor: '#e74c3c',
  },
  filterText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#a0a0a0',
    fontSize: 14,
    marginTop: 8,
  },
  offerCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  productBrand: {
    color: '#a0a0a0',
    fontSize: 14,
    marginTop: 2,
  },
  supplierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  supplierCode: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  offerStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#a0a0a0',
    fontSize: 12,
  },
  offerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  zoneName: {
    color: '#666',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  detailLabel: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  detailValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  orderInfo: {
    flex: 1,
  },
  orderRetailer: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  orderQty: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 2,
  },
  orderAmount: {
    color: '#27ae60',
    fontSize: 14,
    fontWeight: '600',
  },
  statusButtons: {
    gap: 8,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
