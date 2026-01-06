import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

export default function SignupScreen() {
  const router = useRouter();
  const { phone, setRetailer } = useAuth();
  
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please enable it in settings.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    } catch (error) {
      setLocationError('Failed to get location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!shopName || !ownerName || !address) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Location is required. Please enable GPS.');
      return;
    }

    setIsLoading(true);
    try {
      const retailerData = {
        shop_name: shopName,
        owner_name: ownerName,
        phone: phone!,
        address: address,
        location: location,
      };

      const retailer = await api.createRetailer(retailerData);
      setRetailer(retailer);
      
      Alert.alert(
        'Success',
        `Welcome to GroupBuy! You've been added to ${retailer.zone_ids.length} zone(s).`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/home') }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to complete signup');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = shopName && ownerName && address && location;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Ionicons name="storefront" size={60} color="#6c5ce7" />
            <Text style={styles.title}>Setup Your Shop</Text>
            <Text style={styles.subtitle}>Enter your shop details to get started</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Shop Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter shop name"
                placeholderTextColor="#666"
                value={shopName}
                onChangeText={setShopName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Owner Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter owner name"
                placeholderTextColor="#666"
                value={ownerName}
                onChangeText={setOwnerName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Shop Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter complete address"
                placeholderTextColor="#666"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>GPS Location</Text>
              <View style={styles.locationContainer}>
                {locationLoading ? (
                  <View style={styles.locationStatus}>
                    <ActivityIndicator color="#6c5ce7" />
                    <Text style={styles.locationText}>Getting location...</Text>
                  </View>
                ) : locationError ? (
                  <View style={styles.locationStatus}>
                    <Ionicons name="warning" size={20} color="#e74c3c" />
                    <Text style={styles.locationError}>{locationError}</Text>
                    <TouchableOpacity onPress={requestLocation} style={styles.retryButton}>
                      <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : location ? (
                  <View style={styles.locationStatus}>
                    <Ionicons name="checkmark-circle" size={20} color="#27ae60" />
                    <Text style={styles.locationSuccess}>
                      Location captured: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, !isFormValid && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Complete Signup</Text>
              )}
            </TouchableOpacity>
          </View>
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
  flex: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    marginTop: 8,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
    color: '#fff',
    fontSize: 16,
    padding: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
    padding: 16,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  locationSuccess: {
    color: '#27ae60',
    fontSize: 14,
    flex: 1,
  },
  locationError: {
    color: '#e74c3c',
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#6c5ce7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    backgroundColor: '#4a4a5e',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
