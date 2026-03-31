/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Re-exports from registry (task 05). Kept for backward compatibility.
 * New code should import from ./registry.
 */
export type { Node } from './registry'
export { createNode, getDefaultProps, getComponentDef, COMPONENT_REGISTRY, CATEGORIES } from './registry'
