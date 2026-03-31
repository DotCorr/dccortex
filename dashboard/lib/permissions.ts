/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * No-code RBAC: permission constants and helpers.
 * Used by getCurrentUser, getUserRoles, hasPermission (lib/auth.ts).
 */

export const PERMISSIONS = {
  APP_VIEW: 'app.view',
  APP_EDIT: 'app.edit',
  DATA_READ: 'data.read',
  DATA_WRITE: 'data.write',
  ORG_MANAGE: 'org.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = [
  PERMISSIONS.APP_VIEW,
  PERMISSIONS.APP_EDIT,
  PERMISSIONS.DATA_READ,
  PERMISSIONS.DATA_WRITE,
  PERMISSIONS.ORG_MANAGE,
];

/** Legacy org member role -> permissions (when roleId is not set) */
export const LEGACY_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  member: [
    PERMISSIONS.APP_VIEW,
    PERMISSIONS.APP_EDIT,
    PERMISSIONS.DATA_READ,
    PERMISSIONS.DATA_WRITE,
  ],
};
