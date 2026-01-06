import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function OrdersScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <Ionicons name="receipt-outline" size={80} color="#666" />
        <Text style={styles.title}>No Orders Yet</Text>
        <Text style={styles.subtitle}>
          Your orders will appear here once you start ordering from the catalog.
        </Text>
      </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
  },
  subtitle: {
    color: '#a0a0a0',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
});
