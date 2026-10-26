import { useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BRANDS,
  CITIES,
  COLOR_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
  LISTING_FIELD_LABELS,
  MAX_VEHICLE_YEAR,
  MIN_VEHICLE_YEAR,
  PLATE_DECLARATION_FOOTER,
  PLATE_TYPE_LABELS,
  colorSlugs,
  conditions,
  fuelTypes,
  formatIRR,
  gearboxTypes,
  listingPublishSchema,
  plateStatement,
  plateTypes,
  toAsciiDigits,
  toPersianDigits,
  type ListingPublish,
  type PlateType,
} from '@alisales/schemas';
import { PhotoStrip } from './PhotoStrip';
import type { ProcessedPhoto } from '@/lib/photos';
import { colors, radius, spacing, touch, type } from '@/lib/theme';

export interface DraftValues {
  brand: string;
  model: string;
  trim: string;
  year: string;
  mileageKm: string;
  gearbox: string;
  fuel: string;
  color: string;
  condition: string;
  plateType: string;
  vin: string;
  priceIRR: string;
  city: string;
  description: string;
  allowPhoneReveal: boolean;
}

export const EMPTY_DRAFT: DraftValues = {
  brand: 'saipa',
  model: '',
  trim: '',
  year: '',
  mileageKm: '',
  gearbox: '',
  fuel: 'petrol',
  color: 'white',
  condition: '',
  plateType: '',
  vin: '',
  priceIRR: '',
  city: 'kish',
  description: '',
  allowPhoneReveal: false,
};

/** Hydrate the edit form from a stored payload (Persian digits for numbers). */
export function draftFromPublish(payload: ListingPublish): DraftValues {
  return {
    brand: payload.vehicle.brand,
    model: payload.vehicle.model,
    trim: payload.vehicle.trim ?? '',
    year: toPersianDigits(payload.vehicle.year),
    mileageKm: toPersianDigits(payload.vehicle.mileageKm),
    gearbox: payload.vehicle.gearbox,
    fuel: payload.vehicle.fuel,
    color: payload.vehicle.color,
    condition: payload.vehicle.condition,
    plateType: payload.vehicle.plateType,
    vin: payload.vehicle.vin ?? '',
    priceIRR: toPersianDigits(payload.priceIRR),
    city: payload.city,
    description: payload.description,
    allowPhoneReveal: payload.allowPhoneReveal,
  };
}

function parseIntLoose(raw: string): number {
  const cleaned = toAsciiDigits(raw).replace(/[٬,\s]/g, '');
  return cleaned === '' ? Number.NaN : Number(cleaned);
}

interface Props {
  initial?: Partial<DraftValues>;
  /** Original photo metadata — preserved while the strip stays untouched. */
  initialPhotos?: ListingPublish['photos'];
  /** Session-processed files to preview in the strip (demo-created listings). */
  initialLocalPhotos?: ProcessedPhoto[];
  submitLabel: string;
  /**
   * `localPhotos` is undefined when the strip was never touched (keep the
   * original photo rows); otherwise it carries the freshly processed files.
   */
  onSubmit: (payload: ListingPublish, localPhotos: ProcessedPhoto[] | undefined) => Promise<void>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text style={styles.fieldError} accessibilityRole="alert">
      {message}
    </Text>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={value === opt.value}
            onPress={() => onChange(opt.value)}
          />
        ))}
      </View>
      <FieldError message={error} />
    </View>
  );
}

