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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

interface DashboardStats {
  offers: {
    open: number;
    ready_to_pack: number;
    delivered: number;
  };
  orders: {
    total: number;
    pending: number;
    delivered: number;
  };
  retailers: number;
  zones: number;
  payments: {
    total: number;
    locked: number;
    disputed: number;
    total_revenue: number;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/phone');
          }
        },
      ]
    );
  };

  const fetchStats = async () => {
    try {
      const data = await api.getAdminDashboardStats();
      setStats(data);
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
      if (error.response?.status === 403) {
        alert('Admin access required. Please login with admin phone number.');
        router.replace('/(auth)/phone');
      }
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e74c3c" />
        }
      >
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={40} color="#e74c3c" />
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
        </View>

        {/* Offers Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offers Overview</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderLeftColor: '#f39c12' }]}>
              <Text style={styles.statValue}>{stats?.offers.open || 0}</Text>
              <Text style={styles.statLabel}>Open</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#27ae60' }]}>
              <Text style={styles.statValue}>{stats?.offers.ready_to_pack || 0}</Text>
              <Text style={styles.statLabel}>Ready to Pack</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#3498db' }]}>
              <Text style={styles.statValue}>{stats?.offers.delivered || 0}</Text>
              <Text style={styles.statLabel}>Delivered</Text>
            </View>
          </View>
        </View>

        {/* Orders Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Orders Overview</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderLeftColor: '#6c5ce7' }]}>
              <Text style={styles.statValue}>{stats?.orders.total || 0}</Text>
              <Text style={styles.statLabel}>Total Orders</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#f39c12' }]}>
              <Text style={styles.statValue}>{stats?.orders.pending || 0}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#27ae60' }]}>
              <Text style={styles.statValue}>{stats?.orders.delivered || 0}</Text>
              <Text style={styles.statLabel}>Delivered</Text>
            </View>
          </View>
        </View>

        {/* Revenue & Payments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments & Revenue</Text>
          <View style={styles.revenueCard}>
            <Ionicons name="cash" size={32} color="#27ae60" />
            <View style={styles.revenueInfo}>
              <Text style={styles.revenueLabel}>Total Revenue</Text>
              <Text style={styles.revenueValue}>Rs. {stats?.payments.total_revenue?.toLocaleString() || 0}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderLeftColor: '#f39c12' }]}>
              <Text style={styles.statValue}>{stats?.payments.locked || 0}</Text>
              <Text style={styles.statLabel}>Locked</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#e74c3c' }]}>
              <Text style={styles.statValue}>{stats?.payments.disputed || 0}</Text>
              <Text style={styles.statLabel}>Disputed</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Stats</Text>
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Ionicons name="storefront" size={24} color="#6c5ce7" />
              <Text style={styles.quickStatValue}>{stats?.retailers || 0}</Text>
              <Text style={styles.quickStatLabel}>Retailers</Text>
            </View>
            <View style={styles.quickStatItem}>
              <Ionicons name="location" size={24} color="#e74c3c" />
              <Text style={styles.quickStatValue}>{stats?.zones || 0}</Text>
              <Text style={styles.quickStatLabel}>Zones</Text>
            </View>
            <View style={styles.quickStatItem}>
              <Ionicons name="card" size={24} color="#27ae60" />
              <Text style={styles.quickStatValue}>{stats?.payments.total || 0}</Text>
              <Text style={styles.quickStatLabel}>Payments</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(admin)/fulfillment')}>
            <Ionicons name="cube" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Manage Fulfillment</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(admin)/payments')}>
            <Ionicons name="card" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Manage Payments</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
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
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 4,
  },
  revenueCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  revenueInfo: {
    flex: 1,
  },
  revenueLabel: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  revenueValue: {
    color: '#27ae60',
    fontSize: 28,
    fontWeight: 'bold',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'space-around',
  },
  quickStatItem: {
    alignItems: 'center',
  },
  quickStatValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  quickStatLabel: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
});
