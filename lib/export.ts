import { Platform, Share } from 'react-native';

import type { EventAttendance } from './attendance';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

/**
 * CSV of one event's attendance record — used by the teacher/admin
 * "Export" action on the Records tab.
 */
export function buildAttendanceCsv(record: EventAttendance): string {
  const header = [
    'Student ID',
    'Name',
    'Email',
    'Status',
    'Recorded At',
    'Event Code',
    'Event',
    'Venue',
  ];

  const rows = record.attendees.map((a) =>
    [
      a.studentNo ?? '',
      a.studentName,
      a.studentEmail,
      a.status,
      formatStamp(a.recordedAt),
      record.eventCode,
      record.title,
      record.venue ?? '',
    ]
      .map(csvEscape)
      .join(',')
  );

  return [header.join(','), ...rows].join('\n');
}

/**
 * Share/download a CSV file:
 *  • native → the OS share sheet (copy to Drive/Gmail/Messenger, save, …)
 *  • web    → direct file download
 */
export async function shareCsv(csv: string, filename: string): Promise<{ error: string | null }> {
  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { error: null };
    }

    await Share.share({ message: csv, title: filename });
    return { error: null };
  } catch (err: any) {
    if (err?.message === 'User did not share') return { error: null };
    return { error: err?.message ?? 'Could not export the attendance record.' };
  }
}
