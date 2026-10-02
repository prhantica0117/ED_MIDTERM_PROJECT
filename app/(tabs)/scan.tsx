import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import { registerAttendance } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';

export default function ScanScreen() {
  const { user } = useAuth();
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionText}>
            We need your permission to show the camera so you can scan event QR codes.
          </Text>
          <AppButton
            onPress={requestPermission}
            title="Grant Permission"
            icon="camera-outline"
            theme="primary"
          />
        </View>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    if (!user?.id) {
      Alert.alert('Error', 'User session not found. Please log in again.');
      return;
    }

    const result = await registerAttendance(data, user.id);

    if (result.success) {
      Alert.alert('Success', `${result.message}\nEvent: ${result.eventTitle}`);
    } else {
      Alert.alert('Attendance Failed', result.message);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.hint}>
          {scanned ? 'Scan complete' : 'Align the QR code inside the frame'}
        </Text>
      </View>

      {scanned && (
        <View style={styles.actionBar}>
          <AppButton
            title="Scan Again"
            icon="refresh-outline"
            theme="primary"
            onPress={() => setScanned(false)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.textPrimary },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: GUTTER,
  },
  permissionCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xxl,
  },
  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.xxl,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: GUTTER,
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: RADIUS.xl,
    borderWidth: 3,
    borderColor: COLORS.textOnPrimary,
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
  },
  hint: {
    marginTop: SPACING.xl,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textOnPrimary,
    textAlign: 'center',
  },
  actionBar: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
    bottom: SPACING.xxxl,
  },
});