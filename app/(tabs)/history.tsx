import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import { EmptyState, LoadingState } from '@/components/EmptyState';
import StatusPill from '@/components/StatusPill';
import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import {
  correctAttendance,
  deleteAttendance,
  getAttendanceHistory,
  getEventAttendance,
  watchAttendance,
  type AttendanceStatus,
  type EventAttendance,
  type StudentAttendanceRecord,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { canViewAllAttendance, isStaff, useRole } from '@/lib/roles';

function formatDateTime(iso: string | null) {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_TONE: Record<AttendanceStatus, 'present' | 'late' | 'absent'> = {
  present: 'present',
  late: 'late',
  absent: 'absent',
};

export default function HistoryScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole(user?.id);

  const [studentRecords, setStudentRecords] = useState<StudentAttendanceRecord[]>([]);
  const [eventRecords, setEventRecords] = useState<EventAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user || !role) return;
    setLoading(true);

    if (isStaff(role)) {
      const rows = await getEventAttendance(canViewAllAttendance(role) ? null : user.id);
      setEventRecords(rows);
      setStudentRecords([]);
    } else {
      const rows = await getAttendanceHistory(user.id);
      setStudentRecords(rows);
      setEventRecords([]);
    }

    setLoading(false);
  }, [user, role]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Realtime: INSERT/UPDATE/DELETE on attendance → records refresh live
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

  // Admin: correct an attendance record's status
  const handleCorrect = async (attendanceId: string, status: AttendanceStatus) => {
    const { error } = await correctAttendance(attendanceId, status);
    if (error) Alert.alert('Update failed', error);
    else load();
  };

  // Admin: delete an incorrect record
  const handleDelete = (attendanceId: string) => {
    Alert.alert('Delete record?', 'This attendance record will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteAttendance(attendanceId);
          if (error) Alert.alert('Delete failed', error);
          else load();
        },
      },
    ]);
  };

  if (loading && !roleLoading) {
    return (
      <View style={styles.container}>
        <Header title="Attendance Records" />
        <LoadingState label="Loading records…" />
      </View>
    );
  }

  const isAdmin = role === 'admin';

  // ── STUDENT: personal attendance history ──────────────────────────────
  if (!isStaff(role)) {
    return (
      <View style={styles.container}>
        <Header title="My Attendance" subtitle="Your personal check-in history" />
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="qr-code-outline"
              title="No attendance yet"
              message="Scan an event QR code and your attendance will appear here."
            />
          }
          renderItem={({ item }) => (
            <GlassCard style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.eventTitle}>{item.eventTitle}</Text>
                <StatusPill label={item.status} tone={STATUS_TONE[item.status]} small />
              </View>
              <Text style={styles.meta}>🎫 {item.eventCode}</Text>
              {item.venue ? <Text style={styles.meta}>📍 {item.venue}</Text> : null}
              <View style={styles.divider} />
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Checked in</Text>
                <Text style={styles.timeValue}>{formatDateTime(item.recordedAt)}</Text>
              </View>
            </GlassCard>
          )}
        />
      </View>
    );
  }

  // ── TEACHER / ADMIN: per-event attendance monitor ─────────────────────
  return (
    <View style={styles.container}>
      <Header
        title={isAdmin ? 'All Attendance' : 'My Events’ Attendance'}
        subtitle={isAdmin ? 'System-wide records — correct or remove rows' : 'Live monitor'}
      />
      <FlatList
        data={eventRecords}
        keyExtractor={(item) => item.eventId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No events yet"
            message={
              isAdmin
                ? 'No events have been created in the system.'
                : 'Create an event in the Events tab to start monitoring attendance.'
            }
          />
        }
        renderItem={({ item }) => (
          <GlassCard style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <StatusPill
                label={item.attendeeCount === 1 ? '1 present' : `${item.attendeeCount} present`}
                tone="open"
                small
              />
            </View>
            <Text style={styles.meta}>🎫 {item.eventCode}</Text>
            {item.venue ? <Text style={styles.meta}>📍 {item.venue}</Text> : null}
            <Text style={styles.meta}>🕒 {formatDateTime(item.startTime)}</Text>
            <View style={styles.divider} />

            {item.attendees.length === 0 ? (
              <Text style={styles.emptyAttendees}>No check-ins recorded yet.</Text>
            ) : (
              item.attendees.map((attendee) => (
                <View key={attendee.attendanceId}>
                  <View style={styles.attendeeRow}>
                    <View style={styles.attendeeInfo}>
                      <Text style={styles.attendeeName}>{attendee.studentName}</Text>
                      <Text style={styles.attendeeTime}>{formatDateTime(attendee.recordedAt)}</Text>
                    </View>
                    <StatusPill label={attendee.status} tone={STATUS_TONE[attendee.status]} small />
                  </View>

                  {/* Admin correction controls (CRUD on attendance rows) */}
                  {isAdmin ? (
                    <View style={styles.correctionRow}>
                      {(['present', 'late', 'absent'] as AttendanceStatus[]).map((s) => (
                        <Pressable
                          key={s}
                          style={[styles.correctChip, attendee.status === s && styles.correctChipActive]}
                          onPress={() => handleCorrect(attendee.attendanceId, s)}
                        >
                          <Text
                            style={[
                              styles.correctChipText,
                              attendee.status === s && styles.correctChipTextActive,
                            ]}
                          >
                            {s}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable
                        style={styles.deleteChip}
                        onPress={() => handleDelete(attendee.attendanceId)}
                      >
                        <Ionicons name="trash-outline" size={14} color="#FF8F93" />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </GlassCard>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  list: { paddingHorizontal: GUTTER, paddingBottom: SPACING.xxxl },
  card: { marginBottom: SPACING.md },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  eventTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timeValue: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  emptyAttendees: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: 6,
  },
  attendeeInfo: { flex: 1 },
  attendeeName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  attendeeTime: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  correctionRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    marginTop: 2,
  },
  correctChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  correctChipActive: {
    backgroundColor: 'rgba(76, 121, 255, 0.22)',
    borderColor: COLORS.accent,
  },
  correctChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  correctChipTextActive: { color: COLORS.textPrimary },
  deleteChip: {
    marginLeft: 'auto',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(189, 27, 32, 0.55)',
    backgroundColor: 'rgba(189, 27, 32, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
