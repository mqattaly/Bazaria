import {
  PERMISSIONS,
  ROLE_CODES,
  ROLE_PERMISSIONS,
  hasPermission,
  isRoleCode,
} from '@bazaria/shared';

describe('Phase 1 role/permission matrix', () => {
  it('recognizes exactly the three base roles', () => {
    expect(ROLE_CODES).toEqual([
      'manager',
      'sales_representative',
      'warehouse_user',
    ]);
    expect(isRoleCode('manager')).toBe(true);
    expect(isRoleCode('platform_admin')).toBe(false);
  });

  it('gives managers every Phase 1 company permission', () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission('manager', permission)).toBe(true);
    }
  });

  it('limits sales representatives and warehouse users to reading the company', () => {
    for (const role of ['sales_representative', 'warehouse_user'] as const) {
      expect(hasPermission(role, 'company.view')).toBe(true);
      expect(hasPermission(role, 'company.settings.manage')).toBe(false);
      expect(hasPermission(role, 'membership.view')).toBe(false);
      expect(hasPermission(role, 'membership.manage')).toBe(false);
      expect(hasPermission(role, 'license.view')).toBe(false);
    }
  });

  it('does not define company permissions for platform administrators', () => {
    // Platform admins are a separate identity, not a role in this matrix.
    expect(Object.keys(ROLE_PERMISSIONS)).toEqual([...ROLE_CODES]);
  });
});
