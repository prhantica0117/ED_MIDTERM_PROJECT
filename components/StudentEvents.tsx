import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { actionLabel, formatClock, resolveScanWindows } from '@/lib/attendance';
import { EmptyState, LoadingState } from '@/components/EmptyState';
import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import StatusPill from '@/components/StatusPill';
import { COLORS } from '@/constants/colors';
import { eventMatchesProfile, targetLabel } from '@/constants/education';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { listEvents, type CloudEvent } from '@/lib/events';
import { getProfile, type Profile } from '@/lib/profiles';

type Filter = 'all' | 'scheduled';

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

/**
 * Student-facing Events tab:
 *  • All        → every event visible to this student (target-matched)
 *  • Scheduled  → events with a date/time + check-in/check-out windows so the
 *                 student knows exactly when to scan for Check In / Check Out.
 */
export default function StudentEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!user) return;
    const [p, rows] = await Promise.all([getProfile(user.id), listEvents()]);
    setEvents(rows.filter((e) => eventMatchesProfile(e.target, p)));
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const scoped = events;
    if (filter === 'all') return scoped;
    const now = Date.now();
    return scoped.filter((e) => {
      if (!e.start_time) return false;
      const end = e.end_time ? Date.parse(e.end_time) : Date.parse(e.start_time);
      return Number.isNaN(end) ? true : end >= now;
    });
  }, [events, filter]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Events" />
        <LoadingState label="Loading events…" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Events" subtitle="Scan during your check-in / check-out windows" />

      {/* Filter buttons — All (SELECT *) vs Scheduled */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Ionicons
            name="apps-outline"
            size={15}
            color={filter === 'all' ? COLORS.textPrimary : COLORS.textSecondary}
          />
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, filter === 'scheduled' && styles.filterChipActive]}
          onPress={() => setFilter('scheduled')}
        >
          <Ionicons
            name="time-outline"
            size={15}
            color={filter === 'scheduled' ? COLORS.textPrimary : COLORS.textSecondary}
          />
          <Text style={[styles.filterText, filter === 'scheduled' && styles.filterTextActive]}>
            Scheduled
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={filter === 'scheduled' ? 'No scheduled events' : 'No events yet'}
            message={
              filter === 'scheduled'
                ? 'Scheduled events show their check-in and check-out times here.'
                : 'Events targeted at your department/block will appear here.'
            }
          />
        ) : (
          filtered.map((event) => {
            const windows = resolveScanWindows(event);
            return (
              <GlassCard key={event.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{event.title}</Text>
                    <Text style={styles.code}>{event.event_code}</Text>
                  </View>
                  <StatusPill
                    label={event.status}
                    tone={event.status === 'open' ? 'open' : 'closed'}
                    small
                  />
                </View>

                <Text style={styles.meta}>📍 {event.venue || 'Venue TBA'}</Text>
                <Text style={styles.meta}>🕒 {formatDate(event.start_time)}</Text>
                <Text style={styles.meta}>👥 {targetLabel(event.target)}</Text>

                <View style={styles.divider} />

                <Text style={styles.windowsTitle}>Scanning windows</Text>
                {windows.length === 0 ? (
                  <Text style={styles.meta}>No check-in schedule published yet.</Text>
                ) : (
                  windows.map((w) => (
                    <View key={w.slot} style={styles.windowRow}>
                      <Ionicons
                        name={w.action === 'check_out' ? 'log-out-outline' : 'log-in-outline'}
                        size={14}
                        color={w.action === 'check_out' ? '#F7C46B' : '#5FE0A0'}
                      />
                      <Text style={styles.windowAction}>{actionLabel(w.action)}</Text>
                      <Text style={styles.windowTime}>
                        {formatClock(w.start)} – {formatClock(w.end)}
                      </Text>
                    </View>
                  ))
                )}

                {event.description ? (
                  <Text style={styles.desc} numberOfLines={3}>
                    {event.description}
                  </Text>
                ) : null}
              </GlassCard>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: GUTTER,
    marginBottom: SPACING.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  filterChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(76, 121, 255, 0.18)',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  filterTextActive: { color: COLORS.textPrimary },
  list: { paddingHorizontal: GUTTER, paddingBottom: SPACING.xxxl },
  card: { marginBottom: SPACING.md },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  code: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  windowsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 6,
  },
  windowAction: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    minWidth: 78,
  },
  windowTime: { fontSize: 13, color: COLORS.textSecondary },
  desc: { fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm, lineHeight: 18 },
});
