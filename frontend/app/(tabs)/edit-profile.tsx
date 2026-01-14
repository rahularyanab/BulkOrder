import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

export default function EditProfileScreen() {
  const router = useRouter();
  const { retailer, setRetailer } = useAuth();
  
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (retailer) {
      setShopName(retailer.shop_name || '');
      setOwnerName(retailer.owner_name || '');
      setAddress(retailer.address || '');
    }
  }, [retailer]);

  const handleSave = async () => {
    if (!shopName.trim()) {
      Alert.alert('Error', 'Shop name is required');
      return;
    }
    if (!ownerName.trim()) {
      Alert.alert('Error', 'Owner name is required');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Error', 'Address is required');
      return;
    }

    setIsLoading(true);
    try {
      const updatedRetailer = await api.updateRetailer({
        shop_name: shopName.trim(),
        owner_name: ownerName.trim(),
        address: address.trim(),
      });
      
      setRetailer(updatedRetailer);
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Update error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Shop Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Name *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="storefront-outline" size={20} color="#6c5ce7" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={shopName}
                onChangeText={setShopName}
                placeholder="Enter shop name"
                placeholderTextColor="#666"
              />
            </View>
          </View>

          {/* Owner Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Owner Name *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#6c5ce7" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={ownerName}
                onChangeText={setOwnerName}
                placeholder="Enter owner name"
                placeholderTextColor="#666"
              />
            </View>
          </View>

          {/* Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <Ionicons name="location-outline" size={20} color="#6c5ce7" style={[styles.inputIcon, styles.textAreaIcon]} />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter shop address"
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Phone (Read Only) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={[styles.inputContainer, styles.readOnly]}>
              <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.readOnlyText]}
                value={retailer?.phone || ''}
                editable={false}
              />
              <Ionicons name="lock-closed" size={16} color="#666" />
            </View>
            <Text style={styles.helperText}>Phone number cannot be changed</Text>
          </View>

          {/* Location (Read Only) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>GPS Location</Text>
            <View style={[styles.inputContainer, styles.readOnly]}>
              <Ionicons name="navigate-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.readOnlyText]}
                value={retailer?.location ? `${retailer.location.latitude.toFixed(4)}, ${retailer.location.longitude.toFixed(4)}` : ''}
                editable={false}
              />
              <Ionicons name="lock-closed" size={16} color="#666" />
            </View>
            <Text style={styles.helperText}>Contact support to update location</Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity 
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
  },
  textAreaContainer: {
    alignItems: 'flex-start',
  },
  textAreaIcon: {
    marginTop: 14,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  readOnly: {
    backgroundColor: '#12121a',
    borderColor: '#1a1a2e',
  },
  readOnlyText: {
    color: '#666',
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