export function ListingForm({
  initial,
  initialPhotos,
  initialLocalPhotos,
  submitLabel,
  onSubmit,
}: Props) {
  const [draft, setDraft] = useState<DraftValues>({ ...EMPTY_DRAFT, ...initial });
  const [strip, setStrip] = useState<ProcessedPhoto[]>(initialLocalPhotos ?? []);
  const [photosTouched, setPhotosTouched] = useState(false);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof DraftValues>(key: K, value: DraftValues[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const activeBrand = BRANDS.find((b) => b.slug === draft.brand) ?? BRANDS[0]!;
  const statement = draft.plateType ? plateStatement(draft.plateType as PlateType) : null;
  const pricePreview = (() => {
    const n = parseIntLoose(draft.priceIRR);
    return Number.isFinite(n) && n > 0 ? formatIRR(n) : null;
  })();
  const keptPhotos = photosTouched ? undefined : (initialPhotos ?? []);

  function applyIssues(issues: { path: string; message: string }[]): void {
    const errs: Record<string, string> = {};
    for (const issue of issues) {
      if (errs[issue.path]) continue;
      const label =
        LISTING_FIELD_LABELS[issue.path] ??
        LISTING_FIELD_LABELS[issue.path.split('.')[0] ?? ''] ??
        null;
      errs[issue.path] = label ? `${label} — ${issue.message}` : issue.message;
    }
    setFieldErrors(errs);
  }

  async function handleSubmit(): Promise<void> {
    if (submitting || photosBusy) return;
    setFormError(null);
    setFieldErrors({});

    const payloadPhotos = photosTouched
      ? strip.map((p, i) => ({
          path: `pending/${Date.now().toString(36)}-${i}.webp`,
          mime: 'image/webp' as const,
          bytes: p.bytes,
          width: p.width,
          height: p.height,
          position: i,
        }))
      : keptPhotos;

    const parsed = listingPublishSchema.safeParse({
      vehicle: {
        brand: draft.brand,
        model: draft.model.trim(),
        trim: draft.trim.trim() || null,
        year: parseIntLoose(draft.year),
        mileageKm: parseIntLoose(draft.mileageKm),
        gearbox: draft.gearbox,
        fuel: draft.fuel,
        color: draft.color,
        condition: draft.condition,
        plateType: draft.plateType,
        vin: draft.vin.trim() ? draft.vin.trim().toUpperCase() : null,
      },
      priceIRR: parseIntLoose(draft.priceIRR),
      city: draft.city,
      description: draft.description.trim(),
      photos: payloadPhotos,
      showroomId: null,
      allowPhoneReveal: draft.allowPhoneReveal,
    });

    if (!parsed.success) {
      applyIssues(
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
      setFormError('لطفاً خطاهای مشخص‌شده را برطرف کنید.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(parsed.data, photosTouched ? strip : undefined);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'ارسال آگهی ناموفق بود؛ دوباره تلاش کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {formError !== null && (
        <View style={styles.formErrorBox} accessibilityRole="alert">
          <Text style={styles.formErrorText}>{formError}</Text>
        </View>
      )}

      <Section title="مشخصات خودرو">
        <ChipGroup
          label="برند"
          options={BRANDS.map((b) => ({ value: b.slug, label: b.label }))}
          value={draft.brand}
          onChange={(v) => set('brand', v)}
          error={fieldErrors['vehicle.brand']}
        />

        <View style={styles.group}>
          <Text style={styles.label}>مدل</Text>
          <TextInput
            style={styles.input}
            value={draft.model}
            onChangeText={(v) => set('model', v)}
            placeholder="مثلاً پژو ۲۰۶"
            placeholderTextColor={colors.faint}
            textAlign="right"
          />
          {activeBrand.models.length > 0 && (
            <View style={styles.chipRow}>
              {activeBrand.models.map((m) => (
                <Chip
                  key={m}
                  label={m}
                  selected={draft.model === m}
                  onPress={() => set('model', m)}
                />
              ))}
            </View>
          )}
          <FieldError message={fieldErrors['vehicle.model']} />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>تیپ (اختیاری)</Text>
          <TextInput
            style={styles.input}
            value={draft.trim}
            onChangeText={(v) => set('trim', v)}
            placeholder="مثلاً S یا LX"
            placeholderTextColor={colors.faint}
            textAlign="right"
          />
          <FieldError message={fieldErrors['vehicle.trim']} />
        </View>

        <View style={styles.halfRow}>
          <View style={styles.half}>
            <Text style={styles.label}>
              سال ساخت (شمسی) {toPersianDigits(MIN_VEHICLE_YEAR)}–
              {toPersianDigits(MAX_VEHICLE_YEAR)}
            </Text>
            <TextInput
              style={styles.input}
              value={draft.year}
              onChangeText={(v) => set('year', v)}
              keyboardType="numeric"
              placeholder="۱۴۰۲"
              placeholderTextColor={colors.faint}
              textAlign="right"
            />
            <FieldError message={fieldErrors['vehicle.year']} />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>کارکرد (کیلومتر)</Text>
            <TextInput
              style={styles.input}
              value={draft.mileageKm}
              onChangeText={(v) => set('mileageKm', v)}
              keyboardType="numeric"
              placeholder="۵۸۰۰۰"
              placeholderTextColor={colors.faint}
              textAlign="right"
            />
            <FieldError message={fieldErrors['vehicle.mileageKm']} />
          </View>
        </View>

        <ChipGroup
          label="گیربکس"
          options={gearboxTypes.map((g) => ({ value: g, label: GEARBOX_LABELS[g] }))}
          value={draft.gearbox}
          onChange={(v) => set('gearbox', v)}
          error={fieldErrors['vehicle.gearbox']}
        />
        <ChipGroup
          label="سوخت"
          options={fuelTypes.map((f) => ({ value: f, label: FUEL_LABELS[f] }))}
          value={draft.fuel}
          onChange={(v) => set('fuel', v)}
          error={fieldErrors['vehicle.fuel']}
        />
        <ChipGroup
          label="رنگ"
          options={colorSlugs.map((c) => ({ value: c, label: COLOR_LABELS[c] }))}
          value={draft.color}
          onChange={(v) => set('color', v)}
          error={fieldErrors['vehicle.color']}
        />
        <ChipGroup
          label="وضعیت خودرو"
          options={conditions.map((c) => ({
            value: c,
            label: c === 'new' ? 'نو' : 'کارکرده',
          }))}
          value={draft.condition}
          onChange={(v) => set('condition', v)}
          error={fieldErrors['vehicle.condition']}
        />

        <View style={styles.group}>
          <Text style={styles.label}>شماره شاسی (VIN) — اختیاری</Text>
          <TextInput
            style={[styles.input, styles.ltr]}
            value={draft.vin}
            onChangeText={(v) => set('vin', v)}
            placeholder="VF3XXXXXXXXXXXXXX"
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            textAlign="left"
          />
          <FieldError message={fieldErrors['vehicle.vin']} />
        </View>
      </Section>

      {/* Dedicated seller-declared plate section — spec §4: no forced police notice. */}
      <Section title="وضعیت پلاک">
        <View style={styles.chipRow}>
          {plateTypes.map((pt) => (
            <Chip
              key={pt}
              label={PLATE_TYPE_LABELS[pt]}
              selected={draft.plateType === pt}
              onPress={() => set('plateType', pt)}
            />
          ))}
        </View>
        <FieldError message={fieldErrors['vehicle.plateType']} />
        {statement !== null && (
          <View style={styles.statementBox}>
            <Text style={styles.statementTitle}>{statement}</Text>
            <Text style={styles.statementFooter}>{PLATE_DECLARATION_FOOTER}</Text>
          </View>
        )}
      </Section>

      <Section title="قیمت، شهر و تماس">
        <View style={styles.group}>
          <Text style={styles.label}>قیمت (ریال)</Text>
          <TextInput
            style={styles.input}
            value={draft.priceIRR}
            onChangeText={(v) => set('priceIRR', v)}
            keyboardType="numeric"
            placeholder="۱٬۱۰۰٬۰۰۰٬۰۰۰٬۰۰۰"
            placeholderTextColor={colors.faint}
            textAlign="right"
          />
          <Text style={styles.hint}>
            {pricePreview !== null
              ? `معادل: ${pricePreview}`
              : 'ارقام فارسی یا انگلیسی مجاز است'}
          </Text>
          <FieldError message={fieldErrors['priceIRR']} />
        </View>

        <ChipGroup
          label="شهر"
          options={CITIES.map((c) => ({ value: c.slug, label: c.label }))}
          value={draft.city}
          onChange={(v) => set('city', v)}
          error={fieldErrors['city']}
        />

        <View style={styles.switchRow}>
          <Switch
            value={draft.allowPhoneReveal}
            onValueChange={(v) => set('allowPhoneReveal', v)}
            trackColor={{ true: colors.cta, false: colors.lineStrong }}
            thumbColor={colors.white}
            accessibilityLabel="نمایش شماره تماس در آگهی"
          />
          <View style={styles.switchTexts}>
            <Text style={styles.label}>نمایش شماره تماس من در آگهی</Text>
            <Text style={styles.hint}>
              در غیر این صورت، خریداران فقط از طریق پیام‌رسان داخلی با شما تماس
              می‌گیرند.
            </Text>
          </View>
        </View>
      </Section>

      <Section title="توضیحات">
        <TextInput
          style={[styles.input, styles.textarea]}
          value={draft.description}
          onChangeText={(v) => set('description', v)}
          multiline
          numberOfLines={5}
          placeholder="وضعیت فنی، دلیل فروش، لوازم همراه خودرو…"
          placeholderTextColor={colors.faint}
          textAlign="right"
          textAlignVertical="top"
        />
        <Text style={styles.hint}>
          دست‌کم {toPersianDigits(20)} نویسه — اکنون{' '}
          {toPersianDigits(draft.description.trim().length)} نویسه
        </Text>
        <FieldError message={fieldErrors['description']} />
      </Section>

      <Section title="عکس‌های آگهی">
        <PhotoStrip
          photos={strip}
          onChange={(next) => {
            setPhotosTouched(true);
            setStrip(next);
          }}
          onBusyChange={setPhotosBusy}
          error={fieldErrors['photos']}
        />
        {!photosTouched && (initialPhotos?.length ?? 0) > 0 && (
          <Text style={styles.hint}>
            {toPersianDigits(initialPhotos!.length)} عکس موجود از قبل حفظ شده است؛
            با افزودن عکس جدید، مجموعه عکس‌ها جایگزین می‌شود.
          </Text>
        )}
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerNote}>
          با ثبت آگهی، صحت اطلاعات و وضعیت پلاک را تأیید می‌کنید.
        </Text>
        <Pressable
          onPress={() => void handleSubmit()}
          disabled={submitting || photosBusy}
          accessibilityRole="button"
          style={[styles.submit, (submitting || photosBusy) && { opacity: 0.6 }]}
        >
          <Text style={styles.submitText}>
            {submitting
              ? 'در حال ارسال…'
              : photosBusy
                ? 'در حال پردازش عکس‌ها…'
                : submitLabel}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: type.md,
    fontWeight: '800',
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: spacing.sm,
  },
  group: { gap: 6 },
  halfRow: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1, gap: 6 },
  label: { fontSize: type.sm, fontWeight: '700', color: colors.ink },
  hint: { fontSize: type.xs, color: colors.faint, lineHeight: type.xs * 1.6 },
  fieldError: { fontSize: type.xs, fontWeight: '700', color: colors.danger },
  input: {
    minHeight: touch,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.field,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: type.base,
    color: colors.ink,
  },
  ltr: { writingDirection: 'ltr' },
  textarea: { minHeight: 120, paddingTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: touch * 0.8,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
  },
  chipOn: { borderColor: colors.cta, backgroundColor: colors.ctaSoft },
  chipText: { fontSize: type.sm, fontWeight: '600', color: colors.muted },
  chipTextOn: { color: colors.ink, fontWeight: '800' },
  statementBox: {
    backgroundColor: colors.page,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 4,
  },
  statementTitle: { fontSize: type.sm, fontWeight: '800', color: colors.ink },
  statementFooter: { fontSize: type.xs, color: colors.muted },
  switchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  switchTexts: { flex: 1, gap: 2 },
  formErrorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
  },
  formErrorText: { fontSize: type.sm, fontWeight: '700', color: colors.danger },
  footer: { gap: spacing.sm, alignItems: 'stretch' },
  footerNote: { fontSize: type.xs, color: colors.faint, textAlign: 'center' },
  submit: {
    minHeight: touch,
    borderRadius: radius.pill,
    backgroundColor: colors.cta,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  submitText: { fontSize: type.md, fontWeight: '800', color: colors.ctaOn },
});
