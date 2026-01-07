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
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/services/api';

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  const [payments, setPayments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');

  const fetchData = async () => {
    try {
      const [paymentsData, ordersData] = await Promise.all([
        api.getAdminPayments(statusFilter || undefined),
        api.getAdminOrders('delivered')
      ]);
      setPayments(paymentsData);
      setOrders(ordersData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [statusFilter])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleRecordPayment = async () => {
    if (!selectedOrder || !paymentAmount) {
      Alert.alert('Error', 'Please enter payment amount');
      return;
    }

    try {
      await api.recordPayment(
        selectedOrder.id,
        parseFloat(paymentAmount),
        paymentMethod,
        referenceNumber || undefined
      );
      Alert.alert('Success', 'Payment recorded successfully');
      setRecordModalVisible(false);
      setSelectedOrder(null);
      setPaymentAmount('');
      setReferenceNumber('');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to record payment');
    }
  };

  const handleReleasePayment = async (paymentId: string) => {
    Alert.alert(
      'Release Payment',
      'Are you sure you want to release this payment to the supplier?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          onPress: async () => {
            try {
              await api.releasePayment(paymentId);
              Alert.alert('Success', 'Payment released to supplier');
              fetchData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to release payment');
            }
          }
        }
      ]
    );
  };

  const handleResolveDispute = async (paymentId: string, refund: boolean) => {
    const resolution = refund ? 'Refunded to retailer' : 'Released to supplier';
    try {
      await api.resolveDispute(paymentId, resolution, refund);
      Alert.alert('Success', `Dispute resolved: ${resolution}`);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to resolve dispute');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'locked': return '#f39c12';
      case 'released': return '#27ae60';
      case 'disputed': return '#e74c3c';
      case 'refunded': return '#9b59b6';
      default: return '#666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter orders that don't have payments yet
  const unpaidOrders = orders.filter(
    (order) => !payments.some((p) => p.order_id === order.id)
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Loading payments...</Text>
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
        {['', 'locked', 'disputed', 'released', 'refunded'].map((status) => (
          <TouchableOpacity
            key={status || 'all'}
            style={[
              styles.filterChip,
              statusFilter === status && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[
              styles.filterText,
              statusFilter === status && styles.filterTextActive
            ]}>
              {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'}
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
        {/* Unpaid Orders Section */}
        {unpaidOrders.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Payment ({unpaidOrders.length})</Text>
            {unpaidOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => {
                  setSelectedOrder(order);
                  setPaymentAmount(order.total_amount.toString());
                  setRecordModalVisible(true);
                }}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderProduct}>{order.product_name}</Text>
                  <Text style={styles.orderAmount}>Rs. {order.total_amount}</Text>
                </View>
                <Text style={styles.orderRetailer}>{order.retailer_name}</Text>
                <View style={styles.recordPaymentHint}>
                  <Ionicons name="add-circle" size={16} color="#27ae60" />
                  <Text style={styles.recordPaymentText}>Tap to record payment</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Payments List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments ({payments.length})</Text>
          {payments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>No payments found</Text>
            </View>
          ) : (
            payments.map((payment) => (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentRetailer}>{payment.retailer_name}</Text>
                    <Text style={styles.paymentSupplier}>To: {payment.supplier_name}</Text>
                  </View>
                  <Text style={styles.paymentAmount}>Rs. {payment.amount}</Text>
                </View>

                <View style={styles.paymentDetails}>
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentLabel}>Method</Text>
                    <Text style={styles.paymentValue}>{payment.payment_method.toUpperCase()}</Text>
                  </View>
                  {payment.reference_number && (
                    <View style={styles.paymentDetailRow}>
                      <Text style={styles.paymentLabel}>Reference</Text>
                      <Text style={styles.paymentValue}>{payment.reference_number}</Text>
                    </View>
                  )}
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentLabel}>Date</Text>
                    <Text style={styles.paymentValue}>{formatDate(payment.created_at)}</Text>
                  </View>
                </View>

                <View style={styles.paymentFooter}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) }]}>
                    <Text style={styles.statusText}>{payment.status.toUpperCase()}</Text>
                  </View>

                  {payment.status === 'locked' && (
                    <TouchableOpacity
                      style={styles.releaseButton}
                      onPress={() => handleReleasePayment(payment.id)}
                    >
                      <Text style={styles.releaseButtonText}>Release</Text>
                    </TouchableOpacity>
                  )}

                  {payment.status === 'disputed' && (
                    <View style={styles.disputeActions}>
                      <TouchableOpacity
                        style={[styles.disputeButton, { backgroundColor: '#27ae60' }]}
                        onPress={() => handleResolveDispute(payment.id, false)}
                      >
                        <Text style={styles.disputeButtonText}>Release</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.disputeButton, { backgroundColor: '#e74c3c' }]}
                        onPress={() => handleResolveDispute(payment.id, true)}
                      >
                        <Text style={styles.disputeButtonText}>Refund</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {payment.dispute_reason && (
                  <View style={styles.disputeReason}>
                    <Ionicons name="warning" size={16} color="#e74c3c" />
                    <Text style={styles.disputeReasonText}>{payment.dispute_reason}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Record Payment Modal */}
      <Modal
        visible={recordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRecordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setRecordModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <>
                <View style={styles.orderSummary}>
                  <Text style={styles.orderSummaryProduct}>{selectedOrder.product_name}</Text>
                  <Text style={styles.orderSummaryRetailer}>{selectedOrder.retailer_name}</Text>
                  <Text style={styles.orderSummaryAmount}>Order Total: Rs. {selectedOrder.total_amount}</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount Received</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Payment Method</Text>
                  <View style={styles.methodButtons}>
                    {['cash', 'upi', 'bank_transfer', 'cheque'].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.methodButton,
                          paymentMethod === method && styles.methodButtonActive,
                        ]}
                        onPress={() => setPaymentMethod(method)}
                      >
                        <Text style={[
                          styles.methodButtonText,
                          paymentMethod === method && styles.methodButtonTextActive,
                        ]}>
                          {method.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Reference Number (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={referenceNumber}
                    onChangeText={setReferenceNumber}
                    placeholder="Transaction ID / Cheque No."
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.lockInfo}>
                  <Ionicons name="time" size={20} color="#f39c12" />
                  <Text style={styles.lockInfoText}>
                    Payment will be locked for 48 hours. Retailer can raise dispute within this window.
                  </Text>
                </View>

                <TouchableOpacity style={styles.recordButton} onPress={handleRecordPayment}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.recordButtonText}>Record Payment</Text>
                </TouchableOpacity>
              </>
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
    borderColor: '#2d2d44',
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#666',
    marginTop: 12,
  },
  orderCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#27ae60',
    borderStyle: 'dashed',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderProduct: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  orderAmount: {
    color: '#27ae60',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderRetailer: {
    color: '#a0a0a0',
    fontSize: 14,
    marginTop: 4,
  },
  recordPaymentHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  recordPaymentText: {
    color: '#27ae60',
    fontSize: 12,
  },
  paymentCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentRetailer: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentSupplier: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 2,
  },
  paymentAmount: {
    color: '#27ae60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  paymentDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  paymentLabel: {
    color: '#a0a0a0',
    fontSize: 12,
  },
  paymentValue: {
    color: '#fff',
    fontSize: 12,
  },
  paymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  releaseButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  releaseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disputeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  disputeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  disputeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  disputeReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  disputeReasonText: {
    color: '#e74c3c',
    fontSize: 12,
    flex: 1,
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
  },
  orderSummary: {
    backgroundColor: '#0f0f1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  orderSummaryProduct: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  orderSummaryRetailer: {
    color: '#a0a0a0',
    fontSize: 14,
    marginTop: 4,
  },
  orderSummaryAmount: {
    color: '#27ae60',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  methodButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  methodButtonActive: {
    backgroundColor: '#27ae60',
    borderColor: '#27ae60',
  },
  methodButtonText: {
    color: '#a0a0a0',
    fontSize: 12,
    fontWeight: '600',
  },
  methodButtonTextActive: {
    color: '#fff',
  },
  lockInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  lockInfoText: {
    color: '#f39c12',
    fontSize: 12,
    flex: 1,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
