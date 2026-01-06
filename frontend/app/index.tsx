import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, retailer } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && retailer) {
        router.replace('/(tabs)/home');
      } else if (isAuthenticated && !retailer) {
        router.replace('/(auth)/signup');
      } else {
        router.replace('/(auth)/phone');
      }
    }
  }, [isLoading, isAuthenticated, retailer]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Ionicons name="cart" size={80} color="#6c5ce7" />
        <Text style={styles.title}>GroupBuy</Text>
        <Text style={styles.subtitle}>Retail Ordering Made Easy</Text>
      </View>
      <ActivityIndicator size="large" color="#6c5ce7" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    marginTop: 8,
  },
  loader: {
    marginTop: 40,
  },
});
