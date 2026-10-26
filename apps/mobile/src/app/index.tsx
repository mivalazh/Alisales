import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { badgeFor, type BadgeKey } from '@studio/design';
import {
  canCreateListing,
  formatIRR,
  formatJalaliDate,
  listingTransitions,
  planFor,
  toPersianDigits,
  type ListingState,
} from '@alisales/schemas';
import {
  deleteListing,
  fetchMyListings,
  isDemoMode,
  setListingState,
  usedSlots,
  type MyListing,
} from '@/lib/api';
import { colors, radius, spacing, touch, type } from '@/lib/theme';

/** Lifecycle states an owner may move a listing to, with Persian action labels. */
const OWNER_TARGETS: Partial<Record<ListingState, string>> = {
  draft: 'بازگشت به پیش‌نویس',
  pending_review: 'ارسال برای بررسی',
  active: 'فعال‌سازی',
  paused: 'توقف آگهی',
  sold: 'فروخته شد',
};

const STATE_BADGE: Record<ListingState, BadgeKey> = {
  draft: 'draft',
  pending_review: 'pending_review',
  active: 'active',
  paused: 'paused',
  sold: 'sold',
  expired: 'expired',
  rejected: 'rejected',
};

function QuotaNotice({ used, limit }: { used: number; limit: number }) {
  return (
    <View style={styles.quotaBox}>
      <Text style={styles.quotaText}>
        {toPersianDigits(used)} از {toPersianDigits(limit)} آگهی رایگان استفاده شده
      </Text>
    </View>
  );
}

function PaywallNotice() {
  return (
    <View style={styles.paywall} accessibilityRole="alert">
      <Text style={styles.paywallTitle}>سقف ۲ آگهی رایگان تکمیل است</Text>
      <Text style={styles.paywallBody}>
        برای ثبت آگهی بیشتر، یکی از طرح‌های پایه یا حرفه‌ای را فعال کنید. خرید
        طرح در نسخه بعدی ارائه می‌شود.
      </Text>
    </View>
  );
}

function ListingCard({
  listing,
  busy,
  onEdit,
  onTransition,
  onDelete,
}: {
  listing: MyListing;
  busy: boolean;
  onEdit: () => void;
  onTransition: (next: ListingState) => void;
  onDelete: () => void;
}) {
  const badge = badgeFor(STATE_BADGE[listing.state]);
  const targets = (listingTransitions[listing.state] as readonly ListingState[]).filter(
    (t): t is ListingState => t in OWNER_TARGETS,
  );

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.title} numberOfLines={1}>
          {listing.draft.vehicle.model} {toPersianDigits(listing.draft.vehicle.year)}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: badge.background, borderColor: badge.border },
          ]}
        >
          <Text style={[styles.badgeText, { color: badge.foreground }]}>{badge.label}</Text>
        </View>
      </View>

      <Text style={styles.price}>{formatIRR(listing.priceIRR)}</Text>
      {listing.publishedAt !== null && (
        <Text style={styles.muted}>
          تاریخ انتشار: {formatJalaliDate(new Date(listing.publishedAt))}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={onEdit}
          disabled={busy}
          accessibilityRole="button"
          style={styles.actBtn}
        >
          <Text style={styles.actText}>ویرایش</Text>
        </Pressable>
        {targets.map((target) => (
          <Pressable
            key={target}
            onPress={() => onTransition(target)}
            disabled={busy}
            accessibilityRole="button"
            style={styles.actBtn}
          >
            <Text style={styles.actText}>{OWNER_TARGETS[target]}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={onDelete}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.actBtn, styles.actDanger]}
        >
          <Text style={[styles.actText, styles.actDangerText]}>حذف</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MyListingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const listings = useQuery({ queryKey: ['my-listings'], queryFn: fetchMyListings });

  const transition = useMutation({
    mutationFn: (v: { id: string; next: ListingState }) => setListingState(v.id, v.next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-listings'] }),
    onError: (e: Error) => Alert.alert('خطا', e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteListing(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-listings'] }),
    onError: (e: Error) => Alert.alert('خطا', e.message),
  });

  const plan = planFor('free');
  const data = listings.data ?? [];
  const used = usedSlots(data);
  const canCreate = canCreateListing({ plan, usedSlots: used });
  const busyId = transition.isPending ? transition.variables?.id : undefined;

  function confirmDelete(listing: MyListing): void {
    Alert.alert(
      'حذف آگهی',
      `آگهی «${listing.draft.vehicle.model}» حذف شود؟ این عملیات برگشت‌پذیر نیست.`,
      [
        { text: 'انصراف', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: () => remove.mutate(listing.id) },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {isDemoMode && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoText}>
            حالت نمایشی محلی — تغییرات فقط تا بستن برنامه نگه داشته می‌شوند.
          </Text>
        </View>
      )}

      <QuotaNotice used={used} limit={plan.listingLimit} />

      {canCreate ? (
        <Link href="/listing/new" asChild>
          <Pressable accessibilityRole="button" style={styles.cta}>
            <Text style={styles.ctaText}>ثبت آگهی جدید</Text>
          </Pressable>
        </Link>
      ) : (
        <PaywallNotice />
      )}

      {listings.isLoading && <Text style={styles.muted}>در حال بارگذاری آگهی‌ها…</Text>}

      {listings.isError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {listings.error instanceof Error
              ? listings.error.message
              : 'خطایی در دریافت آگهی‌ها رخ داد.'}
          </Text>
          <Pressable
            onPress={() => listings.refetch()}
            accessibilityRole="button"
            style={styles.actBtn}
          >
            <Text style={styles.actText}>تلاش دوباره</Text>
          </Pressable>
        </View>
      )}

      {listings.isSuccess && data.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>هنوز آگهی‌ای ثبت نکرده‌اید.</Text>
          <Text style={styles.muted}>اولین آگهی خودروی خود را همین حالا ثبت کنید.</Text>
        </View>
      )}

      {data.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          busy={busyId === listing.id || remove.isPending}
          onEdit={() =>
            router.push({ pathname: '/listing/[id]', params: { id: listing.id } })
          }
          onTransition={(next) => transition.mutate({ id: listing.id, next })}
          onDelete={() => confirmDelete(listing)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  demoBanner: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  demoText: { fontSize: type.xs, color: colors.warning, fontWeight: '700' },
  quotaBox: {
    backgroundColor: colors.card,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  quotaText: { fontSize: type.sm, fontWeight: '700', color: colors.muted },
  cta: {
    minHeight: touch,
    borderRadius: radius.pill,
    backgroundColor: colors.cta,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  ctaText: { fontSize: type.md, fontWeight: '800', color: colors.ctaOn },
  paywall: {
    backgroundColor: colors.card,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: spacing.lg,
    gap: 6,
  },
  paywallTitle: { fontSize: type.md, fontWeight: '800', color: colors.ink },
  paywallBody: { fontSize: type.sm, color: colors.muted, lineHeight: type.sm * 1.7 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: type.md, fontWeight: '800', color: colors.ink },
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: { fontSize: type.xs, fontWeight: '800' },
  price: { fontSize: type.lg, fontWeight: '800', color: colors.ink },
  muted: { fontSize: type.xs, color: colors.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  actBtn: {
    minHeight: touch * 0.8,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
  },
  actText: { fontSize: type.xs, fontWeight: '700', color: colors.ink },
  actDanger: { borderColor: colors.danger },
  actDangerText: { color: colors.danger },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorText: { fontSize: type.sm, fontWeight: '700', color: colors.danger },
  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: type.md, fontWeight: '800', color: colors.ink },
});
