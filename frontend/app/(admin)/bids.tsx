import React, { useState, useCallback } from 'react';
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

interface BidRequest {
  id: string;
  retailer_id: string;
  retailer_name?: string;
  retailer_shop?: string;
  product_id: string;
  product_name?: string;
  product_brand?: string;
  zone_id: string;
  zone_name?: string;
  requested_quantity: number;
  notes?: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
}

export default function AdminBidsScreen() {
  const insets = useSafeAreaInsets();
  const [bidRequests, setBidRequests] = useState<BidRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('pending');
  const [selectedBid, setSelectedBid] = useState<BidRequest | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBidRequests = async () => {
    try {
      const data = await api.getAdminBidRequests(activeFilter !== 'all' ? activeFilter : undefined);
      setBidRequests(data);
    } catch (error) {
      console.error('Failed to fetch bid requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBidRequests();
    }, [activeFilter])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBidRequests();
    setRefreshing(false);
  };

  const handleApprove = async (bidId: string) => {
    Alert.alert(
      'Approve Bid Request',
      'This will mark the bid request as approved. You should then create an offer for this product in the zone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.approveBidRequest(bidId);
              Alert.alert('Success', 'Bid request approved! Now create an offer for this product.');
              setDetailModalVisible(false);
              fetchBidRequests();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to approve bid request');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (bidId: string) => {
    Alert.prompt(
      'Reject Bid Request',
      'Enter a reason for rejection (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason?: string) => {
            setActionLoading(true);
            try {
              await api.rejectBidRequest(bidId, reason);
              Alert.alert('Success', 'Bid request rejected.');
              setDetailModalVisible(false);
              fetchBidRequests();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to reject bid request');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f39c12';
      case 'approved': return '#27ae60';
      case 'rejected': return '#e74c3c';
      default: return '#666';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'time';
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      default: return 'help-circle';
    }
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

  const openDetailModal = (bid: BidRequest) => {
    setSelectedBid(bid);
    setDetailModalVisible(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Loading bid requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['pending', 'approved', 'rejected', 'all'].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e74c3c" />
        }
      >
        {bidRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="hand-left-outline" size={64} color="#666" />
            <Text style={styles.emptyTitle}>No Bid Requests</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'pending'
                ? 'No pending bid requests from retailers'
                : `No ${activeFilter} bid requests found`}
            </Text>
          </View>
        ) : (
          bidRequests.map((bid) => (
            <TouchableOpacity
              key={bid.id}
              style={styles.bidCard}
              onPress={() => openDetailModal(bid)}
            >
              <View style={styles.bidHeader}>
                <View style={styles.bidInfo}>
                  <Text style={styles.productName}>{bid.product_name || 'Unknown Product'}</Text>
                  <Text style={styles.productBrand}>{bid.product_brand}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(bid.status) + '20' }]}>
                  <Ionicons name={getStatusIcon(bid.status) as any} size={14} color={getStatusColor(bid.status)} />
                  <Text style={[styles.statusText, { color: getStatusColor(bid.status) }]}>
                    {bid.status}
                  </Text>
                </View>
              </View>

              <View style={styles.bidDetails}>
                <View style={styles.detailItem}>
                  <Ionicons name="storefront" size={14} color="#666" />
                  <Text style={styles.detailText}>{bid.retailer_shop || bid.retailer_name || 'Unknown Retailer'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="location" size={14} color="#666" />
                  <Text style={styles.detailText}>{bid.zone_name || 'Unknown Zone'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="cube" size={14} color="#666" />
                  <Text style={styles.detailText}>Qty: {bid.requested_quantity}</Text>
                </View>
              </View>

              {bid.notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Notes:</Text>
                  <Text style={styles.notesText} numberOfLines={2}>{bid.notes}</Text>
                </View>
              )}

              <Text style={styles.dateText}>{formatDate(bid.created_at)}</Text>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            {selectedBid && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Bid Request Details</Text>
                  <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusColor(selectedBid.status) + '20' }]}>
                  <Ionicons name={getStatusIcon(selectedBid.status) as any} size={20} color={getStatusColor(selectedBid.status)} />
                  <Text style={[styles.statusTextLarge, { color: getStatusColor(selectedBid.status) }]}>
                    {selectedBid.status.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Product</Text>
                  <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Name</Text>
                      <Text style={styles.detailValue}>{selectedBid.product_name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Brand</Text>
                      <Text style={styles.detailValue}>{selectedBid.product_brand}</Text>
                    </View>
                    <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                      <Text style={styles.detailLabel}>Requested Qty</Text>
                      <Text style={styles.detailValueHighlight}>{selectedBid.requested_quantity}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Retailer</Text>
                  <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Shop</Text>
                      <Text style={styles.detailValue}>{selectedBid.retailer_shop || 'N/A'}</Text>
                    </View>
                    <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                      <Text style={styles.detailLabel}>Zone</Text>
                      <Text style={styles.detailValue}>{selectedBid.zone_name}</Text>
                    </View>
                  </View>
                </View>

                {selectedBid.notes && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Notes from Retailer</Text>
                    <View style={styles.notesCard}>
                      <Text style={styles.notesCardText}>{selectedBid.notes}</Text>
                    </View>
                  </View>
                )}

                {selectedBid.rejection_reason && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Rejection Reason</Text>
                    <View style={[styles.notesCard, { backgroundColor: 'rgba(231, 76, 60, 0.1)' }]}>
                      <Text style={[styles.notesCardText, { color: '#e74c3c' }]}>{selectedBid.rejection_reason}</Text>
                    </View>
                  </View>
                )}

                <Text style={styles.submittedDate}>
                  Submitted: {formatDate(selectedBid.created_at)}
                </Text>

                {/* Action Buttons */}
                {selectedBid.status === 'pending' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApprove(selectedBid.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                          <Text style={styles.actionButtonText}>Approve</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleReject(selectedBid.id)}
                      disabled={actionLoading}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  filterChipActive: {
    backgroundColor: '#e74c3c',
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
    textAlign: 'center',
    marginTop: 8,
  },
  bidCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bidInfo: {
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  bidDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#a0a0a0',
    fontSize: 12,
  },
  notesContainer: {
    backgroundColor: '#0f0f1a',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  notesLabel: {
    color: '#666',
    fontSize: 11,
    marginBottom: 4,
  },
  notesText: {
    color: '#a0a0a0',
    fontSize: 12,
  },
  dateText: {
    color: '#666',
    fontSize: 11,
    marginTop: 8,
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
    maxHeight: '90%',
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
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  statusTextLarge: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  detailCard: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
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
  detailValueHighlight: {
    color: '#f39c12',
    fontSize: 16,
    fontWeight: 'bold',
  },
  notesCard: {
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    padding: 12,
    borderRadius: 12,
  },
  notesCardText: {
    color: '#a0a0a0',
    fontSize: 14,
    lineHeight: 20,
  },
  submittedDate: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#27ae60',
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
