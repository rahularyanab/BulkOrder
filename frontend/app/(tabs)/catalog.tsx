import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

interface QuantitySlab {
  min_qty: number;
  max_qty: number | null;
  price_per_unit: number;
}

interface SupplierOffer {
  id: string;
  product_id: string;
  product_name: string;
  product_brand: string;
  product_unit: string;
  product_category: string;
  product_images: string[];
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  zone_id: string;
  zone_name: string;
  quantity_slabs: QuantitySlab[];
  min_fulfillment_qty: number;
  lead_time_days: number;
  current_aggregated_qty: number;
  status: string;
  progress_percentage: number;
}

interface Zone {
  id: string;
  name: string;
}

export default function CatalogScreen() {
  const { retailer } = useAuth();
  const insets = useSafeAreaInsets();
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoneModalVisible, setZoneModalVisible] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<SupplierOffer | null>(null);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [orderQuantity, setOrderQuantity] = useState('');

  useEffect(() => {
    fetchZones();
  }, []);

  useEffect(() => {
    if (selectedZone) {
      fetchOffers();
    }
  }, [selectedZone]);

  const fetchZones = async () => {
    try {
      const data = await api.getRetailerZones();
      setZones(data);
      if (data.length > 0) {
        setSelectedZone(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOffers = async () => {
    if (!selectedZone) return;
    
    try {
      const data = await api.getZoneOffers(selectedZone.id);
      setOffers(data);
      
      // Extract unique categories
      const categorySet = new Set<string>();
      data.forEach((o: SupplierOffer) => {
        if (o.product_category) categorySet.add(o.product_category);
      });
      setCategories(Array.from(categorySet));
    } catch (error) {
      console.error('Failed to fetch offers:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOffers();
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

  const getBestPrice = (slabs: QuantitySlab[]) => {
    return Math.min(...slabs.map(s => s.price_per_unit));
  };

  const getCurrentPrice = (slabs: QuantitySlab[], qty: number) => {
    for (const slab of slabs) {
      if (qty >= slab.min_qty && (slab.max_qty === null || qty <= slab.max_qty)) {
        return slab.price_per_unit;
      }
    }
    return slabs[0].price_per_unit;
  };

  const openOfferModal = (offer: SupplierOffer) => {
    setSelectedOffer(offer);
    setOrderQuantity('');
    setOfferModalVisible(true);
  };

  const [submitting, setSubmitting] = useState(false);

  const handleAddToOrder = async () => {
    const qty = parseInt(orderQuantity);
    if (!qty || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity greater than 0');
      return;
    }

    if (selectedOffer && !submitting) {
      setSubmitting(true);
      try {
        const result = await api.createOrder(selectedOffer.id, qty);
        
        Alert.alert(
          'Order Placed!',
          `Added ${qty} ${selectedOffer.product_unit} of ${selectedOffer.product_name}\n\n` +
          `Price: ₹${result.price_per_unit}/${selectedOffer.product_unit}\n` +
          `Your Total: ₹${result.total_amount}\n\n` +
          `Zone Total: ${result.new_aggregated_qty} ${selectedOffer.product_unit}\n` +
          (result.offer_status === 'ready_to_pack' ? 'Minimum quantity reached! Ready to pack!' : ''),
          [
            {
              text: 'OK',
              onPress: () => {
                setOfferModalVisible(false);
                setOrderQuantity('');
                fetchOffers(); // Refresh offers to show updated aggregated qty
              },
            },
          ]
        );
      } catch (error: any) {
        Alert.alert('Error', error.response?.data?.detail || 'Failed to place order');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const incrementQuantity = () => {
    const current = parseInt(orderQuantity) || 0;
    setOrderQuantity((current + 1).toString());
  };

  const decrementQuantity = () => {
    const current = parseInt(orderQuantity) || 0;
    if (current > 0) {
      setOrderQuantity((current - 1).toString());
    }
  };

  const filteredOffers = filterCategory
    ? offers.filter(o => o.product_category === filterCategory)
    : offers;

  const renderOfferCard = (offer: SupplierOffer) => (
    <TouchableOpacity
      key={offer.id}
      style={styles.offerCard}
      onPress={() => openOfferModal(offer)}
    >
      <View style={styles.offerHeader}>
        <View style={styles.productInfo}>
          <View style={styles.productIcon}>
            <Ionicons name="cube" size={24} color="#6c5ce7" />
          </View>
          <View style={styles.productDetails}>
            <Text style={styles.productName}>{offer.product_name}</Text>
            <Text style={styles.productBrand}>{offer.product_brand}</Text>
          </View>
        </View>
        <View style={[styles.supplierBadge, { backgroundColor: getSupplierColor(offer.supplier_code) }]}>
          <Text style={styles.supplierCode}>{offer.supplier_code}</Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <View>
          <Text style={styles.priceLabel}>Best Price</Text>
          <Text style={styles.priceValue}>
            ₹{getBestPrice(offer.quantity_slabs)}/{offer.product_unit}
          </Text>
        </View>
        <View style={styles.minQtyInfo}>
          <Text style={styles.minQtyLabel}>Min Qty: {offer.min_fulfillment_qty}</Text>
          <Text style={styles.leadTime}>{offer.lead_time_days} days delivery</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>
            {offer.current_aggregated_qty}/{offer.min_fulfillment_qty} ordered
          </Text>
          <Text style={styles.progressPercent}>{Math.round(offer.progress_percentage)}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(offer.progress_percentage, 100)}%` },
              offer.progress_percentage >= 100 && styles.progressBarComplete,
            ]}
          />
        </View>
        {offer.status === 'ready_to_pack' && (
          <View style={styles.readyBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#27ae60" />
            <Text style={styles.readyText}>Ready to Pack</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6c5ce7" />
          <Text style={styles.loadingText}>Loading catalog...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Zone Selector */}
      <TouchableOpacity
        style={styles.zoneSelector}
        onPress={() => setZoneModalVisible(true)}
      >
        <Ionicons name="location" size={20} color="#6c5ce7" />
        <Text style={styles.zoneSelectorText}>
          {selectedZone?.name || 'Select Zone'}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#666" />
      </TouchableOpacity>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        <TouchableOpacity
          style={[styles.categoryChip, !filterCategory && styles.categoryChipActive]}
          onPress={() => setFilterCategory(null)}
        >
          <Text style={[styles.categoryText, !filterCategory && styles.categoryTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, filterCategory === cat && styles.categoryChipActive]}
            onPress={() => setFilterCategory(cat)}
          >
            <Text style={[styles.categoryText, filterCategory === cat && styles.categoryTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Offers List */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />
        }
      >
        {filteredOffers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color="#666" />
            <Text style={styles.emptyTitle}>No Offers Available</Text>
            <Text style={styles.emptySubtitle}>
              Check back later for new product offers in this zone
            </Text>
          </View>
        ) : (
          filteredOffers.map(renderOfferCard)
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Zone Selection Modal */}
      <Modal
        visible={zoneModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setZoneModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Zone</Text>
              <TouchableOpacity onPress={() => setZoneModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {zones.map((zone) => (
              <TouchableOpacity
                key={zone.id}
                style={[
                  styles.zoneOption,
                  selectedZone?.id === zone.id && styles.zoneOptionSelected,
                ]}
                onPress={() => {
                  setSelectedZone(zone);
                  setZoneModalVisible(false);
                }}
              >
                <Ionicons
                  name={selectedZone?.id === zone.id ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selectedZone?.id === zone.id ? '#6c5ce7' : '#666'}
                />
                <Text style={styles.zoneOptionText}>{zone.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Offer Detail Modal */}
      <Modal
        visible={offerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            {selectedOffer && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle} numberOfLines={2}>{selectedOffer.product_name}</Text>
                  <TouchableOpacity onPress={() => setOfferModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.offerDetailSection}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Brand</Text>
                    <Text style={styles.detailValue}>{selectedOffer.product_brand}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>{selectedOffer.product_category}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Unit</Text>
                    <Text style={styles.detailValue}>{selectedOffer.product_unit}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Supplier</Text>
                    <Text style={styles.detailValue}>{selectedOffer.supplier_name}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.detailLabel}>Lead Time</Text>
                    <Text style={styles.detailValue}>{selectedOffer.lead_time_days} days</Text>
                  </View>
                </View>

                <Text style={styles.slabTitle}>Price Slabs</Text>
                {selectedOffer.quantity_slabs.map((slab, idx) => (
                  <View key={idx} style={styles.slabRow}>
                    <Text style={styles.slabQty}>
                      {slab.min_qty} - {slab.max_qty || '∞'} {selectedOffer.product_unit}
                    </Text>
                    <Text style={styles.slabPrice}>₹{slab.price_per_unit}/{selectedOffer.product_unit}</Text>
                  </View>
                ))}

                <View style={styles.fulfillmentInfo}>
                  <Ionicons name="information-circle" size={20} color="#6c5ce7" />
                  <Text style={styles.fulfillmentText}>
                    Minimum {selectedOffer.min_fulfillment_qty} {selectedOffer.product_unit} needed for fulfillment.
                    Currently {selectedOffer.current_aggregated_qty} ordered.
                  </Text>
                </View>

                {/* Quantity Input Section */}
                <View style={styles.quantitySection}>
                  <Text style={styles.quantityLabel}>Enter Quantity ({selectedOffer.product_unit})</Text>
                  <View style={styles.quantityInputRow}>
                    <TouchableOpacity style={styles.quantityButton} onPress={decrementQuantity}>
                      <Ionicons name="remove" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantityInput}
                      value={orderQuantity}
                      onChangeText={setOrderQuantity}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#666"
                    />
                    <TouchableOpacity style={styles.quantityButton} onPress={incrementQuantity}>
                      <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  
                  {orderQuantity && parseInt(orderQuantity) > 0 && (
                    <View style={styles.pricePreview}>
                      <Text style={styles.pricePreviewLabel}>Your Price:</Text>
                      <Text style={styles.pricePreviewValue}>
                        ₹{getCurrentPrice(selectedOffer.quantity_slabs, parseInt(orderQuantity))}/{selectedOffer.product_unit}
                      </Text>
                      <Text style={styles.totalPreview}>
                        Total: ₹{getCurrentPrice(selectedOffer.quantity_slabs, parseInt(orderQuantity)) * parseInt(orderQuantity)}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity 
                  style={[styles.orderButton, (!orderQuantity || parseInt(orderQuantity) <= 0 || submitting) && styles.orderButtonDisabled]} 
                  onPress={handleAddToOrder}
                  disabled={!orderQuantity || parseInt(orderQuantity) <= 0 || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cart" size={20} color="#fff" />
                      <Text style={styles.orderButtonText}>Add to Order</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
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
  zoneSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  zoneSelectorText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  categoryScroll: {
    maxHeight: 44,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  categoryChipActive: {
    backgroundColor: '#6c5ce7',
    borderColor: '#6c5ce7',
  },
  categoryText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  categoryTextActive: {
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
    flexDirection: 'row',
    flex: 1,
  },
  productIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  priceLabel: {
    color: '#a0a0a0',
    fontSize: 12,
  },
  priceValue: {
    color: '#27ae60',
    fontSize: 20,
    fontWeight: 'bold',
  },
  minQtyInfo: {
    alignItems: 'flex-end',
  },
  minQtyLabel: {
    color: '#a0a0a0',
    fontSize: 12,
  },
  leadTime: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
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
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  readyText: {
    color: '#27ae60',
    fontSize: 12,
    fontWeight: '600',
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
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 16,
  },
  zoneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0f0f1a',
    marginBottom: 8,
    gap: 12,
  },
  zoneOptionSelected: {
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  zoneOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  offerDetailSection: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  slabTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  slabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  slabQty: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  slabPrice: {
    color: '#27ae60',
    fontSize: 14,
    fontWeight: '600',
  },
  fulfillmentInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  fulfillmentText: {
    color: '#a0a0a0',
    fontSize: 12,
    flex: 1,
  },
  quantitySection: {
    marginTop: 20,
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
  },
  quantityLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quantityInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 48,
    height: 48,
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 12,
    height: 56,
  },
  pricePreview: {
    marginTop: 16,
    alignItems: 'center',
  },
  pricePreviewLabel: {
    color: '#a0a0a0',
    fontSize: 12,
  },
  pricePreviewValue: {
    color: '#27ae60',
    fontSize: 24,
    fontWeight: 'bold',
  },
  totalPreview: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  orderButtonDisabled: {
    backgroundColor: '#4a4a5e',
  },
  orderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
