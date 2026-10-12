import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import FeedbackBanner from '@/components/FeedbackBanner';
import FormField from '@/components/FormField';
import { EmptyState, LoadingState } from '@/components/EmptyState';
import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import StatusPill from '@/components/StatusPill';
import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import {
  createEvent,
  deleteEvent,
  generateEventCode,
  listEvents,
  setEventStatus,
  updateEvent,
  watchEvents,
  type CloudEvent,
} from '@/lib/events';
import { buildQRPayload } from '@/lib/qr';
import { useAuth } from '@/lib/auth';
import { canManageEvents, useRole } from '@/lib/roles';
import { toLocalDateString, validateEventForm } from '@/lib/validation';

const QUICK_ENDS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

type PickerTarget = 'start' | 'end';

export default function EventsScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole(user?.id);

  // form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [pickerPart, setPickerPart] = useState<'date' | 'time'>('date');
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // list state
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // QR modal state
  const [qrEvent, setQrEvent] = useState<CloudEvent | null>(null);

  const isAndroid = Platform.OS === 'android';
  const isAdmin = role === 'admin';

  const load = useCallback(async () => {
    if (!user || !role) return;
    const rows = await listEvents(
      role === 'admin' ? { status: null } : { createdBy: user.id }
    );
    setEvents(rows);
    setLoading(false);
  }, [user, role]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Realtime: event status changes / new events → list refreshes live
  useFocusEffect(
    useCallback(() => {
      if (!role || !canManageEvents(role)) return;
      const unsubscribe = watchEvents(() => load());
      return unsubscribe;
    }, [role, load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setEventCode('');
    setVenue('');
    setDescription('');
    setStartDate(new Date());
    setEndDate(new Date(Date.now() + 60 * 60 * 1000));
    setBanner(null);
  };

  const startEdit = (event: CloudEvent) => {
    setEditingId(event.id);
    setTitle(event.title);
    setEventCode(event.event_code);
    setVenue(event.venue ?? '');
    setDescription(event.description ?? '');
    if (event.start_time) setStartDate(new Date(event.start_time));
    if (event.end_time) setEndDate(new Date(event.end_time));
    setBanner(null);
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (!pickerTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setPickerTarget(null);
      setPickerPart('date');
      return;
    }

    const current = pickerTarget === 'start' ? startDate : endDate;
    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (pickerTarget === 'start') setStartDate(next);
    else setEndDate(next);

    if (isAndroid && pickerPart === 'date') {
      setPickerPart('time');
    } else {
      setPickerTarget(null);
      setPickerPart('date');
    }
  };

  // Event: "Create Event" / "Save Changes" pressed → validate → insert/update
  const handleSave = async () => {
    const formError = validateEventForm({
      title,
      eventCode,
      venue,
      description,
      startsAt: startDate,
      endsAt: endDate,
    });
    if (formError) {
      setBanner({ tone: 'error', message: formError });
      return;
    }

    setSaving(true);
    setBanner(null);

    try {
      if (editingId) {
        const { error } = await updateEvent(editingId, {
          title,
          eventCode,
          venue,
          description,
          eventDate: toLocalDateString(startDate),
          startsAtISO: toLocalISO(startDate),
          endsAtISO: toLocalISO(endDate),
        });
        if (error) {
          setBanner({ tone: 'error', message: error });
          return;
        }
        setBanner({ tone: 'success', message: 'Event updated successfully.' });
      } else {
        const { event, error } = await createEvent({
          title,
          eventCode,
          venue,
          description,
          eventDate: toLocalDateString(startDate),
          startsAtISO: toLocalISO(startDate),
          endsAtISO: toLocalISO(endDate),
        });
        if (error || !event) {
          setBanner({ tone: 'error', message: error ?? 'Could not create the event.' });
          return;
        }
        setBanner({ tone: 'success', message: 'Event created! Showing its QR code.' });
        setQrEvent(event);
      }
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  };

  // Event: "Close" / "Reopen" pressed → status changes → attendance blocked/allowed
  const handleToggleStatus = async (event: CloudEvent) => {
    const next = event.status === 'open' ? 'closed' : 'open';
    const { error } = await setEventStatus(event.id, next);
    if (error) {
      Alert.alert('Update failed', error);
      return;
    }
    setBanner({
      tone: 'success',
      message:
        next === 'closed'
          ? `“${event.title}” is now closed — no more attendance.`
          : `“${event.title}” is open again.`,
    });
    load();
  };

  const handleDelete = (event: CloudEvent) => {
    Alert.alert('Delete event?', `“${event.title}” and its attendance records will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteEvent(event.id);
          if (error) Alert.alert('Delete failed', error);
          else load();
        },
      },
    ]);
  };

  // ── Authorization guard ───────────────────────────────────────────────
  if (!roleLoading && !canManageEvents(role)) {
    return (
      <View style={styles.container}>
        <Header title="Events" />
        <View style={styles.centered}>
          <GlassCard style={styles.lockCard}>
            <Ionicons name="lock-closed-outline" size={48} color={COLORS.crimsonLight} />
            <Text style={styles.lockTitle}>Unauthorized</Text>
            <Text style={styles.lockText}>
              Only teachers and administrators can create and manage events.
            </Text>
          </GlassCard>
        </View>
      </View>
    );
  }

  if (loading && !roleLoading) {
    return (
      <View style={styles.container}>
        <Header title="Events" />
        <LoadingState label="Loading events…" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={editingId ? 'Edit Event' : 'Manage Events'}
        subtitle={isAdmin ? 'All system events' : 'Create events and share their QR codes'}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
      >
        {/* ── Create / Edit form ─────────────────────────────────────── */}
        <GlassCard style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingId ? 'Edit event details' : 'New event'}
            </Text>
            <Pressable
              onPress={editingId ? resetForm : () => setEventCode(generateEventCode())}
              hitSlop={8}
            >
              <Text style={styles.cancelLink}>
                {editingId ? 'Cancel edit' : 'Generate code'}
              </Text>
            </Pressable>
          </View>

          <FormField
            label="Event Name"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Founders Day Assembly"
            icon="sparkles-outline"
          />
          <FormField
            label="Event Code"
            value={eventCode}
            onChangeText={setEventCode}
            placeholder="EVT-2026-4F2K"
            autoCapitalize="characters"
            icon="qr-code-outline"
          />
          <FormField
            label="Venue"
            value={venue}
            onChangeText={setVenue}
            placeholder="e.g. School Gymnasium"
            icon="location-outline"
          />
          <FormField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What is this event about? (optional)"
            multiline
          />

          <Text style={styles.label}>Starts</Text>
          <Pressable
            style={styles.pickerField}
            onPress={() => {
              setPickerTarget('start');
              setPickerPart('date');
            }}
          >
            <Ionicons name="sunny-outline" size={18} color={COLORS.accent} />
            <Text style={styles.pickerValue}>{formatDateTime(startDate)}</Text>
            <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted} />
          </Pressable>

          <Text style={styles.label}>Ends</Text>
          <Pressable
            style={styles.pickerField}
            onPress={() => {
              setPickerTarget('end');
              setPickerPart('date');
            }}
          >
            <Ionicons name="moon-outline" size={18} color={COLORS.accent} />
            <Text style={styles.pickerValue}>{formatDateTime(endDate)}</Text>
            <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted} />
          </Pressable>
          <View style={styles.chipRow}>
            {QUICK_ENDS.map((option) => (
              <Pressable
                key={option.label}
                style={styles.chip}
                onPress={() => setEndDate(new Date(startDate.getTime() + option.ms))}
              >
                <Text style={styles.chipText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>

          {banner ? <FeedbackBanner tone={banner.tone} message={banner.message} /> : null}

          <AppButton
            theme="primary"
            title={editingId ? 'Save Changes' : 'Create Event'}
            icon={editingId ? 'save-outline' : 'add-circle-outline'}
            onPress={handleSave}
            loading={saving}
          />
        </GlassCard>

        {pickerTarget && (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={pickerTarget === 'start' ? startDate : endDate}
              mode={isAndroid ? pickerPart : 'datetime'}
              display={isAndroid ? 'default' : 'spinner'}
              themeVariant="dark"
              accentColor={COLORS.accent}
              onChange={onPickerChange}
            />
          </View>
        )}

        {/* ── Event list ─────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>
          {isAdmin ? 'All events' : 'Your events'} ({events.length})
        </Text>

        {events.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No events yet"
            message="Fill in the form above to create your first event."
          />
        ) : (
          events.map((event) => (
            <GlassCard key={event.id} style={styles.eventCard}>
              <View style={styles.eventTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventCode}>{event.event_code}</Text>
                </View>
                <StatusPill
                  label={event.status}
                  tone={event.status === 'open' ? 'open' : 'closed'}
                />
              </View>

              <Text style={styles.eventMeta}>📍 {event.venue || 'TBA'}</Text>
              <Text style={styles.eventMeta}>
                🕒 {event.start_time ? formatDateTime(new Date(event.start_time)) : 'TBA'}
              </Text>
              {event.description ? (
                <Text style={styles.eventDesc} numberOfLines={2}>
                  {event.description}
                </Text>
              ) : null}

              <View style={styles.eventActions}>
                <Pressable style={styles.actionChip} onPress={() => setQrEvent(event)}>
                  <Ionicons name="qr-code-outline" size={14} color={COLORS.accent} />
                  <Text style={styles.actionText}>QR</Text>
                </Pressable>
                <Pressable style={styles.actionChip} onPress={() => startEdit(event)}>
                  <Ionicons name="create-outline" size={14} color={COLORS.accent} />
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionChip, event.status === 'open' && styles.actionChipDanger]}
                  onPress={() => handleToggleStatus(event)}
                >
                  <Ionicons
                    name={event.status === 'open' ? 'lock-closed-outline' : 'lock-open-outline'}
                    size={14}
                    color={event.status === 'open' ? '#FF8F93' : '#5FE0A0'}
                  />
                  <Text
                    style={[
                      styles.actionText,
                      { color: event.status === 'open' ? '#FF8F93' : '#5FE0A0' },
                    ]}
                  >
                    {event.status === 'open' ? 'Close' : 'Reopen'}
                  </Text>
                </Pressable>
                {isAdmin ? (
                  <Pressable
                    style={[styles.actionChip, styles.actionChipDanger]}
                    onPress={() => handleDelete(event)}
                  >
                    <Ionicons name="trash-outline" size={14} color="#FF8F93" />
                  </Pressable>
                ) : null}
              </View>
            </GlassCard>
          ))
        )}
      </ScrollView>

      {/* ── QR code modal ───────────────────────────────────────────── */}
      <Modal
        visible={!!qrEvent}
        transparent
        animationType="fade"
        onRequestClose={() => setQrEvent(null)}
      >
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            <Text style={styles.modalTitle}>{qrEvent?.title}</Text>
            <Text style={styles.modalCode}>{qrEvent?.event_code}</Text>
            {/* Navy frame around the QR tile — the inner white tile stays
                small on purpose: scanners need black-on-white contrast,
                everything around it stays deep navy like login. */}
            <View style={styles.qrFrame}>
              <View style={styles.qrBox}>
              {qrEvent ? (
                <QRCode
                  value={buildQRPayload({
                    eventId: qrEvent.event_code,
                    title: qrEvent.title,
                    start: qrEvent.start_time ?? undefined,
                    end: qrEvent.end_time ?? undefined,
                  })}
                  size={220}
                />
              ) : null}
              </View>
            </View>
            <Text style={styles.modalHint}>
              Students scan this code with the Scan tab to record attendance.
            </Text>
            {qrEvent?.status === 'closed' ? (
              <FeedbackBanner
                tone="warning"
                message="This event is closed — scans will be rejected."
              />
            ) : null}
            <AppButton
              theme="primary"
              title="Close"
              icon="close-outline"
              onPress={() => setQrEvent(null)}
            />
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, justifyContent: 'center', paddingHorizontal: GUTTER },
  lockCard: { alignItems: 'center', padding: SPACING.xxl, gap: SPACING.sm },
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
  },
  scroll: {
    paddingHorizontal: GUTTER,
    paddingBottom: SPACING.xxxl,
  },
  formCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  formTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  cancelLink: { fontSize: 13, fontWeight: '700', color: COLORS.accent },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  pickerValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm },
  chip: {
    backgroundColor: 'rgba(76, 121, 255, 0.14)',
    borderColor: 'rgba(76, 121, 255, 0.40)',
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.accent },
  pickerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
    backgroundColor: COLORS.backgroundDeep,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  eventCard: { marginBottom: SPACING.md },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  eventTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  eventCode: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  eventMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  eventDesc: { fontSize: 13, color: COLORS.textMuted, marginTop: 6, lineHeight: 18 },
  eventActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.md,
    flexWrap: 'wrap',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionChipDanger: {
    borderColor: 'rgba(189, 27, 32, 0.55)',
    backgroundColor: 'rgba(189, 27, 32, 0.14)',
  },
  actionText: { fontSize: 12, fontWeight: '700', color: COLORS.accent },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 26, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: GUTTER,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  modalCode: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  qrFrame: {
    backgroundColor: COLORS.backgroundDeep,
    borderColor: 'rgba(76, 121, 255, 0.45)',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  qrBox: {
    backgroundColor: COLORS.white,
    padding: 10,
    borderRadius: RADIUS.md,
  },
  modalHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
});


