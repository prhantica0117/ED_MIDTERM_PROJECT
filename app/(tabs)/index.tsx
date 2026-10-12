import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import StatusPill from '@/components/StatusPill';
import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import {
  getStaffSummary,
  getStudentSummary,
  watchAttendance,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { listEvents, type CloudEvent } from '@/lib/events';
import { ROLE_LABEL, isStaff, useRole } from '@/lib/roles';

function formatDate(iso: string | null) {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'TBA';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatTile({
  icon,
  value,
  label,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
  tone: 'blue' | 'crimson' | 'brown' | 'green';
}) {
  const bg =
    tone === 'crimson'
      ? 'rgba(189, 27, 32, 0.22)'
      : tone === 'brown'
        ? 'rgba(110, 69, 54, 0.40)'
        : tone === 'green'
          ? 'rgba(47, 191, 113, 0.16)'
          : 'rgba(11, 48, 152, 0.45)';
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={COLORS.textPrimary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { profile, role, loading: roleLoading } = useRole(user?.id);

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ primary: 0, secondary: 0, tertiary: 0 });
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user || !role) return;

    try {
      if (isStaff(role)) {
        const summary = await getStaffSummary(role === 'admin' ? null : user.id);
        setStats({
          primary: summary.totalEvents,
          secondary: summary.openEvents,
          tertiary: summary.totalCheckIns,
        });
      } else {
        const summary = await getStudentSummary(user.id);
        setStats({ primary: summary.totalAttended, secondary: summary.openEvents, tertiary: 0 });
      }
      const open = await listEvents({ status: 'open', limit: 4 });
      setEvents(open);
    } finally {
      setLoaded(true);
    }
  }, [user, role]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Realtime: attendance INSERT (student scanned) → staff stats refresh live
  useFocusEffect(
    useCallback(() => {
      if (!role || !isStaff(role)) return;
      const unsubscribe = watchAttendance(() => {
        load();
      });
      return unsubscribe;
    }, [role, load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const staff = isStaff(role);
  const firstName = (profile?.full_name ?? user?.email ?? 'there').split(' ')[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
      }
    >
      <Header title="QR Attendance" subtitle="School Event Management" />

      <GlassCard style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroText}>
            <Text style={styles.hello}>Hello, {firstName} 👋</Text>
            <Text style={styles.heroSub}>
              {staff
                ? 'Manage events and monitor attendance in real time.'
                : 'Scan event QR codes to record your attendance.'}
            </Text>
          </View>
          <StatusPill
            label={profile ? ROLE_LABEL[profile.role] : '…'}
            tone={
              profile?.role === 'admin'
                ? 'admin'
                : profile?.role === 'teacher'
                  ? 'teacher'
                  : 'student'
            }
          />
        </View>
      </GlassCard>

      <View style={styles.statsRow}>
        {staff ? (
          <>
            <StatTile icon="calendar" value={stats.primary} label="Events" tone="blue" />
            <StatTile icon="lock-open" value={stats.secondary} label="Open" tone="green" />
            <StatTile icon="people" value={stats.tertiary} label="Check-ins" tone="crimson" />
          </>
        ) : (
          <>
            <StatTile icon="checkmark-done" value={stats.primary} label="Attended" tone="blue" />
            <StatTile icon="lock-open" value={stats.secondary} label="Open Now" tone="green" />
            <StatTile icon="school" value="2026" label="School Year" tone="brown" />
          </>
        )}
      </View>

      <View style={styles.actions}>
        {staff ? (
          <AppButton
            theme="primary"
            title="Manage Events"
            icon="calendar-outline"
            onPress={() => router.push('/events')}
          />
        ) : (
          <AppButton
            theme="primary"
            title="Scan QR Code"
            icon="qr-code-outline"
            onPress={() => router.push('/scan')}
          />
        )}
        <AppButton
          title={staff ? 'View Attendance Records' : 'My Attendance History'}
          icon="time-outline"
          onPress={() => router.push('/history')}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Open Events</Text>
        <Text style={styles.sectionHint}>Pull down to refresh</Text>
      </View>

      {loaded && events.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={26} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No open events right now. Check back soon!</Text>
        </GlassCard>
      ) : (
        events.map((event) => (
          <Pressable key={event.id} onPress={() => staff && router.push('/events')}>
            <GlassCard style={styles.eventCard}>
              <View style={styles.eventRow}>
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventMeta}>
                    {event.venue ? `📍 ${event.venue}` : 'Venue TBA'}
                  </Text>
                  <Text style={styles.eventMeta}>🕒 {formatDate(event.start_time)}</Text>
                </View>
                <StatusPill
                  label={event.status}
                  tone={event.status === 'open' ? 'open' : 'closed'}
                />
              </View>
            </GlassCard>
          </Pressable>
        ))
      )}

      {!roleLoading && role === null ? (
        <Text style={styles.warning}>Your profile could not be loaded. Sign in again.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: GUTTER, paddingBottom: SPACING.xxxl },
  hero: {
    backgroundColor: 'rgba(11, 48, 152, 0.35)',
    borderColor: 'rgba(76, 121, 255, 0.45)',
    padding: SPACING.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  heroText: { flex: 1 },
  hello: { fontSize: 19, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  heroSub: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  statsRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  statTile: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  actions: { marginTop: SPACING.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  sectionHint: { fontSize: 12, color: COLORS.textMuted },
  emptyCard: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  eventCard: { marginBottom: SPACING.md },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  eventMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  warning: {
    marginTop: SPACING.lg,
    fontSize: 13,
    color: COLORS.crimsonLight,
    textAlign: 'center',
  },
});

