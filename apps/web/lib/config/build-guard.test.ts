import { describe, expect, it } from 'vitest';
import {
  demoListingsHiddenValue,
  productionCatalogueIssue,
  type CatalogueBuildInput,
} from './build-guard';

const BUILD: CatalogueBuildInput = {
  nodeEnv: 'production',
  phase: 'phase-production-build',
  demoHidden: true,
  supabaseUrl: undefined,
  supabaseAnonKey: undefined,
  allowEmpty: undefined,
};

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
