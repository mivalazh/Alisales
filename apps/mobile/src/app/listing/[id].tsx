import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListingForm, draftFromPublish } from '@/components/ListingForm';
import { fetchListing, updateListing } from '@/lib/api';
import { colors, radius, spacing, type } from '@/lib/theme';

/** Edit listing — hydrates the shared form from the stored payload. */
export default function EditListingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id ?? '');

  const listing = useQuery({
    queryKey: ['listing', id],
    queryFn: () => fetchListing(id),
    enabled: id.length > 0,
  });

  if (listing.isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>در حال بارگذاری…</Text>
      </View>
    );
  }

  if (listing.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {listing.error instanceof Error
            ? listing.error.message
            : 'خطایی در دریافت آگهی رخ داد.'}
        </Text>
        <Pressable onPress={() => listing.refetch()} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>تلاش دوباره</Text>
        </Pressable>
      </View>
    );
  }

  if (!listing.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>آگهی موردنظر یافت نشد.</Text>
        <Pressable onPress={() => router.replace('/')} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>بازگشت به فهرست</Text>
        </Pressable>
      </View>
    );
  }

  const found = listing.data;

  return (
    <ListingForm
      initial={draftFromPublish(found.draft)}
      initialPhotos={found.draft.photos}
      initialLocalPhotos={found.localPhotos}
      submitLabel="ذخیره تغییرات"
      onSubmit={async (payload, localPhotos) => {
        await updateListing(found.id, payload, localPhotos);
        await queryClient.invalidateQueries({ queryKey: ['my-listings'] });
        await queryClient.invalidateQueries({ queryKey: ['listing', id] });
        router.replace('/');
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muted: { fontSize: type.sm, color: colors.muted },
  error: { fontSize: type.sm, fontWeight: '700', color: colors.danger, textAlign: 'center' },
  btn: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: type.sm, fontWeight: '700', color: colors.ink },
});
