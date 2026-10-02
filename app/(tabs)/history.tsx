import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SHADOW } from '@/constants/theme';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

function shortId(id: string) {
  return id ? `…${id.slice(-8)}` : 'unknown';
}

function formatDate(iso: string | null) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString();
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const profile = await getProfile(user.id);
    const currentRole = profile?.role ?? 'student';
    setRole(currentRole);

    if (currentRole === 'teacher') {
      const events = await getTeacherEventAttendance(user.id);
      setTeacherEvents(events);
      setStudentRecords([]);
    } else {
      const records = await getAttendanceHistory(user.id);
      setStudentRecords(records);
      setTeacherEvents([]);
    }

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <Header title="Attendance History" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : role === 'teacher' ? (
        teacherEvents.length === 0 ? (
          <Text style={styles.subtitle}>
            No events created yet. Go to the Teacher tab to create an event.
          </Text>
        ) : (
          <FlatList
            data={teacherEvents}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {item.attendeeCount} {item.attendeeCount === 1 ? 'Attendee' : 'Attendees'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.eventMeta}>Code: {item.eventCode}</Text>
                {item.startTime ? (
                  <Text style={styles.eventMeta}>Start: {formatDate(item.startTime)}</Text>
                ) : null}

                <View style={styles.divider} />

                <Text style={styles.sectionLabel}>Students Scanned:</Text>
                {item.attendees.length === 0 ? (
                  <Text style={styles.emptyAttendeesText}>No attendance recorded yet.</Text>
                ) : (
                  item.attendees.map((attendee, index) => (
                    <View key={`${attendee.studentId}-${index}`} style={styles.attendeeRow}>
                      <Text style={styles.studentIdText}>
                        Student ID: {shortId(attendee.studentId)}
                      </Text>
                      <Text style={styles.scannedAtText}>
                        {formatDate(attendee.scannedAt)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}
          />
        )
      ) : studentRecords.length === 0 ? (
        <Text style={styles.subtitle}>
          No records yet. Scan a QR code to register your attendance.
        </Text>
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.eventTitle}>{item.eventTitle}</Text>
              <Text style={styles.eventMeta}>Event Code: {item.eventId}</Text>
              <Text style={styles.eventMeta}>Scanned: {formatDate(item.scannedAt)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 32,
    paddingHorizontal: 24,
  },
  list: {
    paddingHorizontal: GUTTER,
    paddingTop: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  badge: {
    backgroundColor: COLORS.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  emptyAttendeesText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  attendeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  studentIdText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  scannedAtText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});