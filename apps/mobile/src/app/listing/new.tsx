import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { canCreateListing, planFor, toPersianDigits } from '@alisales/schemas';
import { ListingForm } from '@/components/ListingForm';
import { createListing, fetchMyListings, usedSlots } from '@/lib/api';
import { colors, radius, spacing, type } from '@/lib/theme';

/**
 * Create listing — enforces the 2-free-listing hard limit up front (the DB
 * trigger enforces it again server-side; both share the schema's rule).
 */
export default function NewListingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const quota = useQuery({ queryKey: ['my-listings'], queryFn: fetchMyListings });

  const plan = planFor('free');
  const used = usedSlots(quota.data ?? []);

  if (quota.isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>در حال بارگذاری…</Text>
      </View>
    );
  }

  if (quota.data && !canCreateListing({ plan, usedSlots: used })) {
    return (
      <View style={styles.center}>
        <View style={styles.paywall} accessibilityRole="alert">
          <Text style={styles.paywallTitle}>سقف ۲ آگهی رایگان تکمیل است</Text>
          <Text style={styles.paywallBody}>
            شما {toPersianDigits(used)} آگهی فعال یا پیش‌نویس دارید. برای ثبت آگهی
            بیشتر، یکی از طرح‌های پایه یا حرفه‌ای را فعال کنید.
          </Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText}>بازگشت</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ListingForm
      submitLabel="انتشار آگهی"
      onSubmit={async (payload, localPhotos) => {
        await createListing(payload, localPhotos);
        await queryClient.invalidateQueries({ queryKey: ['my-listings'] });
        router.replace('/');
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  muted: { fontSize: type.sm, color: colors.muted, textAlign: 'center' },
  paywall: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  paywallTitle: { fontSize: type.md, fontWeight: '800', color: colors.ink },
  paywallBody: { fontSize: type.sm, color: colors.muted, lineHeight: type.sm * 1.7 },
  back: {
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: type.sm, fontWeight: '700', color: colors.ink },
});
