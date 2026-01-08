import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet } from 'react-native';
import { api } from '../../src/services/api';

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  const [pendingBidsCount, setPendingBidsCount] = useState(0);
  
  const fetchPendingBidsCount = async () => {
    try {
      const bids = await api.getAdminBidRequests('pending');
      setPendingBidsCount(bids.length);
    } catch (error) {
      console.error('Failed to fetch pending bids count:', error);
    }
  };
  
  // Fetch on mount and periodically
  useEffect(() => {
    fetchPendingBidsCount();
    const interval = setInterval(fetchPendingBidsCount, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);
  
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#2d2d44',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#e74c3c',
        tabBarInactiveTintColor: '#666',
        headerStyle: {
          backgroundColor: '#1a1a2e',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Catalog',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pricetags" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bids"
        options={{
          title: 'Bids',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="hand-left" size={size} color={color} />
              {pendingBidsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {pendingBidsCount > 9 ? '9+' : pendingBidsCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
        listeners={{
          focus: () => fetchPendingBidsCount(),
        }}
      />
      <Tabs.Screen
        name="fulfillment"
        options={{
          title: 'Fulfillment',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
