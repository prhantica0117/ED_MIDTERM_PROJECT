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
import CheckboxField from '@/components/CheckboxField';
import EducationFields from '@/components/EducationFields';
import FeedbackBanner from '@/components/FeedbackBanner';
import FormField from '@/components/FormField';
import { EmptyState, LoadingState } from '@/components/EmptyState';
import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import StatusPill from '@/components/StatusPill';
import StudentEvents from '@/components/StudentEvents';
import { COLORS } from '@/constants/colors';
import {
  ALL_AUDIENCE,
  AUDIENCE_OPTIONS,
  EMPTY_EDUCATION_FORM,
  audienceLabel,
  educationFormFrom,
  targetLabel,
  validateEducationForm,
  type EducationForm,
  type EventTarget,
} from '@/constants/education';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import {
  actionLabel,
  formatClock,
} from '@/lib/attendance';
import {
  createEvent,
  deleteEvent,
  generateEventCode,
  listEvents,
  setEventStatus,
  updateEvent,
  watchEvents,
  type CloudEvent,
  type EventType,
  type ScanAction,
  type ScanWindow,
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

/**
 * Local Date → ISO string for timestamptz storage.
 * Date objects already represent the true instant in time, so toISOString()
 * is exactly what check-in/out window comparisons (Date.now()) need.
 */
function toLocalISO(date: Date) {
  return date.toISOString();
}

/** Working copy of a check-in / check-out window inside the event form. */
type FormWindow = { action: ScanAction; start: Date; end: Date };

type PickerTarget =
  | { kind: 'start' }
  | { kind: 'end' }
  | { kind: 'win_start'; index: number }
  | { kind: 'win_end'; index: number };

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
  const [eventType, setEventType] = useState<EventType>('event');
  const [audiences, setAudiences] = useState<string[]>([ALL_AUDIENCE]);
  const [classForm, setClassForm] = useState<EducationForm>(EMPTY_EDUCATION_FORM);
  const [windows, setWindows] = useState<FormWindow[]>([]);
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
    setEventType('event');
    setAudiences([ALL_AUDIENCE]);
    setClassForm(EMPTY_EDUCATION_FORM);
    setWindows([]);
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

    setEventType(event.event_type ?? 'event');
    const target = event.target;
    const classEducation = target?.classTarget?.education;
    if ((event.event_type ?? 'event') === 'class' && classEducation) {
      setClassForm(educationFormFrom(target?.classTarget ?? null));
      setAudiences([classEducation]);
    } else {
      setClassForm(EMPTY_EDUCATION_FORM);
      setAudiences(target?.audiences?.length ? target.audiences : [ALL_AUDIENCE]);
    }
    setWindows(
      (event.scan_windows ?? []).map((w) => ({
        action: w.action,
        start: new Date(w.start),
        end: new Date(w.end),
      }))
    );
    setBanner(null);
  };

  // Event-target checkbox filter: "All" is exclusive, other levels accumulate
  const toggleAudience = (value: string) => {
    setAudiences((prev) => {
      if (value === ALL_AUDIENCE) return [ALL_AUDIENCE];
      const withoutAll = prev.filter((a) => a !== ALL_AUDIENCE);
      if (withoutAll.includes(value)) {
        const next = withoutAll.filter((a) => a !== value);
        return next.length === 0 ? [ALL_AUDIENCE] : next;
      }
      return [...withoutAll, value];
    });
  };

  const addWindow = (action: ScanAction) => {
    setWindows((prev) => {
      const lastEnd = prev.length > 0 ? prev[prev.length - 1].end : startDate;
      const start = new Date(Math.max(lastEnd.getTime(), startDate.getTime()));
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const index = prev.length;
      setPickerTarget({ kind: 'win_start', index });
      setPickerPart('date');
      return [...prev, { action, start, end }];
    });
  };

  const updateWindow = (index: number, patch: Partial<FormWindow>) => {
    setWindows((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  };

  const removeWindow = (index: number) => {
    setWindows((prev) => prev.filter((_, i) => i !== index));
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (!pickerTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setPickerTarget(null);
      setPickerPart('date');
      return;
    }

    const targetKind = pickerTarget.kind;
    const currentIndex =
      targetKind === 'win_start' || targetKind === 'win_end' ? pickerTarget.index : -1;

    const current =
      targetKind === 'start'
        ? startDate
        : targetKind === 'end'
          ? endDate
          : targetKind === 'win_start'
            ? windows[currentIndex]?.start ?? startDate
            : windows[currentIndex]?.end ?? endDate;

    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (targetKind === 'start') setStartDate(next);
    else if (targetKind === 'end') setEndDate(next);
    else if (targetKind === 'win_start') updateWindow(currentIndex, { start: next });
    else updateWindow(currentIndex, { end: next });

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

    // target audience validation (Event → checkboxes, Class → advisory details)
    let target: EventTarget;
    if (eventType === 'class') {
      const eduError = validateEducationForm(classForm);
      if (eduError) {
        setBanner({ tone: 'error', message: eduError });
        return;
      }
      target = {
        audiences: [classForm.education],
        classTarget: {
          education: classForm.education,
          department: classForm.department || null,
          year_level: classForm.year_level || null,
          block: classForm.block || null,
          strand: classForm.strand || null,
          grade_level: classForm.grade_level || null,
          section: classForm.section.trim() || null,
        },
      };
    } else {
      target = { audiences: audiences.length ? audiences : [ALL_AUDIENCE] };
    }

    // check-in / check-out window validation
    for (const w of windows) {
      if (
        isNaN(w.start.getTime()) ||
        isNaN(w.end.getTime()) ||
        w.end.getTime() <= w.start.getTime()
      ) {
        setBanner({
          tone: 'error',
          message: 'Every check-in/check-out window needs an end time after its start time.',
        });
        return;
      }
    }
    const scanWindows: ScanWindow[] = windows.map((w, i) => ({
      slot: i,
      action: w.action,
      start: w.start.toISOString(),
      end: w.end.toISOString(),
    }));

    const payload = {
      title,
      eventCode,
      venue,
      description,
      eventDate: toLocalDateString(startDate),
      startsAtISO: toLocalISO(startDate),
      endsAtISO: toLocalISO(endDate),
      eventType,
      target,
      scanWindows,
    };

    setSaving(true);
    setBanner(null);

    try {
      if (editingId) {
        const { error } = await updateEvent(editingId, payload);
        if (error) {
          setBanner({ tone: 'error', message: error });
          return;
        }
        setBanner({ tone: 'success', message: 'Event updated successfully.' });
      } else {
        const { event, error } = await createEvent(payload);
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

  // ── STUDENT: read-only Events tab (All / Scheduled filters) ────────────
  if (!roleLoading && role === 'student') {
    return <StudentEvents />;
  }

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
              Your profile could not be loaded, so events cannot be shown. Sign in again.
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

          <Text style={styles.label}>Attendance checking is for…</Text>
          <View style={styles.roleRow}>
            {(
              [
                { value: 'event' as EventType, label: 'Event', icon: 'people-outline' },
                { value: 'class' as EventType, label: 'Class Schedule', icon: 'school-outline' },
              ]
            ).map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.typeChip,
                  eventType === option.value && styles.typeChipActive,
                ]}
                onPress={() => setEventType(option.value)}
              >
                <Ionicons
                  name={option.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={eventType === option.value ? COLORS.accent : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.typeChipText,
                    eventType === option.value && styles.typeChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {eventType === 'event' ? (
            <View style={styles.targetBox}>
              <Text style={styles.label}>Target students</Text>
              {AUDIENCE_OPTIONS.map((option) => (
                <CheckboxField
                  key={option.value}
                  label={option.label}
                  checked={audiences.includes(option.value)}
                  onToggle={() => toggleAudience(option.value)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.targetBox}>
              <EducationFields
                title="Target class (advisory block / section)"
                form={classForm}
                onChange={(patch) => setClassForm((prev) => ({ ...prev, ...patch }))}
              />
            </View>
          )}

          <Text style={styles.label}>Starts</Text>
          <Pressable
            style={styles.pickerField}
            onPress={() => {
              setPickerTarget({ kind: 'start' });
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
              setPickerTarget({ kind: 'end' });
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

          {/* ── Check-in / Check-out windows (e.g. in 7:20–8:20, out 12:00–13:00 …) */}
          <View style={styles.targetBox}>
            <Text style={styles.label}>Check-in / Check-out windows</Text>
            <Text style={styles.windowsHint}>
              Students scan once per window (each window = one scan). Leave empty to allow
              scanning anytime between the start and end times above.
            </Text>

            {windows.map((w, index) => (
              <View key={`win-${index}`} style={styles.windowRow}>
                <Pressable
                  style={[
                    styles.windowActionChip,
                    w.action === 'check_out' && styles.windowActionChipOut,
                  ]}
                  onPress={() => updateWindow(index, { action: w.action === 'check_in' ? 'check_out' : 'check_in' })}
                >
                  <Ionicons
                    name={w.action === 'check_out' ? 'log-out-outline' : 'log-in-outline'}
                    size={14}
                    color={w.action === 'check_out' ? '#F7C46B' : '#5FE0A0'}
                  />
                  <Text
                    style={[
                      styles.windowActionText,
                      { color: w.action === 'check_out' ? '#F7C46B' : '#5FE0A0' },
                    ]}
                  >
                    {actionLabel(w.action)}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.windowTimeBtn}
                  onPress={() => {
                    setPickerTarget({ kind: 'win_start', index });
                    setPickerPart('date');
                  }}
                >
                  <Text style={styles.windowTimeLabel}>From</Text>
                  <Text style={styles.windowTimeValue}>{formatClock(w.start.toISOString())}</Text>
                </Pressable>

                <Pressable
                  style={styles.windowTimeBtn}
                  onPress={() => {
                    setPickerTarget({ kind: 'win_end', index });
                    setPickerPart('date');
                  }}
                >
                  <Text style={styles.windowTimeLabel}>Until</Text>
                  <Text style={styles.windowTimeValue}>{formatClock(w.end.toISOString())}</Text>
                </Pressable>

                <Pressable style={styles.windowRemove} onPress={() => removeWindow(index)}>
                  <Ionicons name="trash-outline" size={16} color="#FF8F93" />
                </Pressable>
              </View>
            ))}

            <View style={styles.chipRow}>
              <Pressable style={styles.chip} onPress={() => addWindow('check_in')}>
                <Ionicons name="add" size={14} color={COLORS.accent} />
                <Text style={styles.chipText}>Add Check-In</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => addWindow('check_out')}>
                <Ionicons name="add" size={14} color={COLORS.accent} />
                <Text style={styles.chipText}>Add Check-Out</Text>
              </Pressable>
            </View>
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
              value={
                pickerTarget.kind === 'start'
                  ? startDate
                  : pickerTarget.kind === 'end'
                    ? endDate
                    : pickerTarget.kind === 'win_start'
                      ? windows[pickerTarget.index]?.start ?? startDate
                      : windows[pickerTarget.index]?.end ?? endDate
              }
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

              <Text style={styles.eventMeta}>
                🎯 {event.event_type === 'class' ? 'Class Schedule' : 'Event'} ·{' '}
                {targetLabel(event.target)}
              </Text>
              <Text style={styles.eventMeta}>
                🕐{' '}
                {event.scan_windows && event.scan_windows.length > 0
                  ? `${event.scan_windows.length} scan window${
                      event.scan_windows.length === 1 ? '' : 's'
                    }: ${event.scan_windows
                      .map((w) => `${actionLabel(w.action)} ${formatClock(w.start)}`)
                      .join(' · ')}`
                  : 'Open all day (start → end)'}
              </Text>

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

            {qrEvent && qrEvent.scan_windows && qrEvent.scan_windows.length > 0 ? (
              <View style={styles.qrWindows}>
                <Text style={styles.windowsTitle}>Scan windows</Text>
                {qrEvent.scan_windows.map((w) => (
                  <View key={w.slot} style={styles.qrWindowRow}>
                    <Ionicons
                      name={w.action === 'check_out' ? 'log-out-outline' : 'log-in-outline'}
                      size={14}
                      color={w.action === 'check_out' ? '#F7C46B' : '#5FE0A0'}
                    />
                    <Text style={styles.qrWindowText}>
                      {actionLabel(w.action)} · {formatClock(w.start)} – {formatClock(w.end)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

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
  roleRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
    flexWrap: 'wrap',
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  typeChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(76, 121, 255, 0.14)',
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  typeChipTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  targetBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  windowsHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
    flexWrap: 'wrap',
  },
  windowActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(47, 191, 113, 0.45)',
    backgroundColor: 'rgba(47, 191, 113, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  windowActionChipOut: {
    borderColor: 'rgba(245, 165, 36, 0.45)',
    backgroundColor: 'rgba(245, 165, 36, 0.12)',
  },
  windowActionText: { fontSize: 11, fontWeight: '800' },
  windowTimeBtn: {
    flex: 1,
    minWidth: 90,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  windowTimeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  windowTimeValue: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  windowRemove: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(189, 27, 32, 0.55)',
    backgroundColor: 'rgba(189, 27, 32, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  windowsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    alignSelf: 'flex-start',
  },
  qrWindows: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  qrWindowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  qrWindowText: { fontSize: 13, color: COLORS.textSecondary },
});


