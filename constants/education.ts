/**
 * Education catalog shared by registration, profile, event targeting and
 * user management — every dropdown/option list in the app lives here so the
 * options stay identical everywhere.
 */

export type EducationLevel =
  | 'college'
  | 'senior_high'
  | 'junior_high'
  | 'elementary'
  | 'kindergarten';

export type SelectOption = { label: string; value: string };

export const EDUCATION_LEVELS: SelectOption[] = [
  { label: 'College', value: 'college' },
  { label: 'Senior High School', value: 'senior_high' },
  { label: 'Junior High School', value: 'junior_high' },
  { label: 'Elementary', value: 'elementary' },
  { label: 'Kindergarten', value: 'kindergarten' },
];

export const DEPARTMENTS: SelectOption[] = [
  { label: 'BS Information Technology', value: 'BS Information Technology' },
  { label: 'BS Hospitality Management', value: 'BS Hospitality Management' },
  { label: 'BS Elementary Education', value: 'BS Elementary Education' },
  { label: 'BS Secondary Education', value: 'BS Secondary Education' },
  { label: 'B Physical Education', value: 'B Physical Education' },
  { label: 'BS Entrepreneurship', value: 'BS Entrepreneurship' },
];

export const STRANDS: SelectOption[] = [
  { label: 'STEM', value: 'STEM' },
  { label: 'ABM', value: 'ABM' },
  { label: 'TVL', value: 'TVL' },
];

