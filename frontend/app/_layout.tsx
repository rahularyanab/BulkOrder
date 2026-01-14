import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { notificationService } from '../src/services/notifications';
import * as Notifications from 'expo-notifications';

export default function RootLayout() {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    // Register for push notifications on app start
    notificationService.registerForPushNotifications();

    // Listen for notifications when app is in foreground
    notificationListener.current = notificationService.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Listen for user interaction with notifications
    responseListener.current = notificationService.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Handle navigation based on notification data
      const data = response.notification.request.content.data;
      if (data?.type) {
        // You can add navigation logic here based on notification type
        console.log('Notification type:', data.type);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: '#0f0f1a' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/phone" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/otp" options={{ title: 'Verify OTP' }} />
          <Stack.Screen name="(auth)/signup" options={{ title: 'Complete Signup' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
