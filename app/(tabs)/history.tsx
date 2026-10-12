import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
  actionLabel,
  correctAttendance,
  deleteAttendance,
  formatClock,
  getAttendanceHistory,
  getDepartmentRates,
  getEventAttendance,
  getOverallReport,
  getStudentScans,
  getStudentStats,
  summarizeEvent,
  watchAttendance,
  type AttendanceStatus,
  type EventAttendance,
  type GroupRate,
  type OverallReport,
  type StudentAttendanceRecord,
  type StudentScan,
  type StudentStats,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { buildAttendanceCsv, shareCsv } from '@/lib/export';
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

type StudentFilter = 'all' | 'present' | 'late' | 'absent';

/** Small stat tile used for the summary cards. */
function StatTile({
  icon,
  value,
  label,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
  tint: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={16} color={COLORS.textPrimary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole(user?.id);

  // student state
  const [studentRecords, setStudentRecords] = useState<StudentAttendanceRecord[]>([]);
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null);
  const [scans, setScans] = useState<Record<string, StudentScan[]>>({});
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');

  // staff state
  const [eventRecords, setEventRecords] = useState<EventAttendance[]>([]);
  const [overall, setOverall] = useState<OverallReport | null>(null);
  const [departments, setDepartments] = useState<GroupRate[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user || !role) return;
    setLoading(true);

    if (isStaff(role)) {
      const rows = await getEventAttendance(canViewAllAttendance(role) ? null : user.id);
      setEventRecords(rows);
      setStudentRecords([]);

      if (role === 'admin') {
        const [report, rates] = await Promise.all([getOverallReport(), getDepartmentRates()]);
        setOverall(report);
        setDepartments(rates);
      } else {
        setOverall(null);
        setDepartments([]);
      }
    } else {
      const [rows, stats, scanMap] = await Promise.all([
        getAttendanceHistory(user.id),
        getStudentStats(user.id),
        getStudentScans(user.id),
      ]);
      setStudentRecords(rows);
      setStudentStats(stats);
      setScans(scanMap);
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

  // Teacher/Admin: export one event's attendance record as CSV
  const handleExport = async (record: EventAttendance) => {
    if (record.attendees.length === 0) {
      Alert.alert('Nothing to export', 'This event has no attendance records yet.');
      return;
    }
    const csv = buildAttendanceCsv(record);
    const { error } = await shareCsv(csv, `${record.eventCode}-attendance.csv`);
    if (error) Alert.alert('Export failed', error);
  };

  const filteredStudentRecords = useMemo(() => {
    if (studentFilter === 'all') return studentRecords;
    return studentRecords.filter((r) => r.status === studentFilter);
  }, [studentRecords, studentFilter]);

  if (loading && !roleLoading) {
    return (
      <View style={styles.container}>
        <Header title="Attendance Records" />
        <LoadingState label="Loading records…" />
      </View>
    );
  }

  const isAdmin = role === 'admin';

  // ── STUDENT: personal attendance history + rate + filters ────────────
  if (!isStaff(role)) {
    const stats = studentStats;

    return (
      <View style={styles.container}>
        <Header title="My Attendance" subtitle="Rate, presents, lates and absences" />

        <FlatList
          data={filteredStudentRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
            />
          }
          ListHeaderComponent={
            <View>
              {/* ── Rate + counts ─────────────────────────────────── */}
              <GlassCard style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Attendance Rate</Text>
                <View style={styles.rateRow}>
                  <Text style={styles.rateValue}>{stats?.rate ?? 0}%</Text>
                  <Text style={styles.rateHint}>
                    {stats?.attended ?? 0} of {stats?.scheduled ?? 0} scheduled events attended
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <StatTile
                    icon="checkmark-circle-outline"
                    value={stats?.present ?? 0}
                    label="Presents"
                    tint="rgba(47, 191, 113, 0.16)"
                  />
                  <StatTile
                    icon="time-outline"
                    value={stats?.late ?? 0}
                    label="Lates"
                    tint="rgba(245, 165, 36, 0.16)"
                  />
                  <StatTile
                    icon="close-circle-outline"
                    value={stats?.absent ?? 0}
                    label="Absences"
                    tint="rgba(189, 27, 32, 0.24)"
                  />
                </View>
              </GlassCard>

              {/* ── History filter ────────────────────────────────── */}
              <View style={styles.filterRow}>
                {(
                  [
                    { value: 'all' as StudentFilter, label: 'All' },
                    { value: 'present' as StudentFilter, label: 'Present' },
                    { value: 'late' as StudentFilter, label: 'Late' },
                    { value: 'absent' as StudentFilter, label: 'Absent' },
                  ]
                ).map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.filterChip,
                      studentFilter === option.value && styles.filterChipActive,
                    ]}
                    onPress={() => setStudentFilter(option.value)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        studentFilter === option.value && styles.filterTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="qr-code-outline"
              title={studentFilter === 'all' ? 'No attendance yet' : `No ${studentFilter} records`}
              message={
                studentFilter === 'all'
                  ? 'Scan an event QR code and your attendance will appear here.'
                  : 'Try a different filter to see more of your history.'
              }
            />
          }
          renderItem={({ item }) => {
            const itemScans = scans[item.id] ?? [];
            return (
              <GlassCard style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.eventTitle}>{item.eventTitle}</Text>
                  <StatusPill label={item.status} tone={STATUS_TONE[item.status]} small />
                </View>
                <Text style={styles.meta}>🎫 {item.eventCode}</Text>
                {item.venue ? <Text style={styles.meta}>📍 {item.venue}</Text> : null}
                <View style={styles.divider} />
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>First check-in</Text>
                  <Text style={styles.timeValue}>{formatDateTime(item.recordedAt)}</Text>
                </View>

                {itemScans.length > 0 ? (
                  <View style={styles.scanList}>
                    {itemScans.map((s, index) => (
                      <View key={`${s.slot}-${index}`} style={styles.scanRow}>
                        <Ionicons
                          name={s.action === 'check_out' ? 'log-out-outline' : 'log-in-outline'}
                          size={13}
                          color={s.action === 'check_out' ? '#F7C46B' : '#5FE0A0'}
                        />
                        <Text style={styles.scanAction}>{actionLabel(s.action)}</Text>
                        <Text style={styles.scanTime}>{formatDateTime(s.scannedAt)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </GlassCard>
            );
          }}
        />
      </View>
    );
  }

  // ── TEACHER / ADMIN: per-event monitor + summaries + export ──────────
  return (
    <View style={styles.container}>
      <Header
        title={isAdmin ? 'All Attendance' : 'My Events’ Attendance'}
        subtitle={isAdmin ? 'Overall rates, reports and corrections' : 'Live monitor & summaries'}
      />
      <FlatList
        data={eventRecords}
        keyExtractor={(item) => item.eventId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
        ListHeaderComponent={
          <View>
            {/* ── Admin: overall system rates ─────────────────────── */}
            {isAdmin && overall ? (
              <GlassCard style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Overall Attendance</Text>
                <View style={styles.rateRow}>
                  <Text style={styles.rateValue}>{overall.rate}%</Text>
                  <Text style={styles.rateHint}>
                    {overall.attended} of {overall.students} students attended
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <StatTile
                    icon="checkmark-circle-outline"
                    value={overall.attended}
                    label="Present"
                    tint="rgba(47, 191, 113, 0.16)"
                  />
                  <StatTile
                    icon="time-outline"
                    value={overall.late}
                    label="Late"
                    tint="rgba(245, 165, 36, 0.16)"
                  />
                  <StatTile
                    icon="close-circle-outline"
                    value={overall.absent}
                    label="Absent"
                    tint="rgba(189, 27, 32, 0.24)"
                  />
                </View>
                <Text style={styles.rowHint}>
                  Record rows — Present {overall.presentRows} · Late {overall.lateRows} · Absent{' '}
                  {overall.absentRows} · Total {overall.totalRows}
                </Text>
              </GlassCard>
            ) : null}

            {/* ── Admin: per-department present vs absent % ───────── */}
            {isAdmin && departments.length > 0 ? (
              <GlassCard style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>By Department / Level</Text>
                <View style={styles.deptHeaderRow}>
                  <Text style={[styles.deptCell, styles.deptGroup]}>Group</Text>
                  <Text style={styles.deptCell}>Present</Text>
                  <Text style={styles.deptCell}>Absent</Text>
                  <Text style={styles.deptCell}>Rate</Text>
                </View>
                {departments.map((g) => (
                  <View key={g.group} style={styles.deptRow}>
                    <Text style={[styles.deptCell, styles.deptGroup]} numberOfLines={1}>
                      {g.group}
                    </Text>
                    <Text style={styles.deptCell}>
                      {g.present}/{g.total}
                    </Text>
                    <Text style={styles.deptCell}>{g.absent}</Text>
                    <Text style={[styles.deptCell, styles.deptRate]}>{g.rate}%</Text>
                  </View>
                ))}
                <Text style={styles.rowHint}>
                  Rate = present over total students in the group (late included).
                </Text>
              </GlassCard>
            ) : null}
          </View>
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
        renderItem={({ item }) => {
          const summary = summarizeEvent(item.attendees, item.expected);
          return (
            <GlassCard style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <StatusPill label={`${summary.rate}% present`} tone="open" small />
              </View>
              <Text style={styles.meta}>🎫 {item.eventCode}</Text>
              {item.venue ? <Text style={styles.meta}>📍 {item.venue}</Text> : null}
              <Text style={styles.meta}>🕒 {formatDateTime(item.startTime)}</Text>

              {/* Present / late / absent summary with % */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryPill, styles.pillPresent]}>
                  <Text style={styles.pillText}>{summary.present} Present</Text>
                </View>
                <View style={[styles.summaryPill, styles.pillLate]}>
                  <Text style={styles.pillText}>{summary.late} Late</Text>
                </View>
                <View style={[styles.summaryPill, styles.pillAbsent]}>
                  <Text style={styles.pillText}>{summary.absent} Absent</Text>
                </View>
              </View>
              <Text style={styles.rowHint}>
                {summary.recorded}/{summary.expected} expected students attended · rate{' '}
                {summary.rate}%
              </Text>

              <Pressable style={styles.exportChip} onPress={() => handleExport(item)}>
                <Ionicons name="download-outline" size={14} color={COLORS.accent} />
                <Text style={styles.exportText}>Export CSV</Text>
              </Pressable>

              <View style={styles.divider} />

              {item.attendees.length === 0 ? (
                <Text style={styles.emptyAttendees}>No check-ins recorded yet.</Text>
              ) : (
                item.attendees.map((attendee) => (
                  <View key={attendee.attendanceId}>
                    <View style={styles.attendeeRow}>
                      <View style={styles.attendeeInfo}>
                        <Text style={styles.attendeeName}>{attendee.studentName}</Text>
                        <Text style={styles.attendeeTime}>
                          {attendee.studentNo ? `${attendee.studentNo} · ` : ''}
                          {formatDateTime(attendee.recordedAt)}
                        </Text>
                      </View>
                      <StatusPill
                        label={attendee.status}
                        tone={STATUS_TONE[attendee.status]}
                        small
                      />
                    </View>

                    {/* Admin correction controls (CRUD on attendance rows) */}
                    {isAdmin ? (
                      <View style={styles.correctionRow}>
                        {(['present', 'late', 'absent'] as AttendanceStatus[]).map((s) => (
                          <Pressable
                            key={s}
                            style={[
                              styles.correctChip,
                              attendee.status === s && styles.correctChipActive,
                            ]}
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
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  list: { paddingHorizontal: GUTTER, paddingBottom: SPACING.xxxl },
  summaryCard: { padding: SPACING.lg, marginBottom: SPACING.md },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
  },
  rateValue: { fontSize: 34, fontWeight: '900', color: COLORS.accent },
  rateHint: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  statRow: { flexDirection: 'row', gap: SPACING.sm },
  statTile: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  rowHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    lineHeight: 17,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  filterChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(76, 121, 255, 0.18)',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  filterTextActive: { color: COLORS.textPrimary },
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
  scanList: {
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 3,
  },
  scanAction: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
    minWidth: 74,
    textTransform: 'uppercase',
  },
  scanTime: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  summaryPill: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
  pillPresent: {
    backgroundColor: 'rgba(47, 191, 113, 0.14)',
    borderColor: 'rgba(47, 191, 113, 0.45)',
  },
  pillLate: {
    backgroundColor: 'rgba(245, 165, 36, 0.14)',
    borderColor: 'rgba(245, 165, 36, 0.45)',
  },
  pillAbsent: {
    backgroundColor: 'rgba(189, 27, 32, 0.20)',
    borderColor: 'rgba(189, 27, 32, 0.55)',
  },
  pillText: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },
  exportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(76, 121, 255, 0.45)',
    backgroundColor: 'rgba(76, 121, 255, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: SPACING.sm,
  },
  exportText: { fontSize: 12, fontWeight: '700', color: COLORS.accent },
  deptHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
    marginBottom: 4,
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  deptCell: { flex: 1, fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  deptGroup: { flex: 2, textAlign: 'left', color: COLORS.textPrimary, fontWeight: '700' },
  deptRate: { color: '#5FE0A0', fontWeight: '800' },
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