function ordinalSuffix(value: string): string {
  const n = Number(value);
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

export const COLLEGE_YEAR_LEVELS: SelectOption[] = ['1', '2', '3', '4'].map((y) => ({
  label: `${y}${ordinalSuffix(y)} Year`,
  value: y,
}));

export const BLOCKS: SelectOption[] = ['A', 'B', 'C', 'D'].map((b) => ({
  label: `Block ${b}`,
  value: b,
}));

export const SHS_GRADES: SelectOption[] = ['11', '12'].map((g) => ({
  label: `Grade ${g}`,
  value: g,
}));

export const JHS_GRADES: SelectOption[] = ['7', '8', '9', '10'].map((g) => ({
  label: `Grade ${g}`,
  value: g,
}));

export const ELEMENTARY_GRADES: SelectOption[] = ['1', '2', '3', '4', '5', '6'].map((g) => ({
  label: `Grade ${g}`,
  value: g,
}));

export const EDUCATION_LABEL: Record<EducationLevel, string> = {
  college: 'College',
  senior_high: 'Senior High School',
  junior_high: 'Junior High School',
  elementary: 'Elementary',
  kindergarten: 'Kindergarten',
};

export function educationLabel(value?: string | null): string | null {
  if (!value) return null;
  return EDUCATION_LABEL[value as EducationLevel] ?? null;
}

/** Education data captured at registration (profile columns). */
export type EducationInfo = {
  education?: string | null;
  department?: string | null;
  year_level?: string | null;
  block?: string | null;
  strand?: string | null;
  grade_level?: string | null;
  section?: string | null;
};

/** Working state used by the cascading education form. */
export type EducationForm = {
  education: string;
  department: string;
  year_level: string;
  block: string;
  strand: string;
  grade_level: string;
  section: string;
};

export const EMPTY_EDUCATION_FORM: EducationForm = {
  education: '',
  department: '',
  year_level: '',
  block: '',
  strand: '',
  grade_level: '',
  section: '',
};

export function educationFormFrom(info: EducationInfo | null | undefined): EducationForm {
  return {
    education: info?.education ?? '',
    department: info?.department ?? '',
    year_level: info?.year_level ?? '',
    block: info?.block ?? '',
    strand: info?.strand ?? '',
    grade_level: info?.grade_level ?? '',
    section: info?.section ?? '',
  };
}


/**
 * The single-line education summary shown on the Profile screen:
 *  College      → "BS Information Technology l 3rd Year l Block D"
 *  Senior High  → "STEM l Grade 11 l Section STEM1"
 *  Junior High  → "Grade 7 l Section A"
 *  Elementary   → "Grade 1 l Section A"
 *  Kindergarten → "Section A"
 */
export function educationLine(info: EducationInfo | null | undefined): string | null {
  const level = info?.education as EducationLevel | '' | null | undefined;
  if (!level || !(level in EDUCATION_LABEL)) return null;

  const sep = ' l ';
  const section = info?.section?.trim();

  switch (level) {
    case 'college': {
      const parts: string[] = [];
      if (info?.department) parts.push(info.department);
      if (info?.year_level) parts.push(`${info.year_level}${ordinalSuffix(info.year_level)} Year`);
      if (info?.block) parts.push(`Block ${info.block}`);
      return parts.length ? parts.join(sep) : null;
    }
    case 'senior_high': {
      const parts: string[] = [];
      if (info?.strand) parts.push(info.strand);
      if (info?.grade_level) parts.push(`Grade ${info.grade_level}`);
      if (section) parts.push(`Section ${section}`);
      return parts.length ? parts.join(sep) : null;
    }
    case 'junior_high':
    case 'elementary': {
      const parts: string[] = [];
      if (info?.grade_level) parts.push(`Grade ${info.grade_level}`);
      if (section) parts.push(`Section ${section}`);
      return parts.length ? parts.join(sep) : null;
    }
    case 'kindergarten':
      return section ? `Section ${section}` : null;
    default:
      return null;
  }
}

/** Validate the cascading education form (used by register + admin create). */
export function validateEducationForm(form: EducationForm): string | null {
  if (!form.education) return 'Select your Education level.';

  switch (form.education as EducationLevel) {
    case 'college':
      if (!form.department) return 'Select your Department.';
      if (!form.year_level) return 'Select your Year Level.';
      if (!form.block) return 'Select your Block.';
      return null;
    case 'senior_high':
      if (!form.strand) return 'Select your Strand.';
      if (!form.grade_level) return 'Select your Grade.';
      if (!form.section.trim()) return 'Section is required.';
      return null;
    case 'junior_high':
    case 'elementary':
      if (!form.grade_level) return 'Select your Grade Level.';
      if (!form.section.trim()) return 'Section is required.';
      return null;
    case 'kindergarten':
      if (!form.section.trim()) return 'Section is required.';
      return null;
    default:
      return 'Select your Education level.';
  }
}

/** Event target audience: "all" or a set of education levels (+ class filters). */
export type EventTarget = {
  audiences: string[];
  classTarget?: EducationInfo | null;
};

export const ALL_AUDIENCE = 'all';

export const AUDIENCE_OPTIONS: SelectOption[] = [
  { label: 'All Students', value: ALL_AUDIENCE },
  ...EDUCATION_LEVELS,
];

export function audienceLabel(value: string): string {
  if (value === ALL_AUDIENCE) return 'All Students';
  return EDUCATION_LABEL[value as EducationLevel] ?? value;
}

/**
 * Target matching — decides whether an event belongs to a student.
 * "all" matches everyone; otherwise the student's education level must be in
 * the audience list, and a class target must match department/year/block/
 * strand/grade/section whenever those filters are set.
 */
export function eventMatchesProfile(
  target: EventTarget | null | undefined,
  profile: (EducationInfo & { role?: string | null }) | null | undefined
): boolean {
  const audiences = target?.audiences ?? [ALL_AUDIENCE];
  if (audiences.includes(ALL_AUDIENCE)) return true;
  if (profile?.role === 'teacher' || profile?.role === 'admin') return true;

  const level = profile?.education ?? '';
  if (!level || !audiences.includes(level)) return false;

  const cls = target?.classTarget;
  if (!cls) return true;
  if (cls.education && cls.education !== level) return false;
  if (cls.department && cls.department !== profile?.department) return false;
  if (cls.year_level && cls.year_level !== profile?.year_level) return false;
  if (cls.block && cls.block !== profile?.block) return false;
  if (cls.strand && cls.strand !== profile?.strand) return false;
  if (cls.grade_level && cls.grade_level !== profile?.grade_level) return false;
  if (cls.section && cls.section.toLowerCase() !== (profile?.section ?? '').toLowerCase()) {
    return false;
  }
  return true;
}

/** Short human label for an event's target ("All Students" / "College · Block D"). */
export function targetLabel(target: EventTarget | null | undefined): string {
  const audiences = target?.audiences ?? [ALL_AUDIENCE];
  const base = audiences.includes(ALL_AUDIENCE)
    ? 'All Students'
    : audiences.map(audienceLabel).join(', ');

  const cls = target?.classTarget;
  if (!cls) return base;

  const details = educationLine(cls);
  return details ? `${base} · ${details}` : base;
}
