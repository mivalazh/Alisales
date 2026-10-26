import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MAX_PHOTOS, toPersianDigits } from '@alisales/schemas';
import { PhotoPipelineError, pickAndProcessPhotos, type ProcessedPhoto } from '@/lib/photos';
import { colors, PHOTO_ASPECT, radius, spacing, touch, type } from '@/lib/theme';

interface Props {
  photos: ProcessedPhoto[];
  onChange: (photos: ProcessedPhoto[]) => void;
  onBusyChange?: (busy: boolean) => void;
  error?: string;
}

export function PhotoStrip({ photos, onChange, onBusyChange, error }: Props) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const remaining = MAX_PHOTOS - photos.length;

  async function add(): Promise<void> {
    if (remaining <= 0 || busy) return;
    setLocalError(null);
    setBusy(true);
    onBusyChange?.(true);
    try {
      const added = await pickAndProcessPhotos(remaining);
      if (added.length > 0) onChange([...photos, ...added]);
    } catch (e) {
      setLocalError(
        e instanceof PhotoPipelineError ? e.message : 'پردازش عکس ناموفق بود؛ دوباره تلاش کنید.',
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  function removeAt(index: number): void {
    onChange(photos.filter((_, i) => i !== index));
  }

  function makeCover(index: number): void {
    if (index === 0) return;
    const next = [...photos];
    const [moved] = next.splice(index, 1);
    if (moved) next.unshift(moved);
    onChange(next);
  }

  return (
    <View>
      <View style={styles.headRow}>
        <Text style={styles.label}>عکس‌های خودرو</Text>
        <Text style={styles.counter}>
          {toPersianDigits(photos.length)} از {toPersianDigits(MAX_PHOTOS)}
        </Text>
      </View>
      <Text style={styles.hint}>
        اولین عکس به‌عنوان کاور آگهی نمایش داده می‌شود. اطلاعات مخفی عکس (EXIF)
        حذف و همه عکس‌ها به WebP تبدیل می‌شوند.
      </Text>

      <View style={styles.grid}>
        {photos.map((photo, index) => (
          <View key={`${photo.uri}-${index}`} style={styles.tile}>
            <Image
              source={{ uri: photo.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={120}
              accessibilityLabel={`پیش‌نمایش عکس ${toPersianDigits(index + 1)}`}
            />
            <Pressable
              onPress={() => makeCover(index)}
              style={[styles.coverChip, index !== 0 && styles.coverChipAction]}
              accessibilityRole="button"
              accessibilityLabel={
                index === 0 ? 'کاور فعلی آگهی' : 'این عکس به‌عنوان کاور انتخاب شود'
              }
            >
              <Text style={[styles.coverText, index === 0 && styles.coverTextActive]}>
                {index === 0 ? 'کاور' : 'کاور شود'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => removeAt(index)}
              style={styles.removeBtn}
              accessibilityRole="button"
              accessibilityLabel={`حذف عکس ${toPersianDigits(index + 1)}`}
            >
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}

        {remaining > 0 && (
          <Pressable
            onPress={() => void add()}
            disabled={busy}
            style={[styles.tile, styles.addTile, busy && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="افزودن عکس"
          >
            {busy ? (
              <ActivityIndicator color={colors.muted} />
            ) : (
              <>
                <Text style={styles.plus}>+</Text>
                <Text style={styles.addText}>افزودن عکس</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {busy && <Text style={styles.status}>در حال پردازش عکس‌ها…</Text>}
      {localError !== null && (
        <Text style={styles.error} accessibilityRole="alert">
          {localError}
        </Text>
      )}
      {error !== undefined && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: type.sm, fontWeight: '800', color: colors.ink },
  counter: { fontSize: type.xs, fontWeight: '700', color: colors.muted },
  hint: {
    fontSize: type.xs,
    color: colors.faint,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    lineHeight: type.xs * 1.6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31%',
    aspectRatio: PHOTO_ASPECT,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sunken,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTile: { borderStyle: 'dashed', borderColor: colors.lineStrong, backgroundColor: colors.card },
  plus: { fontSize: type.xl, color: colors.muted, lineHeight: type.xl + 6 },
  addText: { fontSize: type.xs, fontWeight: '700', color: colors.muted, marginTop: 2 },
  coverChip: {
    position: 'absolute',
    top: 4,
    start: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.cta,
  },
  coverChipAction: { backgroundColor: 'rgba(255,255,255,0.92)' },
  coverText: { fontSize: 10, fontWeight: '800', color: colors.ink },
  coverTextActive: { color: colors.ink },
  removeBtn: {
    position: 'absolute',
    bottom: 4,
    end: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(22,18,36,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: type.xs, fontWeight: '700' },
  status: { fontSize: type.xs, color: colors.muted, marginTop: spacing.sm },
  error: { fontSize: type.xs, fontWeight: '700', color: colors.danger, marginTop: spacing.xs },
});
