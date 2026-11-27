/**
 * What a deployed project must contain, migration by migration.
 *
 * `scripts/preflight.mjs` checks every entry against the live project, and
 * `tests/preflight-manifest.test.ts` fails when a migration adds a table that
 * is missing here — so a new migration cannot ship without a matching check.
 *
 * Object names are exactly what `supabase/migrations/*.sql` creates. Keep the
 * `migration` field accurate: it is what the operator is told to apply.
 */

/** Every migration file, so coverage is obvious (and testable). */
export const MIGRATION_FILES = [
  '0001_schema.sql',
  '0002_functions.sql',
  '0003_rls.sql',
  '0004_storage.sql',
  '0005_sold_visibility_reactivation.sql',
  '0006_account_favorites_chat.sql',
  '0007_parts_and_visit_metadata.sql',
  '0008_vehicle_condition_fields.sql',
  '0009_social_profiles.sql',
  '0010_platform_flows.sql',
  '0011_profile_story_media.sql',
  '0012_notification_history.sql',
  '0013_health_probes.sql',
  '0014_vehicle_category_specs.sql',
  '0015_vehicle_category_backfill.sql',
  '0016_body_type_backfill.sql',
  '0017_search_fuel_filter.sql',
  '0018_photo_bucket.sql',
  '0019_photo_bucket.sql',
  '0020_notification_item_reads.sql',
];

/** Rows in `public` that the app reads or writes directly. */
export const TABLES = [
  { name: 'users', migration: '0001_schema.sql' },
  { name: 'showrooms', migration: '0001_schema.sql' },
  { name: 'showroom_staff', migration: '0001_schema.sql' },
  { name: 'subscription_plans', migration: '0001_schema.sql' },
  { name: 'subscriptions', migration: '0001_schema.sql' },
  { name: 'subscription_payments', migration: '0001_schema.sql' },
  { name: 'vehicles', migration: '0001_schema.sql' },
  { name: 'listings', migration: '0001_schema.sql' },
  { name: 'listing_photos', migration: '0001_schema.sql' },
  { name: 'inspection_reports', migration: '0001_schema.sql' },
  { name: 'report_versions', migration: '0001_schema.sql' },
  { name: 'report_photos', migration: '0001_schema.sql' },
  { name: 'conversations', migration: '0001_schema.sql' },
  { name: 'messages', migration: '0001_schema.sql' },
  { name: 'abuse_reports', migration: '0001_schema.sql' },
  { name: 'listing_favorites', migration: '0006_account_favorites_chat.sql' },
  { name: 'listing_views', migration: '0006_account_favorites_chat.sql' },
  { name: 'phone_reveal_events', migration: '0006_account_favorites_chat.sql' },
  { name: 'part_details', migration: '0007_parts_and_visit_metadata.sql' },
  { name: 'profile_customizations', migration: '0009_social_profiles.sql' },
  { name: 'seller_follows', migration: '0009_social_profiles.sql' },
  { name: 'story_submissions', migration: '0010_platform_flows.sql' },
  { name: 'inspection_bookings', migration: '0010_platform_flows.sql' },
  { name: 'support_requests', migration: '0010_platform_flows.sql' },
  { name: 'ai_faq_counts', migration: '0010_platform_flows.sql' },
  { name: 'platform_settings', migration: '0010_platform_flows.sql' },
  { name: 'listing_events', migration: '0012_notification_history.sql' },
  { name: 'notification_reads', migration: '0012_notification_history.sql' },
  { name: 'health_probes', migration: '0013_health_probes.sql' },
];

/** RPCs the server calls; a missing one breaks a feature quietly. */
export const RPCS = [
  { name: 'search_listings', migration: '0005_sold_visibility_reactivation.sql' },
  { name: 'is_listing_public', migration: '0005_sold_visibility_reactivation.sql' },
  { name: 'get_seller_phone', migration: '0005_sold_visibility_reactivation.sql' },
  { name: 'effective_plan', migration: '0002_functions.sql' },
  { name: 'listing_limit_for', migration: '0002_functions.sql' },
  { name: 'count_listing_slots', migration: '0002_functions.sql' },
  { name: 'apply_payment_result', migration: '0002_functions.sql' },
  { name: 'expire_stale_listings', migration: '0002_functions.sql' },
  { name: 'increment_faq_topic', migration: '0010_platform_flows.sql' },
  { name: 'mark_notification_read', migration: '0012_notification_history.sql' },
  {
    name: 'record_listing_notification_event',
    migration: '0012_notification_history.sql',
  },
];

/** Storage buckets and whether clients may read them without a secret. */
export const BUCKETS = [
  { id: 'photos', public: true, migration: '0018_photo_bucket.sql' },
  { id: 'listing-photos', public: true, migration: '0004_storage.sql' },
  { id: 'report-photos', public: true, migration: '0004_storage.sql' },
  { id: 'showroom-licenses', public: false, migration: '0004_storage.sql' },
  { id: 'profile-media', public: true, migration: '0011_profile_story_media.sql' },
  { id: 'story-media', public: true, migration: '0011_profile_story_media.sql' },
];

/** Views the public catalogue reads through (redefined by later migrations). */
export const VIEWS = [
  { name: 'listing_cards', migration: '0007_parts_and_visit_metadata.sql' },
];

/** Columns added by migrations, checked so an ALTER-only migration is caught. */
export const COLUMNS = [
  { table: 'messages', column: 'kind', migration: '0007_parts_and_visit_metadata.sql' },
  { table: 'messages', column: 'visit_date', migration: '0007_parts_and_visit_metadata.sql' },
  { table: 'vehicles', column: 'paint_condition', migration: '0008_vehicle_condition_fields.sql' },
  { table: 'vehicles', column: 'third_party_insurance', migration: '0008_vehicle_condition_fields.sql' },
  // Motorcycle / heavy-machinery page specs (0014).
  { table: 'vehicles', column: 'category', migration: '0014_vehicle_category_specs.sql' },
  { table: 'vehicles', column: 'body_type', migration: '0014_vehicle_category_specs.sql' },
  { table: 'vehicles', column: 'engine_cc', migration: '0014_vehicle_category_specs.sql' },
  { table: 'vehicles', column: 'bike_type', migration: '0014_vehicle_category_specs.sql' },
  { table: 'vehicles', column: 'heavy_type', migration: '0014_vehicle_category_specs.sql' },
  { table: 'vehicles', column: 'working_hours', migration: '0014_vehicle_category_specs.sql' },
];
