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
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/services/api';

interface Product {
  id: string;
  name: string;
  brand: string;
  barcode: string;
  unit: string;
  category: string;
  category_name?: string;
  images: string[];
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

interface SubCategory {
  id: string;
  name: string;
  description?: string;
}

interface Category {
  id: string;
  name: string;
  parent_id?: string;
  description?: string;
  subcategories?: SubCategory[];
  product_count?: number;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Product Modal
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productBarcode, setProductBarcode] = useState('');
  const [productUnit, setProductUnit] = useState('kg');
  const [productCategory, setProductCategory] = useState('');
  const [productImages, setProductImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  
  // Category Picker Modal (for selecting category when adding product)
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  
  // Category Management Modal (for creating categories)
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [parentCategory, setParentCategory] = useState<string | null>(null);
  
  // Offer - Product Search
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductResults, setShowProductResults] = useState(false);
  
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

  const [activeTab, setActiveTab] = useState<'products' | 'offers' | 'categories'>('products');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [productsData, suppliersData, zonesData, categoriesData] = await Promise.all([
        api.getProducts(),
        api.getSuppliers(),
        api.getAllZones(),
        api.getCategories(),
      ]);
      setProducts(productsData);
      setSuppliers(suppliersData);
      setZones(zonesData);
      setCategories(categoriesData);
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

  // Image handling
  const pickImage = async () => {
    if (productImages.length >= 3) {
      Alert.alert('Limit Reached', 'Maximum 3 images allowed per product');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setProductImages([...productImages, base64Image]);
    }
  };

  const addImageUrl = () => {
    if (productImages.length >= 3) {
      Alert.alert('Limit Reached', 'Maximum 3 images allowed per product');
      return;
    }

    if (!imageUrlInput.trim()) {
      Alert.alert('Error', 'Please enter an image URL');
      return;
    }

    if (!imageUrlInput.startsWith('http://') && !imageUrlInput.startsWith('https://')) {
      Alert.alert('Error', 'Please enter a valid URL starting with http:// or https://');
      return;
    }

    setProductImages([...productImages, imageUrlInput.trim()]);
    setImageUrlInput('');
  };

  const removeImage = (index: number) => {
    setProductImages(productImages.filter((_, i) => i !== index));
  };

