import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { GUTTER, SPACING } from '@/constants/theme';

export default function Index() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Header title="QR Attendance" subtitle="Developed by: Paul Rye M. Hantica" />
      </View>

      <View style={styles.bodyContainer}>
        <Text style={styles.mainTitle}>School Event Attendance</Text>
        <Text style={styles.subtitle}>
          Scan QR codes to record attendance during school activities.
        </Text>
      </View>

      <View style={styles.footerContainer}>
        <AppButton
          theme="primary"
          title="Scan QR Code"
          icon="qr-code-outline"
          onPress={() => router.push('/scan')}
        />
        <AppButton
          title="Attendance History"
          icon="time-outline"
          onPress={() => router.push('/history')}
        />
        <AppButton
          title="Profile"
          icon="person-outline"
          onPress={() => router.push('/profile')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  bodyContainer: {
    paddingHorizontal: GUTTER,
    marginTop: SPACING.xxl,
    marginBottom: SPACING.xxl,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 21,
    textAlign: 'center',
  },
  footerContainer: {
    marginTop: 'auto',
    paddingHorizontal: GUTTER,
    paddingBottom: SPACING.xxl,
    width: '100%',
  },
});