import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

interface Zone {
  id: string;
  name: string;
  center: { latitude: number; longitude: number };
  radius_km: number;
  retailer_count: number;
}

export default function HomeScreen() {
  const { retailer } = useAuth();
  const router = useRouter();
  const [zones, setZones] = useState<Zone[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchZones = async () => {
    try {
      const data = await api.getRetailerZones();
      setZones(data);
    } catch (error) {
      console.error('Failed to fetch zones:', error);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchZones();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />
        }
      >
        {/* Welcome Section */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeHeader}>
            <Ionicons name="storefront" size={40} color="#6c5ce7" />
            <View style={styles.welcomeText}>
              <Text style={styles.greeting}>Welcome back!</Text>
              <Text style={styles.shopName}>{retailer?.shop_name}</Text>
            </View>
          </View>
          <Text style={styles.ownerName}>{retailer?.owner_name}</Text>
        </View>

        {/* Stats Section */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="location" size={24} color="#6c5ce7" />
            <Text style={styles.statValue}>{zones.length}</Text>
            <Text style={styles.statLabel}>Active Zones</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cart" size={24} color="#27ae60" />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Pending Orders</Text>
          </View>
        </View>

        {/* Zones Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Zones</Text>
          {zones.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="map-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>No zones available</Text>
            </View>
          ) : (
            zones.map((zone) => (
              <TouchableOpacity key={zone.id} style={styles.zoneCard}>
                <View style={styles.zoneInfo}>
                  <View style={styles.zoneIcon}>
                    <Ionicons name="location" size={24} color="#6c5ce7" />
                  </View>
                  <View style={styles.zoneDetails}>
                    <Text style={styles.zoneName}>{zone.name}</Text>
                    <Text style={styles.zoneStats}>
                      {zone.retailer_count} retailers • {zone.radius_km} km radius
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="add-circle" size={32} color="#6c5ce7" />
              <Text style={styles.actionText}>New Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="list" size={32} color="#27ae60" />
              <Text style={styles.actionText}>View Catalog</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="time" size={32} color="#f39c12" />
              <Text style={styles.actionText}>Order History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  welcomeCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  welcomeText: {
    marginLeft: 16,
  },
  greeting: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  shopName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  ownerName: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 4,
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
  emptyCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    marginTop: 12,
  },
  zoneCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  zoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneDetails: {
    marginLeft: 12,
  },
  zoneName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  zoneStats: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