  const handleAddProduct = async () => {
    if (!productName || !productUnit || !productCategory) {
      Alert.alert('Error', 'Please fill in Product Name, Category, and Unit');
      return;
    }

    setSubmitting(true);
    try {
      await api.createProduct({
        name: productName,
        brand: productBrand || undefined,
        barcode: productBarcode || undefined,
        unit: productUnit,
        category: productCategory,
        images: productImages,
      });
      Alert.alert('Success', 'Product added successfully');
      setProductModalVisible(false);
      resetProductForm();
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  const resetProductForm = () => {
    setProductName('');
    setProductBrand('');
    setProductBarcode('');
    setProductUnit('kg');
    setProductCategory('');
    setProductImages([]);
    setImageUrlInput('');
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    setSubmitting(true);
    try {
      await api.createCategory({
        name: categoryName.trim(),
        parent_id: parentCategory || undefined,
        description: categoryDescription.trim() || undefined,
      });
      Alert.alert('Success', 'Category created successfully');
      setCategoryModalVisible(false);
      resetCategoryForm();
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  const resetCategoryForm = () => {
    setCategoryName('');
    setCategoryDescription('');
    setParentCategory(null);
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${categoryName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteCategory(categoryId);
              Alert.alert('Success', 'Category deleted');
              fetchData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const handleCreateOffer = async () => {
    if (!selectedProduct || !selectedSupplier || !selectedZone) {
      Alert.alert('Error', 'Please select product, supplier, and zone');
      return;
    }

    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
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

  const getCategoryColor = (index: number) => {
    const colors = ['#6c5ce7', '#e74c3c', '#27ae60', '#f39c12', '#3498db', '#9b59b6'];
    return colors[index % colors.length];
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
          style={[styles.tab, activeTab === 'categories' && styles.tabActive]}
          onPress={() => setActiveTab('categories')}
        >
          <Text style={[styles.tabText, activeTab === 'categories' && styles.tabTextActive]}>
            Categories ({categories.length})
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
                {product.images && product.images.length > 0 ? (
                  <Image 
                    source={{ uri: product.images[0] }} 
                    style={styles.productImage}
                  />
                ) : (
                  <View style={styles.productIcon}>
                    <Ionicons name="cube" size={24} color="#6c5ce7" />
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productMeta}>
                    {product.brand} • {product.category_name || product.category} • {product.unit}
                  </Text>
                  {product.barcode && (
                    <Text style={styles.productBarcode}>Barcode: {product.barcode}</Text>
                  )}
                  {product.images && product.images.length > 0 && (
                    <Text style={styles.imageCount}>
                      <Ionicons name="images" size={12} color="#6c5ce7" /> {product.images.length} images
                    </Text>
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
        ) : activeTab === 'categories' ? (
          <>
            {/* Add Category Button */}
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: '#6c5ce7' }]}
              onPress={() => setCategoryModalVisible(true)}
            >
              <Ionicons name="folder-open" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Add New Category</Text>
            </TouchableOpacity>

            {/* Category Info */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color="#6c5ce7" />
              <Text style={styles.infoText}>
                Categories help organize products. When adding a product, you can select from these categories.
              </Text>
            </View>

            {/* Categories List */}
            {categories.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={64} color="#666" />
                <Text style={styles.emptyTitle}>No Categories</Text>
                <Text style={styles.emptySubtitle}>
                  Create your first category to organize products
                </Text>
              </View>
            ) : (
              categories.map((category, index) => (
                <View key={category.id}>
                  {/* Parent Category */}
                  <View style={styles.categoryCard}>
                    <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(index) + '20' }]}>
                      <Ionicons name="folder" size={24} color={getCategoryColor(index)} />
                    </View>
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      {category.description && (
                        <Text style={styles.categoryDescription}>{category.description}</Text>
                      )}
                      {category.subcategories && category.subcategories.length > 0 && (
                        <Text style={styles.subcategoryCount}>
                          {category.subcategories.length} subcategories
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteCategory(category.id, category.name)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Subcategories */}
                  {category.subcategories && category.subcategories.length > 0 && (
                    <View style={styles.subcategoriesContainer}>
                      {category.subcategories.map((sub) => (
                        <View key={sub.id} style={styles.subcategoryCard}>
                          <View style={styles.subcategoryConnector}>
                            <View style={styles.connectorLine} />
                          </View>
                          <View style={[styles.subcategoryIcon, { backgroundColor: getCategoryColor(index) + '15' }]}>
                            <Ionicons name="folder-outline" size={18} color={getCategoryColor(index)} />
                          </View>
                          <View style={styles.subcategoryInfo}>
                            <Text style={styles.subcategoryName}>{sub.name}</Text>
                            {sub.description && (
                              <Text style={styles.subcategoryDescription}>{sub.description}</Text>
                            )}
                          </View>
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDeleteCategory(sub.id, sub.name)}
                          >
                            <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
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
              {/* Product Search */}
              <Text style={styles.inputLabel}>Search Product by Name or Barcode *</Text>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#666" />
                <TextInput
                  style={styles.searchInput}
                  value={productSearchQuery}
                  onChangeText={(text) => {
                    setProductSearchQuery(text);
                    setShowProductResults(text.length > 0);
                  }}
                  placeholder="Type product name or barcode..."
                  placeholderTextColor="#666"
                  onFocus={() => setShowProductResults(productSearchQuery.length > 0)}
                />
                {productSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => {
                    setProductSearchQuery('');
                    setShowProductResults(false);
                  }}>
                    <Ionicons name="close-circle" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Selected Product Display */}
              {selectedProduct && (
                <View style={styles.selectedProductCard}>
                  <View style={styles.selectedProductInfo}>
                    <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                    <Text style={styles.selectedProductMeta}>
                      {selectedProduct.brand} • {selectedProduct.category || selectedProduct.category_name} • {selectedProduct.unit}
                    </Text>
                    {selectedProduct.barcode && (
                      <Text style={styles.selectedProductBarcode}>Barcode: {selectedProduct.barcode}</Text>
                    )}
                  </View>
                  <TouchableOpacity 
                    style={styles.clearProductBtn}
                    onPress={() => setSelectedProduct(null)}
                  >
                    <Ionicons name="close" size={20} color="#e74c3c" />
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Search Results */}
              {showProductResults && !selectedProduct && (
                <View style={styles.searchResults}>
                  {products
                    .filter(p => {
                      const query = productSearchQuery.toLowerCase();
                      return p.name.toLowerCase().includes(query) || 
                             p.brand.toLowerCase().includes(query) ||
                             (p.barcode && p.barcode.includes(productSearchQuery));
                    })
                    .slice(0, 5)
                    .map((product) => (
                      <TouchableOpacity
                        key={product.id}
                        style={styles.searchResultItem}
                        onPress={() => {
                          setSelectedProduct(product);
                          setProductSearchQuery('');
                          setShowProductResults(false);
                        }}
                      >
                        <View style={styles.searchResultIcon}>
                          <Ionicons name="cube" size={20} color="#6c5ce7" />
                        </View>
                        <View style={styles.searchResultInfo}>
                          <Text style={styles.searchResultName}>{product.name}</Text>
                          <Text style={styles.searchResultMeta}>
                            {product.brand} • {product.category || product.category_name}
                            {product.barcode ? ` • ${product.barcode}` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  {products.filter(p => {
                    const query = productSearchQuery.toLowerCase();
                    return p.name.toLowerCase().includes(query) || 
                           p.brand.toLowerCase().includes(query) ||
                           (p.barcode && p.barcode.includes(productSearchQuery));
                  }).length === 0 && (
                    <Text style={styles.noResults}>No products found</Text>
                  )}
                </View>
              )}

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
                  (!selectedProduct || !selectedSupplier || !selectedZone || submitting) && styles.createButtonDisabled,
                ]}
                onPress={handleCreateOffer}
                disabled={!selectedProduct || !selectedSupplier || !selectedZone || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.createButtonText}>Create Offer</Text>
                  </>
                )}
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
                <TouchableOpacity onPress={() => {
                  setProductModalVisible(false);
                  resetProductForm();
                }}>
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
                <Text style={styles.inputLabel}>Brand (Optional)</Text>
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
                <TouchableOpacity
                  style={styles.categoryPickerButton}
                  onPress={() => setCategoryPickerVisible(true)}
                >
                  <View style={styles.categoryPickerContent}>
                    {productCategory ? (
                      <>
                        <Ionicons name="folder" size={20} color="#6c5ce7" />
                        <Text style={styles.categoryPickerText}>{productCategory}</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="folder-outline" size={20} color="#666" />
                        <Text style={styles.categoryPickerPlaceholder}>Select Category</Text>
                      </>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
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

              {/* Image Section */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Images (up to 3)</Text>
                
                {/* Image Preview */}
                {productImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewScroll}>
                    {productImages.map((img, index) => (
                      <View key={index} style={styles.imagePreviewContainer}>
                        <Image source={{ uri: img }} style={styles.imagePreview} />
                        <TouchableOpacity 
                          style={styles.removeImageBtn}
                          onPress={() => removeImage(index)}
                        >
                          <Ionicons name="close-circle" size={24} color="#e74c3c" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                {/* Add Image Buttons */}
                {productImages.length < 3 && (
                  <View style={styles.imageButtonsRow}>
                    <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                      <Ionicons name="images" size={20} color="#6c5ce7" />
                      <Text style={styles.imageButtonText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* URL Input */}
                {productImages.length < 3 && (
                  <View style={styles.urlInputRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={imageUrlInput}
                      onChangeText={setImageUrlInput}
                      placeholder="Or paste image URL..."
                      placeholderTextColor="#666"
                    />
                    <TouchableOpacity style={styles.urlAddBtn} onPress={addImageUrl}>
                      <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.imageHint}>
                  {productImages.length}/3 images added
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]} 
                onPress={handleAddProduct}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.submitButtonText}>Add Product</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Category</Text>
              <TouchableOpacity onPress={() => {
                setCategoryModalVisible(false);
                resetCategoryForm();
              }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category Name *</Text>
              <TextInput
                style={styles.input}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="e.g., Grocery, Electronics, Personal Care"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={categoryDescription}
                onChangeText={setCategoryDescription}
                placeholder="Brief description of the category"
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Parent Category (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelectScroll}>
                <TouchableOpacity
                  style={[
                    styles.categorySelectChip,
                    parentCategory === null && styles.categorySelectChipActive,
                  ]}
                  onPress={() => setParentCategory(null)}
                >
                  <Text style={[
                    styles.categorySelectText,
                    parentCategory === null && styles.categorySelectTextActive,
                  ]}>
                    None (Top Level)
                  </Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categorySelectChip,
                      parentCategory === cat.id && styles.categorySelectChipActive,
                    ]}
                    onPress={() => setParentCategory(cat.id)}
                  >
                    <Text style={[
                      styles.categorySelectText,
                      parentCategory === cat.id && styles.categorySelectTextActive,
                    ]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: '#6c5ce7' }, submitting && styles.submitButtonDisabled]} 
              onPress={handleAddCategory}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="folder-open" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Create Category</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        visible={categoryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%', paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => {
                setCategoryPickerVisible(false);
                setExpandedCategory(null);
              }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.categoryPickerList} showsVerticalScrollIndicator={false}>
              {categories.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="folder-open-outline" size={48} color="#666" />
                  <Text style={styles.emptyTitle}>No Categories</Text>
                  <Text style={styles.emptySubtitle}>Go to Categories tab to create categories first</Text>
                </View>
              ) : (
                categories.map((cat) => (
                  <View key={cat.id}>
                    {/* Parent Category Row */}
                    <TouchableOpacity
                      style={[
                        styles.categoryPickerItem,
                        productCategory === cat.name && styles.categoryPickerItemSelected,
                      ]}
                      onPress={() => {
                        if (cat.subcategories && cat.subcategories.length > 0) {
                          // Toggle expand if has subcategories
                          setExpandedCategory(expandedCategory === cat.id ? null : cat.id);
                        } else {
                          // Select if no subcategories
                          setProductCategory(cat.name);
                          setCategoryPickerVisible(false);
                          setExpandedCategory(null);
                        }
                      }}
                    >
                      <View style={styles.categoryPickerItemLeft}>
                        <View style={[styles.categoryPickerIcon, { backgroundColor: 'rgba(108, 92, 231, 0.2)' }]}>
                          <Ionicons name="folder" size={20} color="#6c5ce7" />
                        </View>
                        <View>
                          <Text style={styles.categoryPickerItemName}>{cat.name}</Text>
                          {cat.subcategories && cat.subcategories.length > 0 && (
                            <Text style={styles.categoryPickerItemCount}>
                              {cat.subcategories.length} subcategories
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.categoryPickerItemRight}>
                        {productCategory === cat.name && (
                          <Ionicons name="checkmark-circle" size={22} color="#27ae60" />
                        )}
                        {cat.subcategories && cat.subcategories.length > 0 && (
                          <Ionicons 
                            name={expandedCategory === cat.id ? "chevron-down" : "chevron-forward"} 
                            size={20} 
                            color="#666" 
                          />
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Subcategories (Collapsible) */}
                    {expandedCategory === cat.id && cat.subcategories && cat.subcategories.map((sub) => (
                      <TouchableOpacity
                        key={sub.id}
                        style={[
                          styles.categoryPickerItem,
                          styles.categoryPickerSubItem,
                          productCategory === sub.name && styles.categoryPickerItemSelected,
                        ]}
                        onPress={() => {
                          setProductCategory(sub.name);
                          setCategoryPickerVisible(false);
                          setExpandedCategory(null);
                        }}
                      >
                        <View style={styles.categoryPickerItemLeft}>
                          <View style={[styles.categoryPickerIcon, { backgroundColor: 'rgba(39, 174, 96, 0.2)' }]}>
                            <Ionicons name="folder-outline" size={18} color="#27ae60" />
                          </View>
                          <Text style={styles.categoryPickerItemName}>{sub.name}</Text>
                        </View>
                        {productCategory === sub.name && (
                          <Ionicons name="checkmark-circle" size={22} color="#27ae60" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>

            {/* Quick select parent category button */}
            {expandedCategory && (
              <TouchableOpacity
                style={styles.selectParentButton}
                onPress={() => {
                  const parent = categories.find(c => c.id === expandedCategory);
                  if (parent) {
                    setProductCategory(parent.name);
                    setCategoryPickerVisible(false);
                    setExpandedCategory(null);
                  }
                }}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.selectParentButtonText}>
                  Select "{categories.find(c => c.id === expandedCategory)?.name}" as category
                </Text>
              </TouchableOpacity>
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
    fontSize: 12,
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  infoText: {
    color: '#a0a0a0',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#a0a0a0',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
  imageCount: {
    color: '#6c5ce7',
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
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  categoryName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryDescription: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 2,
  },
  categoryParent: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  subcategoryCount: {
    color: '#6c5ce7',
    fontSize: 11,
    marginTop: 4,
  },
  subcategoriesContainer: {
    marginLeft: 24,
    marginBottom: 8,
  },
  subcategoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151525',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  subcategoryConnector: {
    width: 16,
    alignItems: 'center',
  },
  connectorLine: {
    width: 2,
    height: 24,
    backgroundColor: '#2d2d44',
    position: 'absolute',
    top: -16,
  },
  subcategoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subcategoryInfo: {
    flex: 1,
    marginLeft: 10,
  },
  subcategoryName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  subcategoryDescription: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  selectedProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  selectedProductInfo: {
    flex: 1,
  },
  selectedProductName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedProductMeta: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 2,
  },
  selectedProductBarcode: {
    color: '#6c5ce7',
    fontSize: 11,
    marginTop: 2,
  },
  clearProductBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResults: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  searchResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  searchResultMeta: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  noResults: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  inputGroup: {
    marginBottom: 16,
  },
  categorySelectScroll: {
    marginTop: 8,
  },
  categorySelectContainer: {
    marginTop: 8,
  },
  categoryGroupLabel: {
    color: '#a0a0a0',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categorySelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#0f0f1a',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
    gap: 6,
  },
  subcategoryChip: {
    borderColor: 'rgba(39, 174, 96, 0.3)',
  },
  categorySelectChipActive: {
    backgroundColor: '#6c5ce7',
    borderColor: '#6c5ce7',
  },
  categorySelectText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  categorySelectTextActive: {
    color: '#fff',
  },
  // Category Picker Button (New Product Screen)
  categoryPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  categoryPickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryPickerText: {
    color: '#fff',
    fontSize: 16,
  },
  categoryPickerPlaceholder: {
    color: '#666',
    fontSize: 16,
  },
  // Category Picker Modal
  categoryPickerList: {
    flex: 1,
  },
  categoryPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  categoryPickerSubItem: {
    marginLeft: 24,
    backgroundColor: '#0f0f1a',
  },
  categoryPickerItemSelected: {
    borderWidth: 1,
    borderColor: '#27ae60',
  },
  categoryPickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryPickerItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryPickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPickerItemName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  categoryPickerItemCount: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  selectParentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  selectParentButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  imagePreviewScroll: {
    marginBottom: 12,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginRight: 12,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#0f0f1a',
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  imageButtonText: {
    color: '#6c5ce7',
    fontSize: 14,
    fontWeight: '600',
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  urlAddBtn: {
    backgroundColor: '#6c5ce7',
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
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
  submitButtonDisabled: {
    backgroundColor: '#4a4a5e',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
