import React from 'react';
import { View, Text } from 'react-native';

export default function TestScreen() {
  const renderProductCard = (product: any) => (
    <View>
      <Text>Test</Text>
    </View>
  );

  if (true) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View>
      <Text>Main content</Text>
    </View>
  );
}