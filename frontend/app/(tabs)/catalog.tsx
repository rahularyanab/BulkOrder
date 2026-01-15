import React, { useEffect, useState, useCallback } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';
import { useFocusEffect } from 'expo-router';

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

interface Product {
  id: string;
  name: string;
  brand: string;
  unit: string;
  category: string;
  category_name?: string;
  images: string[];
}

interface Zone {
  id: string;
  name: string;
}

export default function CatalogScreen() {
  const { retailer } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'active' | 'browse'>('active');
  
  // Zone state
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [zoneModalVisible, setZoneModalVisible] = useState(false);
  
  // Offers & Products state
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Offer Modal state
  const [selectedOffer, setSelectedOffer] = useState<SupplierOffer | null>(null);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Bid Request Modal state
  const [bidModalVisible, setBidModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [bidQuantity, setBidQuantity] = useState('');
  const [bidNotes, setBidNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      // Reset and refetch when screen gains focus
      setLoading(true);
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      // Fetch zones first
      const zonesData = await api.getRetailerZones();
      setZones(zonesData);
      
      if (zonesData.length > 0) {
        // Determine which zone to use
        const currentZoneStillValid = selectedZone && zonesData.some((z: Zone) => z.id === selectedZone.id);
        const zoneToUse = currentZoneStillValid ? selectedZone : zonesData[0];
        
        if (!currentZoneStillValid) {
          setSelectedZone(zoneToUse);
        }
        
        // Fetch offers for the zone
        const offersData = await api.getZoneOffers(zoneToUse.id);
        setOffers(offersData);
        
        // Extract unique categories
        const categorySet = new Set<string>();
        offersData.forEach((o: SupplierOffer) => {
          if (o.product_category) categorySet.add(o.product_category);
        });
        setCategories(Array.from(categorySet));
        
        // Fetch products
        const productsData = await api.getProducts();
        setProducts(productsData);
      } else {
        setSelectedZone(null);
        setOffers([]);
        setProducts([]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setZones([]);
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  // Also refetch when zone changes manually
  useEffect(() => {
    if (selectedZone && !loading) {
      fetchOffersForZone(selectedZone.id);
    }
  }, [selectedZone?.id]);

  const fetchOffersForZone = async (zoneId: string) => {
    try {
      const data = await api.getZoneOffers(zoneId);
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

  const fetchProducts = async () => {
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedZone) {
      await Promise.all([
        fetchOffersForZone(selectedZone.id),
        fetchProducts()
      ]);
    }
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

  // Get the current slab index based on quantity
  const getCurrentSlabIndex = (slabs: QuantitySlab[], qty: number): number => {
    for (let i = 0; i < slabs.length; i++) {
      const slab = slabs[i];
      if (qty >= slab.min_qty && (slab.max_qty === null || qty <= slab.max_qty)) {
        return i;
      }
    }
    return 0;
  };

  // Get next slab info for incentive display
  const getNextSlabInfo = (slabs: QuantitySlab[], currentQty: number): {
    hasNextSlab: boolean;
    nextPrice?: number;
    qtyNeeded?: number;
    savings?: number;
    currentPrice: number;
  } => {
    const currentSlabIndex = getCurrentSlabIndex(slabs, currentQty);
    const currentPrice = slabs[currentSlabIndex].price_per_unit;
    
    // If we're at the last slab or current slab has no max, no next slab
    if (currentSlabIndex >= slabs.length - 1 || slabs[currentSlabIndex].max_qty === null) {
      return { hasNextSlab: false, currentPrice };
    }
    
    const nextSlab = slabs[currentSlabIndex + 1];
    const qtyNeeded = nextSlab.min_qty - currentQty;
    const savingsPerUnit = currentPrice - nextSlab.price_per_unit;
    
    return {
      hasNextSlab: true,
      nextPrice: nextSlab.price_per_unit,
      qtyNeeded,
      savings: savingsPerUnit,
      currentPrice,
    };
  };

  const openOfferModal = (offer: SupplierOffer) => {
    setSelectedOffer(offer);
    setOrderQuantity('');
    setOfferModalVisible(true);
  };

  const openBidModal = (product: Product) => {
    setSelectedProduct(product);
    setBidQuantity('');
    setBidNotes('');
    setBidModalVisible(true);
  };

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
                if (selectedZone) {
                  fetchOffersForZone(selectedZone.id);
                }
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

  const handleRequestBid = async () => {
    if (!selectedProduct || !selectedZone) return;
    
    const qty = parseInt(bidQuantity);
    if (!qty || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter how much quantity you need');
      return;
    }

    setSubmitting(true);
    try {
      await api.createBidRequest({
        product_id: selectedProduct.id,
        zone_id: selectedZone.id,
        requested_quantity: qty,
        notes: bidNotes || undefined,
      });
      
      Alert.alert(
        'Bid Request Submitted!',
        `Your request for ${selectedProduct.name} has been submitted.\n\nWe'll notify you when a supplier offer is available.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setBidModalVisible(false);
              setBidQuantity('');
              setBidNotes('');
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit bid request');
    } finally {
      setSubmitting(false);
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

  // Filter offers based on search and category
  const filteredOffers = offers.filter(o => {
    const matchesSearch = !searchQuery || 
      o.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.product_brand.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !filterCategory || o.product_category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Active bids = offers with current_aggregated_qty > 0
  const activeBids = filteredOffers.filter(o => o.current_aggregated_qty > 0);
  
  // All offers for browsing
  const browseOffers = filteredOffers;

  // Products without active offers in this zone
  const productsWithoutOffers = products.filter(p => 
    !offers.some(o => o.product_id === p.id)
  ).filter(p => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const renderOfferCard = (offer: SupplierOffer, showBidStatus: boolean = false) => {
    const nextSlabInfo = getNextSlabInfo(offer.quantity_slabs, offer.current_aggregated_qty);
    
    return (
      <TouchableOpacity
        key={offer.id}
        style={styles.offerCard}
        onPress={() => openOfferModal(offer)}
      >
        <View style={styles.offerHeader}>
          <View style={styles.productInfo}>
            {offer.product_images && offer.product_images.length > 0 ? (
              <Image source={{ uri: offer.product_images[0] }} style={styles.productImage} />
            ) : (
              <View style={styles.productIcon}>
                <Ionicons name="cube" size={24} color="#6c5ce7" />
              </View>
            )}
            <View style={styles.productDetails}>
              <Text style={styles.productName}>{offer.product_name}</Text>
              <Text style={styles.productBrand}>{offer.product_brand}</Text>
            </View>
          </View>
          <View style={[styles.supplierBadge, { backgroundColor: getSupplierColor(offer.supplier_code) }]}>
            <Text style={styles.supplierCode}>{offer.supplier_code}</Text>
          </View>
        </View>

        {/* Improved Price Display */}
        <View style={styles.priceSection}>
          <View style={styles.currentPriceBox}>
            <Text style={styles.currentPriceLabel}>Current Price</Text>
            <Text style={styles.currentPriceValue}>
              ₹{nextSlabInfo.currentPrice}/{offer.product_unit}
            </Text>
            <Text style={styles.aggregatedQty}>
              {offer.current_aggregated_qty} {offer.product_unit} ordered
            </Text>
          </View>
          
          {nextSlabInfo.hasNextSlab && (
            <View style={styles.nextSlabBox}>
              <View style={styles.nextSlabHeader}>
                <Ionicons name="trending-down" size={16} color="#27ae60" />
                <Text style={styles.nextSlabTitle}>Next Price</Text>
              </View>
              <Text style={styles.nextSlabPrice}>
                ₹{nextSlabInfo.nextPrice}/{offer.product_unit}
              </Text>
              <View style={styles.savingsTag}>
                <Text style={styles.savingsText}>
                  Add {nextSlabInfo.qtyNeeded} more to save ₹{nextSlabInfo.savings}/unit
                </Text>
              </View>
            </View>
          )}
          
          {!nextSlabInfo.hasNextSlab && (
            <View style={styles.bestPriceBox}>
              <Ionicons name="checkmark-circle" size={20} color="#27ae60" />
              <Text style={styles.bestPriceText}>Best Price!</Text>
            </View>
          )}
        </View>

        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              {offer.current_aggregated_qty}/{offer.min_fulfillment_qty} for fulfillment
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
          {showBidStatus && offer.current_aggregated_qty > 0 && offer.status !== 'ready_to_pack' && (
            <View style={styles.activeBidBadge}>
              <Ionicons name="flame" size={14} color="#f39c12" />
              <Text style={styles.activeBidText}>Active Group Bid</Text>
            </View>
          )}
        </View>
        
        {/* Lead time info */}
        <View style={styles.leadTimeRow}>
          <Ionicons name="time-outline" size={14} color="#666" />
          <Text style={styles.leadTimeText}>{offer.lead_time_days} days delivery</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProductCard = (product: Product) => {
    return (
      <View key={product.id} style={styles.productCard}>
        <View style={styles.productCardHeader}>
          {product.images && product.images.length > 0 ? (
            <Image source={{ uri: product.images[0] }} style={styles.productImage} />
          ) : (
            <View style={styles.productIcon}>
              <Ionicons name="cube" size={24} color="#6c5ce7" />
            </View>
          )}
          <View style={styles.productCardInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productBrand}>{product.brand} • {product.category_name || product.category}</Text>
            <Text style={styles.productUnit}>Unit: {product.unit}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.requestBidButton}
          onPress={() => openBidModal(product)}
        >
          <Ionicons name="hand-left" size={16} color="#fff" />
          <Text style={styles.requestBidText}>Request Bid</Text>
        </TouchableOpacity>
      </View>
    );
  };

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

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Ionicons 
            name="flame" 
            size={18} 
            color={activeTab === 'active' ? '#fff' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active Bids ({activeBids.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'browse' && styles.tabActive]}
          onPress={() => setActiveTab('browse')}
        >
          <Ionicons 
            name="grid" 
            size={18} 
            color={activeTab === 'browse' ? '#fff' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'browse' && styles.tabTextActive]}>
            Browse All
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      {activeTab === 'browse' && categories.length > 0 && (
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
      )}

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />
        }
      >
        {activeTab === 'active' ? (
          <>
            {activeBids.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="flame-outline" size={64} color="#666" />
                <Text style={styles.emptyTitle}>No Active Bids</Text>
                <Text style={styles.emptySubtitle}>
                  Browse products and join group orders to see active bids here
                </Text>
                <TouchableOpacity 
                  style={styles.browseButton}
                  onPress={() => setActiveTab('browse')}
                >
                  <Text style={styles.browseButtonText}>Browse Products</Text>
                </TouchableOpacity>
              </View>
            ) : (
              activeBids.map(offer => renderOfferCard(offer, true))
            )}
          </>
        ) : (
          <>
            {/* Offers with active group buying */}
            {browseOffers.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Available Offers</Text>
                {browseOffers.map(offer => renderOfferCard(offer, true))}
              </>
            )}

            {/* Products without offers */}
            {productsWithoutOffers.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Request a Bid</Text>
                <Text style={styles.sectionSubtitle}>
                  These products don't have active offers. Request a bid and we'll try to get you a deal!
                </Text>
                {productsWithoutOffers.map(renderProductCard)}
              </>
            )}

            {browseOffers.length === 0 && productsWithoutOffers.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={64} color="#666" />
                <Text style={styles.emptyTitle}>No Results</Text>
                <Text style={styles.emptySubtitle}>
                  Try a different search term or category
                </Text>
              </View>
            )}
          </>
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

                {/* Product Image */}
                {selectedOffer.product_images && selectedOffer.product_images.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                    {selectedOffer.product_images.map((img, idx) => (
                      <Image key={idx} source={{ uri: img }} style={styles.modalImage} />
                    ))}
                  </ScrollView>
                )}

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
                <Text style={styles.slabSubtitle}>
                  Currently at {selectedOffer.current_aggregated_qty} {selectedOffer.product_unit} (zone total)
                </Text>
                {selectedOffer.quantity_slabs.map((slab, idx) => {
                  const isCurrentSlab = idx === getCurrentSlabIndex(selectedOffer.quantity_slabs, selectedOffer.current_aggregated_qty);
                  const isAchieved = selectedOffer.current_aggregated_qty >= slab.min_qty;
                  
                  return (
                    <View 
                      key={idx} 
                      style={[
                        styles.slabRow,
                        isCurrentSlab && styles.slabRowCurrent,
                      ]}
                    >
                      <View style={styles.slabRowLeft}>
                        {isCurrentSlab && (
                          <Ionicons name="arrow-forward" size={14} color="#6c5ce7" style={styles.slabArrow} />
                        )}
                        <Text style={[styles.slabQty, isCurrentSlab && styles.slabQtyCurrent]}>
                          {slab.min_qty} - {slab.max_qty || '∞'} {selectedOffer.product_unit}
                        </Text>
                      </View>
                      <View style={styles.slabRowRight}>
                        <Text style={[styles.slabPrice, isCurrentSlab && styles.slabPriceCurrent]}>
                          ₹{slab.price_per_unit}/{selectedOffer.product_unit}
                        </Text>
                        {isCurrentSlab && (
                          <View style={styles.currentSlabTag}>
                            <Text style={styles.currentSlabTagText}>CURRENT</Text>
                          </View>
                        )}
                        {!isAchieved && idx > 0 && (
                          <Text style={styles.slabSavings}>
                            Save ₹{selectedOffer.quantity_slabs[idx-1].price_per_unit - slab.price_per_unit}/unit
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}

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

      {/* Bid Request Modal */}
      <Modal
        visible={bidModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBidModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            {selectedProduct && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Request a Bid</Text>
                  <TouchableOpacity onPress={() => setBidModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.bidProductInfo}>
                  {selectedProduct.images && selectedProduct.images.length > 0 ? (
                    <Image source={{ uri: selectedProduct.images[0] }} style={styles.bidProductImage} />
                  ) : (
                    <View style={styles.bidProductIcon}>
                      <Ionicons name="cube" size={32} color="#6c5ce7" />
                    </View>
                  )}
                  <View style={styles.bidProductDetails}>
                    <Text style={styles.bidProductName}>{selectedProduct.name}</Text>
                    <Text style={styles.bidProductBrand}>{selectedProduct.brand}</Text>
                    <Text style={styles.bidProductCategory}>{selectedProduct.category_name || selectedProduct.category} • {selectedProduct.unit}</Text>
                  </View>
                </View>

                <View style={styles.bidForm}>
                  <Text style={styles.inputLabel}>How much do you need? ({selectedProduct.unit}) *</Text>
                  <TextInput
                    style={styles.bidInput}
                    value={bidQuantity}
                    onChangeText={setBidQuantity}
                    keyboardType="number-pad"
                    placeholder="Enter quantity"
                    placeholderTextColor="#666"
                  />

                  <Text style={styles.inputLabel}>Any notes for the supplier? (Optional)</Text>
                  <TextInput
                    style={[styles.bidInput, styles.bidNotesInput]}
                    value={bidNotes}
                    onChangeText={setBidNotes}
                    placeholder="e.g., Need by next week, specific brand preference..."
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.bidInfo}>
                  <Ionicons name="information-circle" size={20} color="#f39c12" />
                  <Text style={styles.bidInfoText}>
                    Your request will be reviewed by our team. We'll try to find a supplier and create an offer for your zone.
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[styles.submitBidButton, (!bidQuantity || parseInt(bidQuantity) <= 0 || submitting) && styles.orderButtonDisabled]} 
                  onPress={handleRequestBid}
                  disabled={!bidQuantity || parseInt(bidQuantity) <= 0 || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="hand-left" size={20} color="#fff" />
                      <Text style={styles.orderButtonText}>Submit Request</Text>
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
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  zoneSelectorText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#6c5ce7',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  categoryScroll: {
    maxHeight: 44,
    marginTop: 12,
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
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionSubtitle: {
    color: '#a0a0a0',
    fontSize: 14,
    marginBottom: 16,
    marginTop: -8,
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
    paddingHorizontal: 32,
  },
  browseButton: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0f0f1a',
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
  // Improved Price Section Styles
  priceSection: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
    gap: 12,
  },
  currentPriceBox: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  currentPriceLabel: {
    color: '#a0a0a0',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentPriceValue: {
    color: '#6c5ce7',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  aggregatedQty: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  nextSlabBox: {
    flex: 1,
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(39, 174, 96, 0.3)',
  },
  nextSlabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nextSlabTitle: {
    color: '#27ae60',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextSlabPrice: {
    color: '#27ae60',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  savingsTag: {
    marginTop: 6,
  },
  savingsText: {
    color: '#27ae60',
    fontSize: 10,
    fontWeight: '600',
  },
  bestPriceBox: {
    flex: 1,
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bestPriceText: {
    color: '#27ae60',
    fontSize: 14,
    fontWeight: 'bold',
  },
  leadTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  leadTimeText: {
    color: '#666',
    fontSize: 12,
  },
  // Keep old styles for compatibility
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
  activeBidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  activeBidText: {
    color: '#f39c12',
    fontSize: 12,
    fontWeight: '600',
  },
  productCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  productCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productUnit: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  requestBidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f39c12',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  requestBidText: {
    color: '#fff',
    fontSize: 14,
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
    maxHeight: '90%',
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
  imageScroll: {
    marginBottom: 16,
  },
  modalImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#0f0f1a',
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
    marginBottom: 4,
  },
  slabSubtitle: {
    color: '#a0a0a0',
    fontSize: 12,
    marginBottom: 12,
  },
  slabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  slabRowCurrent: {
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  slabRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slabArrow: {
    marginRight: 8,
  },
  slabRowRight: {
    alignItems: 'flex-end',
  },
  slabQty: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  slabQtyCurrent: {
    color: '#fff',
    fontWeight: '600',
  },
  slabPrice: {
    color: '#27ae60',
    fontSize: 14,
    fontWeight: '600',
  },
  slabPriceCurrent: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentSlabTag: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  currentSlabTagText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  slabSavings: {
    color: '#27ae60',
    fontSize: 10,
    marginTop: 2,
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
  // Bid Request Modal Styles
  bidProductInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  bidProductImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
  },
  bidProductIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidProductDetails: {
    flex: 1,
    marginLeft: 12,
  },
  bidProductName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  bidProductBrand: {
    color: '#a0a0a0',
    fontSize: 14,
    marginTop: 2,
  },
  bidProductCategory: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  bidForm: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  bidInput: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
    marginBottom: 16,
  },
  bidNotesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  bidInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
  },
  bidInfoText: {
    color: '#a0a0a0',
    fontSize: 12,
    flex: 1,
  },
  submitBidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f39c12',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
});
