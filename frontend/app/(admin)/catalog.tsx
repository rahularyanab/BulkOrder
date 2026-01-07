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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/services/api';

interface Product {
  id: string;
  name: string;
  brand: string;
  barcode: string;
  unit: string;
  category: string;
  is_active: boolean;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface Zone {
  id: string;
  name: string;
}

interface QuantitySlab {
  min_qty: number;
  max_qty: number | null;
  price_per_unit: number;
}

export default function CatalogManagementScreen() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Product Modal
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productBarcode, setProductBarcode] = useState('');
  const [productUnit, setProductUnit] = useState('kg');
  const [productCategory, setProductCategory] = useState('');
  
  // Offer Modal
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [minFulfillmentQty, setMinFulfillmentQty] = useState('50');
  const [leadTimeDays, setLeadTimeDays] = useState('3');
  const [slabs, setSlabs] = useState<QuantitySlab[]>([
    { min_qty: 1, max_qty: 10, price_per_unit: 100 },
    { min_qty: 11, max_qty: 50, price_per_unit: 90 },
    { min_qty: 51, max_qty: null, price_per_unit: 80 },
  ]);

  const [activeTab, setActiveTab] = useState<'products' | 'offers'>('products');

  const fetchData = async () => {
    try {
      const [productsData, suppliersData, zonesData] = await Promise.all([
        api.getProducts(),
        api.getSuppliers(),
        api.getAllZones(),
      ]);
      setProducts(productsData);
      setSuppliers(suppliersData);
      setZones(zonesData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleAddProduct = async () => {
    if (!productName || !productBrand || !productUnit || !productCategory) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      await api.createProduct({
        name: productName,
        brand: productBrand,
        barcode: productBarcode || undefined,
        unit: productUnit,
        category: productCategory,
      });
      Alert.alert('Success', 'Product added successfully');
      setProductModalVisible(false);
      resetProductForm();
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add product');
    }
  };

  const resetProductForm = () => {
    setProductName('');
    setProductBrand('');
    setProductBarcode('');
    setProductUnit('kg');
    setProductCategory('');
  };

  const handleCreateOffer = async () => {
    if (!selectedProduct || !selectedSupplier || !selectedZone) {
      Alert.alert('Error', 'Please select product, supplier, and zone');
      return;
    }

    try {
      await api.createOffer({
        product_id: selectedProduct.id,
        supplier_id: selectedSupplier.id,
        zone_id: selectedZone.id,
        quantity_slabs: slabs,
        min_fulfillment_qty: parseInt(minFulfillmentQty),
        lead_time_days: parseInt(leadTimeDays),
      });
      Alert.alert('Success', 'Offer created successfully! Retailers can now see this offer.');
      setOfferModalVisible(false);
      resetOfferForm();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create offer');
    }
  };

  const resetOfferForm = () => {
    setSelectedProduct(null);
    setSelectedSupplier(null);
    setSelectedZone(null);
    setMinFulfillmentQty('50');
    setLeadTimeDays('3');
    setSlabs([
      { min_qty: 1, max_qty: 10, price_per_unit: 100 },
      { min_qty: 11, max_qty: 50, price_per_unit: 90 },
      { min_qty: 51, max_qty: null, price_per_unit: 80 },
    ]);
  };

  const updateSlab = (index: number, field: string, value: string) => {
    const newSlabs = [...slabs];
    if (field === 'min_qty' || field === 'price_per_unit') {
      (newSlabs[index] as any)[field] = parseInt(value) || 0;
    } else if (field === 'max_qty') {
      (newSlabs[index] as any)[field] = value === '' ? null : parseInt(value);
    }
    setSlabs(newSlabs);
  };

  const addSlab = () => {
    const lastSlab = slabs[slabs.length - 1];
    setSlabs([...slabs, {
      min_qty: (lastSlab.max_qty || lastSlab.min_qty) + 1,
      max_qty: null,
      price_per_unit: lastSlab.price_per_unit - 10,
    }]);
  };

  const removeSlab = (index: number) => {
    if (slabs.length > 1) {
      setSlabs(slabs.filter((_, i) => i !== index));
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Loading catalog...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tab Selector */}
      <View style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.tabActive]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
            Products ({products.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'offers' && styles.tabActive]}
          onPress={() => setActiveTab('offers')}
        >
          <Text style={[styles.tabText, activeTab === 'offers' && styles.tabTextActive]}>
            Create Offer
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e74c3c" />
        }
      >
        {activeTab === 'products' ? (
          <>
            {/* Add Product Button */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setProductModalVisible(true)}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Add New Product</Text>
            </TouchableOpacity>

            {/* Products List */}
            {products.map((product) => (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productIcon}>
                  <Ionicons name="cube" size={24} color="#6c5ce7" />
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productMeta}>
                    {product.brand} • {product.category} • {product.unit}
                  </Text>
                  {product.barcode && (
                    <Text style={styles.productBarcode}>Barcode: {product.barcode}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.createOfferBtn}
                  onPress={() => {
                    setSelectedProduct(product);
                    setActiveTab('offers');
                  }}
                >
                  <Ionicons name="pricetag" size={16} color="#27ae60" />
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : (
          <>
            {/* Create Offer Form */}
            <View style={styles.formSection}>
              <Text style={styles.formTitle}>Create New Offer</Text>
              <Text style={styles.formSubtitle}>
                Link a product to a supplier and zone with pricing
              </Text>

              {/* Product Selection */}
              <Text style={styles.inputLabel}>Select Product *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectionScroll}>
                {products.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={[
                      styles.selectionChip,
                      selectedProduct?.id === product.id && styles.selectionChipActive,
                    ]}
                    onPress={() => setSelectedProduct(product)}
                  >
                    <Text style={[
                      styles.selectionChipText,
                      selectedProduct?.id === product.id && styles.selectionChipTextActive,
                    ]}>
                      {product.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Supplier Selection */}
              <Text style={styles.inputLabel}>Select Supplier *</Text>
              <View style={styles.supplierSelection}>
                {suppliers.map((supplier) => (
                  <TouchableOpacity
                    key={supplier.id}
                    style={[
                      styles.supplierChip,
                      { borderColor: getSupplierColor(supplier.code) },
                      selectedSupplier?.id === supplier.id && { backgroundColor: getSupplierColor(supplier.code) },
                    ]}
                    onPress={() => setSelectedSupplier(supplier)}
                  >
                    <Text style={[
                      styles.supplierChipText,
                      { color: selectedSupplier?.id === supplier.id ? '#fff' : getSupplierColor(supplier.code) },
                    ]}>
                      {supplier.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Zone Selection */}
              <Text style={styles.inputLabel}>Select Zone *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectionScroll}>
                {zones.map((zone) => (
                  <TouchableOpacity
                    key={zone.id}
                    style={[
                      styles.selectionChip,
                      selectedZone?.id === zone.id && styles.selectionChipActive,
                    ]}
                    onPress={() => setSelectedZone(zone)}
                  >
                    <Ionicons 
                      name="location" 
                      size={14} 
                      color={selectedZone?.id === zone.id ? '#fff' : '#666'} 
                    />
                    <Text style={[
                      styles.selectionChipText,
                      selectedZone?.id === zone.id && styles.selectionChipTextActive,
                    ]}>
                      {zone.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Min Fulfillment & Lead Time */}
              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Min Fulfillment Qty</Text>
                  <TextInput
                    style={styles.input}
                    value={minFulfillmentQty}
                    onChangeText={setMinFulfillmentQty}
                    keyboardType="number-pad"
                    placeholder="50"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Lead Time (days)</Text>
                  <TextInput
                    style={styles.input}
                    value={leadTimeDays}
                    onChangeText={setLeadTimeDays}
                    keyboardType="number-pad"
                    placeholder="3"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Price Slabs */}
              <View style={styles.slabHeader}>
                <Text style={styles.inputLabel}>Price Slabs (Group Pricing)</Text>
                <TouchableOpacity onPress={addSlab}>
                  <Ionicons name="add-circle" size={24} color="#27ae60" />
                </TouchableOpacity>
              </View>
              
              {slabs.map((slab, index) => (
                <View key={index} style={styles.slabRow}>
                  <View style={styles.slabInputGroup}>
                    <Text style={styles.slabLabel}>Min</Text>
                    <TextInput
                      style={styles.slabInput}
                      value={slab.min_qty.toString()}
                      onChangeText={(v) => updateSlab(index, 'min_qty', v)}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.slabInputGroup}>
                    <Text style={styles.slabLabel}>Max</Text>
                    <TextInput
                      style={styles.slabInput}
                      value={slab.max_qty?.toString() || ''}
                      onChangeText={(v) => updateSlab(index, 'max_qty', v)}
                      keyboardType="number-pad"
                      placeholder="∞"
                      placeholderTextColor="#666"
                    />
                  </View>
                  <View style={styles.slabInputGroup}>
                    <Text style={styles.slabLabel}>Price</Text>
                    <TextInput
                      style={[styles.slabInput, styles.priceInput]}
                      value={slab.price_per_unit.toString()}
                      onChangeText={(v) => updateSlab(index, 'price_per_unit', v)}
                      keyboardType="number-pad"
                    />
                  </View>
                  {slabs.length > 1 && (
                    <TouchableOpacity onPress={() => removeSlab(index)}>
                      <Ionicons name="close-circle" size={24} color="#e74c3c" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <View style={styles.slabInfo}>
                <Ionicons name="information-circle" size={16} color="#6c5ce7" />
                <Text style={styles.slabInfoText}>
                  Lower prices for higher quantities encourage group ordering
                </Text>
              </View>

              {/* Create Offer Button */}
              <TouchableOpacity
                style={[
                  styles.createButton,
                  (!selectedProduct || !selectedSupplier || !selectedZone) && styles.createButtonDisabled,
                ]}
                onPress={handleCreateOffer}
                disabled={!selectedProduct || !selectedSupplier || !selectedZone}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create Offer</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Add Product Modal */}
      <Modal
        visible={productModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProductModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Product</Text>
                <TouchableOpacity onPress={() => setProductModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name *</Text>
                <TextInput
                  style={styles.input}
                  value={productName}
                  onChangeText={setProductName}
                  placeholder="e.g., Tata Salt"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Brand *</Text>
                <TextInput
                  style={styles.input}
                  value={productBrand}
                  onChangeText={setProductBrand}
                  placeholder="e.g., Tata"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category *</Text>
                <TextInput
                  style={styles.input}
                  value={productCategory}
                  onChangeText={setProductCategory}
                  placeholder="e.g., Grocery, Snacks, Personal Care"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Unit *</Text>
                <View style={styles.unitSelection}>
                  {['kg', 'g', 'litre', 'ml', 'piece', 'pack', 'box'].map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.unitChip,
                        productUnit === unit && styles.unitChipActive,
                      ]}
                      onPress={() => setProductUnit(unit)}
                    >
                      <Text style={[
                        styles.unitChipText,
                        productUnit === unit && styles.unitChipTextActive,
                      ]}>
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Barcode (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={productBarcode}
                  onChangeText={setProductBarcode}
                  placeholder="e.g., 8901030705533"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                />
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleAddProduct}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Add Product</Text>
              </TouchableOpacity>
            </ScrollView>
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
  tabSelector: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#e74c3c',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  productIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  productMeta: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 4,
  },
  productBarcode: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  createOfferBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
  },
  formTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  formSubtitle: {
    color: '#a0a0a0',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
  },
  selectionScroll: {
    marginBottom: 8,
  },
  selectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#0f0f1a',
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  selectionChipActive: {
    backgroundColor: '#6c5ce7',
    borderColor: '#6c5ce7',
  },
  selectionChipText: {
    color: '#a0a0a0',
    fontSize: 13,
  },
  selectionChipTextActive: {
    color: '#fff',
  },
  supplierSelection: {
    flexDirection: 'row',
    gap: 12,
  },
  supplierChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  supplierChipText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
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
  slabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  slabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  slabInputGroup: {
    flex: 1,
  },
  slabLabel: {
    color: '#666',
    fontSize: 10,
    marginBottom: 4,
  },
  slabInput: {
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  priceInput: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  slabInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  slabInfoText: {
    color: '#a0a0a0',
    fontSize: 12,
    flex: 1,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#4a4a5e',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
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
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 16,
  },
  unitSelection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  unitChipActive: {
    backgroundColor: '#6c5ce7',
    borderColor: '#6c5ce7',
  },
  unitChipText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  unitChipTextActive: {
    color: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
