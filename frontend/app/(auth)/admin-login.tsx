import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const ADMIN_PHONE = '9999999999';
const ADMIN_PASSWORD = 'Password123';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordLogin = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    setIsLoading(true);
    try {
      // Use the admin login endpoint
      const response = await api.adminPasswordLogin(ADMIN_PHONE, password);
      if (response.token) {
        // login(token, isNewUser, retailerId) - admin is not a new user, no retailerId
        await login(response.token, false, null);
        router.replace('/(admin)/dashboard');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async () => {
    setIsLoading(true);
    try {
      const response = await api.sendOTP(ADMIN_PHONE);
      if (response.success) {
        setOtpSent(true);
        Alert.alert('OTP Sent', `Your OTP is: ${response.otp}`);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPLogin = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.verifyOTP(ADMIN_PHONE, otp);
      if (response.token) {
        await login(response.token, ADMIN_PHONE, true);
        router.replace('/(admin)/dashboard');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={50} color="#e74c3c" />
          </View>
          <Text style={styles.title}>Admin Login</Text>
          <Text style={styles.subtitle}>Access the admin dashboard</Text>
        </View>

        {/* Login Method Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, loginMethod === 'password' && styles.toggleButtonActive]}
            onPress={() => setLoginMethod('password')}
          >
            <Ionicons 
              name="key" 
              size={18} 
              color={loginMethod === 'password' ? '#fff' : '#666'} 
            />
            <Text style={[styles.toggleText, loginMethod === 'password' && styles.toggleTextActive]}>
              Password
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, loginMethod === 'otp' && styles.toggleButtonActive]}
            onPress={() => setLoginMethod('otp')}
          >
            <Ionicons 
              name="chatbubble" 
              size={18} 
              color={loginMethod === 'otp' ? '#fff' : '#666'} 
            />
            <Text style={[styles.toggleText, loginMethod === 'otp' && styles.toggleTextActive]}>
              OTP
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {loginMethod === 'password' ? (
            <>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter Password"
                  placeholderTextColor="#666"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.button, !password && styles.buttonDisabled]}
                onPress={handlePasswordLogin}
                disabled={!password || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Login</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {!otpSent ? (
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleSendOTP}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Send OTP to {ADMIN_PHONE}</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Ionicons name="keypad" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor="#666"
                      keyboardType="number-pad"
                      value={otp}
                      onChangeText={setOtp}
                      maxLength={6}
                      autoFocus
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.button, otp.length !== 6 && styles.buttonDisabled]}
                    onPress={handleOTPLogin}
                    disabled={otp.length !== 6 || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Verify & Login</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.resendButton} onPress={handleSendOTP}>
                    <Text style={styles.resendText}>Resend OTP</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#6c5ce7" />
          <Text style={styles.infoText}>
            Admin access is restricted. Contact support if you need access.
          </Text>
        </View>
      </KeyboardAvoidingView>
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
    padding: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    marginTop: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#e74c3c',
  },
  toggleText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    padding: 16,
  },
  button: {
    backgroundColor: '#e74c3c',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#4a4a5e',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    padding: 12,
  },
  resendText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 32,
    gap: 12,
  },
  infoText: {
    flex: 1,
    color: '#a0a0a0',
    fontSize: 13,
    lineHeight: 18,
  },
});
