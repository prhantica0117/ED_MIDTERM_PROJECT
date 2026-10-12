import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import AppButton from '@/components/AppButton';
import FeedbackBanner from '@/components/FeedbackBanner';
import FormField from '@/components/FormField';
import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import { registerAttendance, actionLabel, formatClock, type ScanResult } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { canScan, useRole } from '@/lib/roles';

function failureTone(code: string): 'error' | 'warning' {
  if (
    code === 'duplicate' ||
    code === 'not_started' ||
    code === 'wrong_window' ||
    code === 'ended'
  ) {
    return 'warning';
  }
  return 'error';
}

export default function ScanScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole(user?.id);
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState('');

  // Reset scanner state whenever the screen regains focus
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setResult(null);
      setProcessing(false);
    }, [])
  );

  const processScan = useCallback(
    async (payload: string) => {
      if (processing || scanned) return;
      setScanned(true);
      setProcessing(true);
      setResult(null);

      try {
        const outcome = await registerAttendance(payload, user?.id ?? '');
        setResult(outcome);
      } catch {
        setResult({ ok: false, code: 'db_error', message: 'Unexpected error. Try again.' });
      } finally {
        setProcessing(false);
      }
    },
    [processing, scanned, user]
  );

  // Event: QR scanner detects a code → handler → validate & record
  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned) return;
      processScan(data);
    },
    [scanned, processScan]
  );

  const resetScanner = () => {
    setScanned(false);
    setResult(null);
    setManualCode('');
  };

  // ── Authorization: only students may record attendance ────────────────
  if (!roleLoading && !canScan(role)) {
    return (
      <View style={styles.container}>
        <Header title="Scan QR" />
        <View style={styles.centered}>
          <GlassCard style={styles.lockCard}>
            <Ionicons name="lock-closed-outline" size={48} color={COLORS.crimsonLight} />
            <Text style={styles.lockTitle}>Unauthorized</Text>
            <Text style={styles.lockText}>
              Only student accounts can record attendance. Teachers and administrators create and
              manage the QR codes instead.
            </Text>
          </GlassCard>
        </View>
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  const cameraReady = Platform.OS !== 'web' && permission.granted;

  // ── Camera permission flow ────────────────────────────────────────────
  if (Platform.OS !== 'web' && !permission.granted) {
    return (
      <View style={styles.container}>
        <Header title="Scan QR" />
        <View style={styles.centered}>
          <GlassCard style={styles.lockCard}>
            <View style={styles.permIcon}>
              <Ionicons name="camera-outline" size={36} color={COLORS.accent} />
            </View>
            <Text style={styles.lockTitle}>Camera access needed</Text>
            <Text style={styles.lockText}>
              We need the camera so you can scan event QR codes.
            </Text>
            <AppButton
              onPress={requestPermission}
              title="Grant Permission"
              icon="camera-outline"
              theme="primary"
            />
          </GlassCard>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Scan QR"
        subtitle="Scan during your Check-In / Check-Out window"
      />

      {cameraReady && !result ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.frame} />
            <Text style={styles.hint}>
              {processing ? 'Verifying…' : 'Align the QR code inside the frame'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Result feedback — success, invalid QR, duplicate, closed event… */}
      {result && !processing ? (
        <GlassCard style={styles.resultCard}>
          {result.ok ? (
            <>
              <Ionicons
                name={result.action === 'check_out' ? 'log-out-outline' : 'checkmark-circle'}
                size={42}
                color={result.action === 'check_out' ? '#F7C46B' : '#5FE0A0'}
              />
              <Text style={styles.resultTitle}>
                {actionLabel(result.action)} Recorded!
              </Text>
              <Text style={styles.resultEvent}>{result.event.title}</Text>
              <Text style={styles.resultMeta}>
                {result.event.venue ? `📍 ${result.event.venue}` : 'Venue TBA'}
              </Text>
              <Text style={styles.resultMeta}>
                {formatClock(result.windowStart)} – {formatClock(result.windowEnd)} window ·{' '}
                {result.status.toUpperCase()}
              </Text>
              <Text style={styles.resultMeta}>
                Scanned at {new Date(result.recordedAt).toLocaleTimeString()}
              </Text>
              <Text style={styles.resultCode}>Code: {result.event.eventCode}</Text>
              <AppButton
                theme="primary"
                title="Scan Another Code"
                icon="refresh-outline"
                onPress={resetScanner}
              />
            </>
          ) : (
            <>
              <FeedbackBanner
                tone={failureTone(result.code)}
                title="Attendance not recorded"
                message={result.message}
              />
              <View style={{ height: SPACING.md }} />
              <AppButton
                theme="primary"
                title="Try Again"
                icon="refresh-outline"
                onPress={resetScanner}
              />
            </>
          )}
        </GlassCard>
      ) : null}

      {/* Manual entry — works on web / when the camera is unavailable */}
      {(!cameraReady || result) && !processing ? (
        <GlassCard style={styles.manualCard}>
          <Text style={styles.manualTitle}>Enter event code manually</Text>
          <Text style={styles.manualHint}>
            Type the event code shown by your teacher (e.g. EVT-2026-4F2K).
          </Text>
          <FormField
            label="Event Code"
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="EVT-2026-4F2K"
            autoCapitalize="characters"
          />
          <AppButton
            theme="primary"
            title="Record Attendance"
            icon="checkmark-circle-outline"
            disabled={!manualCode.trim()}
            onPress={() =>
              processScan(JSON.stringify({ v: 1, event: manualCode.trim().toUpperCase() }))
            }
          />
        </GlassCard>
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: GUTTER,
    paddingBottom: SPACING.xl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  lockCard: {
    alignItems: 'center',
    padding: SPACING.xxl,
    gap: SPACING.sm,
  },
  lockTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  lockText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  permIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(11, 48, 152, 0.45)',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrap: {
    height: 340,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    marginBottom: SPACING.lg,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 200,
    height: 200,
    borderRadius: RADIUS.md,
    borderWidth: 3,
    borderColor: COLORS.white,
    backgroundColor: 'rgba(5, 11, 34, 0.25)',
  },
  hint: {
    marginTop: SPACING.lg,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
    backgroundColor: 'rgba(5, 11, 34, 0.75)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  resultCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  resultEvent: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accent,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  resultMeta: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  resultCode: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  manualCard: {
    padding: SPACING.lg,
  },
  manualTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  manualHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
});
