import { describe, expect, it } from 'vitest';
import {
  cataloguePrerenderIssue,
  demoListingsHiddenValue,
  productionCatalogueIssue,
  type CatalogueBuildInput,
  type CataloguePrerenderInput,
} from './build-guard';

const PRERENDER: CataloguePrerenderInput = {
  phase: 'phase-production-build',
  allowEmpty: undefined,
  source: 'public catalogue',
  rows: 0,
};

const BUILD: CatalogueBuildInput = {
  nodeEnv: 'production',
  phase: 'phase-production-build',
  demoHidden: true,
  supabaseUrl: undefined,
  supabaseAnonKey: undefined,
  allowEmpty: undefined,
};

describe('catalogue prerender guard', () => {
  it('refuses a build whose hosted read returned no rows', () => {
    const issue = cataloguePrerenderIssue(PRERENDER);

    expect(issue).toContain('Refusing to prerender an empty public catalogue');
    expect(issue).toContain('returned no rows');
    expect(issue).toContain('ALLOW_EMPTY_CATALOGUE');
  });

  it('names the failure when the read threw instead of answering', () => {
    const issue = cataloguePrerenderIssue({ ...PRERENDER, failure: 'ENOTFOUND project.supabase.co' });

    expect(issue).toContain('the read failed (ENOTFOUND project.supabase.co)');
  });

  it('accepts any non-empty read, including a single row', () => {
    expect(cataloguePrerenderIssue({ ...PRERENDER, rows: 1 })).toBeNull();
  });

  it('stays quiet outside a production build, so a live empty site keeps serving', () => {
    // The phases `next start` and `next dev` pass to the config.
    expect(cataloguePrerenderIssue({ ...PRERENDER, phase: 'phase-production-server' })).toBeNull();
    expect(cataloguePrerenderIssue({ ...PRERENDER, phase: 'phase-development-server' })).toBeNull();
    expect(cataloguePrerenderIssue({ ...PRERENDER, phase: undefined })).toBeNull();
  });

  it('honours the deliberate empty-catalogue opt-out', () => {
    expect(cataloguePrerenderIssue({ ...PRERENDER, allowEmpty: 'true' })).toBeNull();
  });
});

describe('production catalogue build guard', () => {
  it('refuses a production build with the seed hidden and no hosted reads', () => {
    const issue = productionCatalogueIssue(BUILD);

    expect(issue).toContain('Refusing to build an empty production catalogue');
    expect(issue).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(issue).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(issue).toContain('ALLOW_EMPTY_CATALOGUE');
  });

  it('accepts the build when both read credentials are present', () => {
    expect(
      productionCatalogueIssue({
        ...BUILD,
        supabaseUrl: 'https://project.supabase.co',
        supabaseAnonKey: 'anon-key',
      }),
    ).toBeNull();
  });

  it('requires both credentials, not just one', () => {
    expect(
      productionCatalogueIssue({ ...BUILD, supabaseUrl: 'https://project.supabase.co' }),
    ).not.toBeNull();
    expect(productionCatalogueIssue({ ...BUILD, supabaseAnonKey: 'anon-key' })).not.toBeNull();
    expect(
      productionCatalogueIssue({
        ...BUILD,
        supabaseUrl: ' ',
        supabaseAnonKey: 'anon-key',
      }),
    ).not.toBeNull();
  });

  it('does not fire in development or outside the build phase', () => {
    expect(productionCatalogueIssue({ ...BUILD, nodeEnv: 'development' })).toBeNull();
    expect(productionCatalogueIssue({ ...BUILD, phase: undefined })).toBeNull();
    expect(productionCatalogueIssue({ ...BUILD, phase: 'phase-production-server' })).toBeNull();
  });

  it('does not fire while the demo seed is visible', () => {
    expect(productionCatalogueIssue({ ...BUILD, demoHidden: false })).toBeNull();
  });

  it('allows an explicit credential-less preview build', () => {
    expect(productionCatalogueIssue({ ...BUILD, allowEmpty: 'true' })).toBeNull();
    expect(productionCatalogueIssue({ ...BUILD, allowEmpty: 'YES' })).toBeNull();
    expect(productionCatalogueIssue({ ...BUILD, allowEmpty: 'false' })).not.toBeNull();
  });
});

describe('demo seed rule', () => {
  it('hides by default in production and shows by default elsewhere', () => {
    expect(demoListingsHiddenValue(undefined, 'production')).toBe(true);
    expect(demoListingsHiddenValue(undefined, 'development')).toBe(false);
  });

  it('lets an explicit opt-out win in every environment', () => {
    for (const value of ['false', '0', 'no', 'off', ' OFF ']) {
      expect(demoListingsHiddenValue(value, 'production')).toBe(false);
    }
  });

  it('hides for any other non-empty value', () => {
    for (const value of ['true', '1', 'yes', 'anything']) {
      expect(demoListingsHiddenValue(value, 'development')).toBe(true);
    }
  });

  it('treats an empty value as unset', () => {
    expect(demoListingsHiddenValue('', 'production')).toBe(true);
    expect(demoListingsHiddenValue('   ', 'development')).toBe(false);
  });
});
