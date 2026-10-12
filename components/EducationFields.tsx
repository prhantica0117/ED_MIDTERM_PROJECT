import { StyleSheet, Text, View } from 'react-native';

import FormField from '@/components/FormField';
import SelectField from '@/components/SelectField';
import { COLORS } from '@/constants/colors';
import {
  BLOCKS,
  COLLEGE_YEAR_LEVELS,
  DEPARTMENTS,
  EDUCATION_LEVELS,
  ELEMENTARY_GRADES,
  EMPTY_EDUCATION_FORM,
  JHS_GRADES,
  SHS_GRADES,
  STRANDS,
  type EducationForm,
} from '@/constants/education';
import { SPACING } from '@/constants/theme';

type Props = {
  title?: string;
  form: EducationForm;
  onChange: (patch: Partial<EducationForm>) => void;
  disabled?: boolean;
  errors?: Partial<Record<keyof EducationForm, string | null>>;
};

/**
 * The cascading education dropdowns required by the spec:
 *  Education → (College: Department + Year + Block) /
 *              (Senior High: Strand + Grade + Section) /
 *              (Junior High / Elementary: Grade + Section) /
 *              (Kindergarten: Section)
 * Switching the level clears the fields that no longer apply.
 */
export default function EducationFields({ title, form, onChange, disabled, errors }: Props) {
  const selectEducation = (value: string) => {
    // keep section only when the new level still uses it
    const keepsSection = value === 'senior_high' || value === 'junior_high'
      || value === 'elementary' || value === 'kindergarten';
    onChange({
      ...EMPTY_EDUCATION_FORM,
      education: value,
      section: keepsSection ? form.section : '',
    });
  };

  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      <SelectField
        label="Education"
        value={form.education}
        options={EDUCATION_LEVELS}
        onChange={selectEducation}
        placeholder="Select education level"
        icon="school-outline"
        disabled={disabled}
        error={errors?.education}
      />

      {form.education === 'college' ? (
        <>
          <SelectField
            label="Department"
            value={form.department}
            options={DEPARTMENTS}
            onChange={(v) => onChange({ department: v })}
            placeholder="Select department"
            icon="business-outline"
            disabled={disabled}
            error={errors?.department}
          />
          <SelectField
            label="Year Level"
            value={form.year_level}
            options={COLLEGE_YEAR_LEVELS}
            onChange={(v) => onChange({ year_level: v })}
            placeholder="Select year level"
            icon="albums-outline"
            disabled={disabled}
            error={errors?.year_level}
          />
          <SelectField
            label="Block"
            value={form.block}
            options={BLOCKS}
            onChange={(v) => onChange({ block: v })}
            placeholder="Select block"
            icon="grid-outline"
            disabled={disabled}
            error={errors?.block}
          />
        </>
      ) : null}

      {form.education === 'senior_high' ? (
        <>
          <SelectField
            label="Strand"
            value={form.strand}
            options={STRANDS}
            onChange={(v) => onChange({ strand: v })}
            placeholder="Select strand"
            icon="git-branch-outline"
            disabled={disabled}
            error={errors?.strand}
          />
          <SelectField
            label="Grade"
            value={form.grade_level}
            options={SHS_GRADES}
            onChange={(v) => onChange({ grade_level: v })}
            placeholder="Select grade"
            icon="albums-outline"
            disabled={disabled}
            error={errors?.grade_level}
          />
          <FormField
            label="Section"
            value={form.section}
            onChangeText={(v) => onChange({ section: v })}
            placeholder="e.g. STEM1"
            autoCapitalize="characters"
            editable={!disabled}
            icon="people-outline"
            error={errors?.section}
          />
        </>
      ) : null}

      {(form.education === 'junior_high' || form.education === 'elementary') ? (
        <>
          <SelectField
            label="Grade Level"
            value={form.grade_level}
            options={form.education === 'junior_high' ? JHS_GRADES : ELEMENTARY_GRADES}
            onChange={(v) => onChange({ grade_level: v })}
            placeholder="Select grade level"
            icon="albums-outline"
            disabled={disabled}
            error={errors?.grade_level}
          />
          <FormField
            label="Section"
            value={form.section}
            onChangeText={(v) => onChange({ section: v })}
            placeholder="e.g. A"
            autoCapitalize="characters"
            editable={!disabled}
            icon="people-outline"
            error={errors?.section}
          />
        </>
      ) : null}

      {form.education === 'kindergarten' ? (
        <FormField
          label="Section"
          value={form.section}
          onChangeText={(v) => onChange({ section: v })}
          placeholder="e.g. K-B"
          autoCapitalize="characters"
          editable={!disabled}
          icon="people-outline"
          error={errors?.section}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACING.xs },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
  },
});
