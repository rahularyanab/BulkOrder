import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;

  async registerForPushNotifications(): Promise<string | null> {
    try {
      // Check if physical device (notifications don't work on simulator)
      if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return null;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-project-id', // Will be auto-detected in EAS builds
      });
      
      this.expoPushToken = tokenData.data;
      console.log('Expo Push Token:', this.expoPushToken);

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#e74c3c',
        });

        // Create separate channels for different notification types
        await Notifications.setNotificationChannelAsync('orders', {
          name: 'Orders',
          description: 'Order status updates',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('bids', {
          name: 'Bids',
          description: 'Bid request updates',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('offers', {
          name: 'Offers',
          description: 'New offers and price updates',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  async savePushToken(isAdmin: boolean = false): Promise<void> {
    if (!this.expoPushToken) {
      await this.registerForPushNotifications();
    }

    if (this.expoPushToken) {
      try {
        await api.savePushToken(this.expoPushToken, isAdmin);
        console.log('Push token saved to server');
      } catch (error) {
        console.error('Error saving push token:', error);
      }
    }
  }

  getToken(): string | null {
    return this.expoPushToken;
  }

  // Add notification listeners
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  // Get last notification response (for when app opens from notification)
  async getLastNotificationResponse() {
    return await Notifications.getLastNotificationResponseAsync();
  }

  // Schedule a local notification (for testing)
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null, // Immediately
    });
  }

  // Clear all notifications
  async clearAllNotifications() {
    await Notifications.dismissAllNotificationsAsync();
  }

  // Set badge count
  async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
  }
}

export const notificationService = new NotificationService();
