// lib/permissions.ts
// Single source of truth for role-based access control.
// Import and call these helpers instead of writing inline role comparisons.
//
// TODO Stage 5: tighten AuthUser.role to the Role type (currently typed as string in use-auth.tsx).

export type Role =
  | 'Admin'
  | 'FactoryManager'
  | 'Employee'
  | 'SalesAgent'
  | 'Accountant';

// Accepts Role | string | undefined so callers don't need to cast user.role yet.
type AnyRole = Role | string | undefined;

export const canViewPrices = (role: AnyRole): boolean =>
  role === 'Admin' || role === 'FactoryManager' || role === 'Accountant';

export const canDeleteProject = (role: AnyRole): boolean =>
  role === 'Admin' || role === 'FactoryManager';

export const canEditContract = (role: AnyRole): boolean =>
  role === 'Admin';

export const canViewContract = (role: AnyRole): boolean =>
  role === 'Admin' || role === 'FactoryManager' || role === 'SalesAgent';

export const canViewProjectDetail = (role: AnyRole): boolean =>
  role === 'Admin' ||
  role === 'FactoryManager' ||
  role === 'Employee' ||
  role === 'Accountant';

export const canViewPayments = (role: AnyRole): boolean =>
  role === 'Admin' || role === 'Accountant';

export const canCreateMilestone = (role: AnyRole): boolean =>
  role === 'Admin' || role === 'Accountant';

export const canDeleteFile = (role: AnyRole): boolean =>
  role === 'Admin';

export const canManageUsers = (role: AnyRole): boolean =>
  role === 'Admin';

export const canEditDropdowns = (role: AnyRole): boolean =>
  role === 'Admin';

export const canViewQRSystem = (role: AnyRole): boolean =>
  role === 'Admin';

export const canViewVendors = (role: AnyRole): boolean =>
  role === 'Admin' || role === 'FactoryManager' || role === 'Employee';

export const canCreateProject = (role: AnyRole): boolean =>
  role === 'Admin' || role === 'FactoryManager' || role === 'Employee';

export const canViewLeads = (role: AnyRole): boolean =>
  role === 'Admin' ||
  role === 'FactoryManager' ||
  role === 'Employee' ||
  role === 'SalesAgent';
