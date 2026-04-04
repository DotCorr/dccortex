/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { EditorProps } from '@monaco-editor/react'
import { Zap } from 'lucide-react'
import type { Node } from './registry'
import { getComponentDef, STYLE_PROP_KEYS } from './registry'
import { FONT_FAMILIES } from './fonts'
import {
  parseEventSteps,
  stringifyEventSteps,
  EVENT_HELPERS,
  CONDITION_OPS,
  type EventActionConfig,
  type EventActionType,
} from './eventHelpers'
import { ExpressionBuilderModal } from './ExpressionBuilderModal'
import { IconPickerModal } from './IconPickerModal'
import { FontPickerModal } from './FontPickerModal'
import { GradientBuilderModal } from './GradientBuilderModal'
import { AssetPickerModal } from './AssetPickerModal'
import { AnimationSequenceBuilder, type AnimationSequenceConfig } from './AnimationSequenceBuilder'
import type { ReusableDefinition, ReusablePropSchema } from './globals'

const MonacoEditorBase = dynamic(() => import('@monaco-editor/react'), { ssr: false })
const MonacoEditor = (props: EditorProps) => <MonacoEditorBase keepCurrentModel {...props} />

export type StateDefinition = { id: string; name: string; initialValue: string; type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' }
export type CustomTypeField = { name: string; type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date'; defaultValue?: string }
export type CustomTypeDef = { id: string; name: string; fields: CustomTypeField[] }
export type DataSourceDef = {
  id: string
  name: string
  sourceId?: string
  /** Per-source URL param overrides: { paramName: '{{state.lat}}' } */
  urlParamBindings?: Record<string, string>
}

/** Per-node component props: name, type, required. Values live in node.props[key]. Empty value when exported as reusable = compulsory when placing. */
export type PropContractEntry = { key: string; type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date'; required?: boolean }

export type ScreenTheme = {
  borderRadius?: string
  borderRadiusSm?: string
  borderRadiusLg?: string
  primary?: string
  background?: string
  text?: string
  surface?: string
  borderColor?: string
  /** 'light' | 'dark' | 'adaptive' (follows OS). Stored on globalTheme only. */
  colorMode?: 'light' | 'dark' | 'adaptive'
  /** Raw CSS injected globally into the canvas/preview. Stored on globalTheme only. */
  customCss?: string
}

export type SeoSettings = {
  title?: string        // e.g. "About | My App" — {{screenName}} and {{projectName}} tokens supported
  description?: string  // meta description
  ogTitle?: string      // og:title (defaults to title)
  ogDescription?: string// og:description
  ogImage?: string      // og:image URL
  canonical?: string    // canonical URL
  robots?: string       // e.g. "index,follow" or "noindex"
  customHead?: string   // raw <meta> / <link> tags injected into <head>
}

type Props = {
  node: Node | null
  onUpdate: (props: Record<string, unknown>) => void
  stateDefinitions?: StateDefinition[]
  onStateDefinitionsChange?: (state: StateDefinition[]) => void
  dataSources?: DataSourceDef[]
  onDataSourcesChange?: (data: DataSourceDef[]) => void
  /** Live runtime data payload for Data Inspector path discovery. */
  runtimeData?: Record<string, unknown>
  namedScripts?: Record<string, string>
  scriptsLoading?: boolean
  onNamedScriptsChange?: (scripts: Record<string, string>) => void
  theme?: ScreenTheme
  onThemeChange?: (updates: Partial<ScreenTheme>) => void
  globalStateDefinitions?: StateDefinition[]
  onGlobalStateDefinitionsChange?: (state: StateDefinition[]) => void
  globalTheme?: ScreenTheme
  onGlobalThemeChange?: (updates: Partial<ScreenTheme>) => void
  screenTargets?: { id: string; name: string; presentation?: 'page' | 'modal' | 'sidebar' }[]
  /** Used to show schema-based "Pass props" when the selected node is a reusable instance. */
  globalReusables?: ReusableDefinition[]
  /** Props from parent (reusable instance). When selected node is inside a reusable, bind dropdown shows these so you can bind to {{prop.key}}. */
  parentPropSchema?: ReusablePropSchema[]
  /** How this screen is presented when navigated to; stored in layout payload. */
  presentation?: 'page' | 'modal'
  onPresentationChange?: (p: 'page' | 'modal') => void
  /** Props this screen declares for incoming navigation payloads. */
  screenPropDefs?: { name: string; type: string; defaultValue?: string; required?: boolean }[]
  onScreenPropDefsChange?: (defs: { name: string; type: string; defaultValue?: string; required?: boolean }[]) => void
  /** Project ID — used by the asset picker to list/upload assets. */
  projectId?: string
  /** Project assets — shown as bindable tokens in the ⚡ binding dropdown. */
  projectAssets?: { id: string; name: string; url: string; mimetype?: string }[]
  /** Per-screen SEO settings */
  seoSettings?: SeoSettings
  onSeoChange?: (updates: Partial<SeoSettings>) => void
  /** Open reusable definition editor from selected instance. */
  onEditReusable?: (id: string) => void
  /** Wrap selected node in a suspense component for explicit component architecture. */
  onWrapSelectedWithSuspense?: () => void
  /** User-defined object schemas for typed state values. */
  customTypes?: CustomTypeDef[]
  onCustomTypesChange?: (defs: CustomTypeDef[]) => void
  /** AI edit lock state for this screen. */
  aiProtected?: boolean
  onAiProtectedChange?: (locked: boolean) => void
  /** Optional browser storage key to persist active tab for this editor session. */
  tabStorageKey?: string
  /** Optional browser storage key to persist property panel scroll position. */
  scrollStorageKey?: string
}

const LAYOUT_KEYS = ['display', 'flexDirection', 'flexWrap', 'alignItems', 'alignContent', 'justifyContent', 'gap', 'rowGap', 'columnGap', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'width', 'height', 'minHeight', 'maxHeight', 'minWidth', 'maxWidth', 'flexGrow', 'flexShrink', 'flexBasis', 'flex', 'alignSelf', 'justifySelf', 'order', 'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow']

// Reserved property names that are built-in to components and cannot be used as component prop names
const RESERVED_PROP_NAMES = new Set([
  'content', 'icon', 'label', 'placeholder', 'value', 'alt', 'checked', 'src', 
  'min', 'max', 'step', 'href', 'target', 'download', 'item', 'items', 'selected',
  'expanded', 'disabled', 'required', 'readonly', 'option', 'options', 'direction',
  'hamburgerIcon', 'hamburgerColor', 'hamburgerBackground', 'mobileMenu',
  'customId', 'script', '__propContract', 'visibleWhen', 'reusableProps',
  'reusableId', 'visibility', 'display'
])

const PROP_LABELS: Record<string, string> = {
  display: 'Display',
  flex: 'Flex',
  flexDirection: 'Direction',
  flexWrap: 'Wrap',
  alignItems: 'Align items',
  justifyContent: 'Justify content',
  gap: 'Gap (px)',
  padding: 'Padding (px)',
  margin: 'Margin (px)',
  width: 'Width',
  height: 'Height',
  minHeight: 'Min height (px)',
  customId: 'ID (for refs / getElementById)',
  variant: 'Variant',
  content: 'Content',
  title: 'Title',
  label: 'Label',
  url: 'URL',
  alt: 'Alt text',
  icon: 'Icon name (e.g. mdi:home — browse at iconify.design)',
  collapsible: 'Collapsible sidebar (hamburger in preview)',
  hamburgerBreakpoint: 'Show hamburger on (device size)',
  hamburgerTop: 'Hamburger top offset (px)',
  hamburgerLeft: 'Hamburger left offset (px)',
  hamburgerBg: 'Hamburger background color',
  hamburgerColor: 'Hamburger icon / bars color',
  hamburgerBorder: 'Hamburger button border',
  hamburgerRadius: 'Hamburger border radius',
  hamburgerIcon: 'Hamburger icon (replaces 3-bar)',
  hamburgerIconSize: 'Hamburger icon size (px)',
  hamburgerContentOffset: 'Content padding-top to clear hamburger (px)',
  suspenseEnabled: 'Loading fallback',
  suspenseVariant: 'Fallback style',
  suspenseDirection: 'Line direction',
  suspenseLabel: 'Fallback label',
  suspenseWhen: 'Show while (expression)',
  suspenseSmart: 'Auto-detect data loading',
  size: 'Icon size (px)',
  placeholder: 'Placeholder',
  options: 'Options (comma-separated)',
  columns: 'Columns (comma-separated)',
  rows: 'Rows (CSV lines)',
  data: 'Data (comma or JSON array)',
  dataA: 'Series A (stacked bar)',
  dataB: 'Series B (stacked bar)',
  dataC: 'Series C (stacked bar)',
  labels: 'Labels (comma-separated)',
  showDots: 'Show dots (line chart)',
  innerRadiusPercent: 'Inner radius % (doughnut)',
  value: 'Value (gauge)',
  min: 'Min (gauge)',
  max: 'Max (gauge)',
  checked: 'Checked',
  visibleWhen: 'Visible when',
  // Full CSS
  backgroundColor: 'Background color',
  color: 'Color',
  fontSize: 'Font size',
  fontWeight: 'Font weight',
  fontFamily: 'Font family',
  fontStyle: 'Font style',
  lineHeight: 'Line height',
  letterSpacing: 'Letter spacing',
  textAlign: 'Text align',
  textDecoration: 'Text decoration',
  textTransform: 'Text transform',
  border: 'Border',
  borderTop: 'Border top',
  borderRight: 'Border right',
  borderBottom: 'Border bottom',
  borderLeft: 'Border left',
  borderWidth: 'Border width',
  borderStyle: 'Border style',
  borderColor: 'Border color',
  borderRadius: 'Border radius',
  borderTopLeftRadius: 'Border top-left radius',
  borderTopRightRadius: 'Border top-right radius',
  borderBottomRightRadius: 'Border bottom-right radius',
  borderBottomLeftRadius: 'Border bottom-left radius',
  boxShadow: 'Box shadow',
  opacity: 'Opacity',
  outline: 'Outline',
  outlineOffset: 'Outline offset',
  cursor: 'Cursor',
  transition: 'Transition',
  transform: 'Transform',
  minWidth: 'Min width',
  maxWidth: 'Max width',
  maxHeight: 'Max height',
  aspectRatio: 'Aspect ratio (e.g. 16/9, 1, 0.5)',
  overflow: 'Overflow',
  overflowX: 'Overflow X',
  overflowY: 'Overflow Y',
  position: 'Position',
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
  zIndex: 'Z-index',
  objectFit: 'Object fit',
  objectPosition: 'Object position',
  // Background / gradient
  background: 'Background (gradient / shorthand)',
  backgroundImage: 'Background image / gradient',
  backgroundSize: 'Background size',
  backgroundPosition: 'Background position',
  backgroundRepeat: 'Background repeat',
  backgroundBlendMode: 'Background blend mode',
  // Animation
  animation: 'Animation',
  animationDuration: 'Duration',
  animationTimingFunction: 'Timing function',
  animationDelay: 'Delay',
  animationIterationCount: 'Iteration count',
  animationDirection: 'Direction',
  animationFillMode: 'Fill mode',
  willChange: 'Will-change (perf hint)',
  // Filters
  filter: 'Filter (blur, brightness…)',
  backdropFilter: 'Backdrop filter',
  mixBlendMode: 'Mix blend mode',
  // Interaction
  pointerEvents: 'Pointer events',
  userSelect: 'User select',
  // Text extras
  textOverflow: 'Text overflow',
  whiteSpace: 'White space',
  wordBreak: 'Word break',
  verticalAlign: 'Vertical align',
  listStyleType: 'List style type',
  listStylePosition: 'List style position',
  textShadow: 'Text shadow',
  textIndent: 'Text indent',
  lineClamp: 'Line clamp (lines)',
  // Layout extras
  alignContent: 'Align content',
  rowGap: 'Row gap',
  columnGap: 'Column gap',
  flexGrow: 'Flex grow',
  flexShrink: 'Flex shrink',
  flexBasis: 'Flex basis',
  alignSelf: 'Align self',
  justifySelf: 'Justify self',
  order: 'Order',
  gridTemplateColumns: 'Grid columns (e.g. repeat(3, 1fr))',
  gridTemplateRows: 'Grid rows (e.g. auto 1fr auto)',
  gridColumn: 'Column span (e.g. span 2, 1 / -1)',
  gridRow: 'Row span (e.g. span 2, 1 / 3)',
  paddingTop: 'Padding top',
  paddingRight: 'Padding right',
  paddingBottom: 'Padding bottom',
  paddingLeft: 'Padding left',
  marginTop: 'Margin top',
  marginRight: 'Margin right',
  marginBottom: 'Margin bottom',
  marginLeft: 'Margin left',
  reusableProps: 'Reusable props (JSON)',
  orientation: 'Orientation',
  thickness: 'Thickness',
}

import { BUILDER_EVENT_KEYS } from './registry'

const EVENT_LABELS: Record<string, string> = {
  onLoad: 'onLoad',
  onClick: 'onClick',
  onDoubleClick: 'onDoubleClick',
  onChange: 'onChange',
  onSubmit: 'onSubmit',
  onFocus: 'onFocus',
  onBlur: 'onBlur',
  onInput: 'onInput',
  onMouseEnter: 'onMouseEnter',
  onMouseLeave: 'onMouseLeave',
  onPressIn: 'onPressIn',
  onPressOut: 'onPressOut',
  onKeyDown: 'onKeyDown',
  onKeyUp: 'onKeyUp',
}

const BORDER_STYLE_OPTIONS = ['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset']
const POSITION_OPTIONS = ['static', 'relative', 'absolute', 'fixed', 'sticky']
const OVERFLOW_OPTIONS = ['visible', 'hidden', 'clip', 'scroll', 'auto']
const OBJECT_FIT_OPTIONS = ['fill', 'contain', 'cover', 'none', 'scale-down']
const CURSOR_OPTIONS = ['auto', 'default', 'pointer', 'text', 'move', 'grab', 'grabbing', 'crosshair', 'not-allowed', 'wait', 'zoom-in', 'zoom-out', 'ns-resize', 'ew-resize', 'none']
const BG_SIZE_OPTIONS = ['auto', 'cover', 'contain', '100% 100%', '100% auto', 'auto 100%']
const BG_REPEAT_OPTIONS = ['repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'space', 'round']
const BLEND_MODE_OPTIONS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']
const ANIMATION_TIMING_OPTIONS = ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end', 'cubic-bezier(0.4,0,0.2,1)']
const ANIMATION_DIRECTION_OPTIONS = ['normal', 'reverse', 'alternate', 'alternate-reverse']
const ANIMATION_FILL_MODE_OPTIONS = ['none', 'forwards', 'backwards', 'both']
const ANIMATION_ITERATION_OPTIONS = ['1', '2', '3', 'infinite']
const POINTER_EVENTS_OPTIONS = ['auto', 'none', 'all']
const USER_SELECT_OPTIONS = ['auto', 'none', 'text', 'all']
/** Preset animation shorthand values – keyframes injected by BuilderCanvas */
const ANIMATION_PRESETS: { label: string; value: string }[] = [
  { label: 'Fade in', value: 'fadeIn 0.5s ease both' },
  { label: 'Fade out', value: 'fadeOut 0.5s ease both' },
  { label: 'Slide up', value: 'slideInUp 0.5s ease both' },
  { label: 'Slide down', value: 'slideInDown 0.5s ease both' },
  { label: 'Slide left', value: 'slideInLeft 0.5s ease both' },
  { label: 'Slide right', value: 'slideInRight 0.5s ease both' },
  { label: 'Zoom in', value: 'zoomIn 0.4s ease both' },
  { label: 'Zoom out', value: 'zoomOut 0.4s ease both' },
  { label: 'Bounce in', value: 'bounceIn 0.6s cubic-bezier(0.36,0.07,0.19,0.97) both' },
  { label: 'Pulse', value: 'pulse 1.5s ease infinite' },
  { label: 'Shake', value: 'shake 0.5s ease both' },
  { label: 'Spin', value: 'spin 1s linear infinite' },
  { label: 'Ping', value: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' },
  { label: 'Float', value: 'float 3s ease-in-out infinite' },
]
/** Gradient quick-fill presets */
const GRADIENT_PRESETS: { label: string; value: string }[] = [
  { label: 'Blue → Purple', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { label: 'Orange → Pink', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { label: 'Teal → Cyan', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { label: 'Green → Teal', value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { label: 'Sunset', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { label: 'Midnight', value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { label: 'Dark ocean', value: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)' },
  { label: 'Rose gold', value: 'linear-gradient(135deg, #f9d4d4 0%, #d4a5a5 100%)' },
  { label: 'Black → White', value: 'linear-gradient(135deg, #000000 0%, #ffffff 100%)' },
  { label: 'Transparent → Black (overlay)', value: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)' },
]
/** Quick-pick pill values for fields that have a small set of well-known options but also support free text / interpolation */
const STYLE_QUICK_PICKS: Record<string, string[]> = {
  fontStyle: ['normal', 'italic', 'oblique'],
  fontWeight: ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'bold', 'bolder', 'lighter'],
  textAlign: ['left', 'center', 'right', 'justify', 'start', 'end'],
  textDecoration: ['none', 'underline', 'line-through', 'overline', 'underline line-through'],
  textTransform: ['none', 'capitalize', 'uppercase', 'lowercase'],
  lineHeight: ['normal', '1', '1.25', '1.5', '1.75', '2', '2.5'],
  letterSpacing: ['normal', '-0.05em', '0', '0.025em', '0.05em', '0.1em', '0.25em'],
  display: ['block', 'flex', 'grid', 'inline', 'inline-block', 'inline-flex', 'none'],
  flexDirection: ['row', 'column', 'row-reverse', 'column-reverse'],
  flexWrap: ['nowrap', 'wrap', 'wrap-reverse'],
  alignItems: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
  justifyContent: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
  alignSelf: ['auto', 'stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
  justifySelf: ['auto', 'stretch', 'start', 'center', 'end'],
  textOverflow: ['clip', 'ellipsis'],
  whiteSpace: ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'],
  wordBreak: ['normal', 'break-all', 'keep-all', 'break-word'],
  verticalAlign: ['baseline', 'top', 'middle', 'bottom', 'text-top', 'text-bottom', 'sub', 'super'],
  listStyleType: ['none', 'disc', 'circle', 'square', 'decimal', 'decimal-leading-zero', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'],
  flexGrow: ['0', '1', '2', '3'],
  flexShrink: ['0', '1', '2'],
  flexBasis: ['auto', '0', '25%', '33%', '50%', '66%', '75%', '100%'],
  borderRadius: ['0px', '2px', '4px', '6px', '8px', '12px', '16px', '24px', '9999px'],
  opacity: ['0', '0.25', '0.5', '0.75', '1'],
  zIndex: ['-1', '0', '1', '10', '20', '30', '50', '100', '999', '9999'],
  fontSize: ['10px', '11px', '12px', '13px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px', '64px', '0.75rem', '0.875rem', '1rem', '1.125rem', '1.25rem', '1.5rem', '2rem', '3rem'],
  gap: ['0', '2px', '4px', '6px', '8px', '12px', '16px', '20px', '24px', '32px'],
  rowGap: ['0', '4px', '8px', '12px', '16px', '24px'],
  columnGap: ['0', '4px', '8px', '12px', '16px', '24px'],
  alignContent: ['stretch', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
  listStylePosition: ['inside', 'outside'],
  order: ['-1', '0', '1', '2', '3', '4', '5'],
  gridTemplateColumns: [
    'repeat(2, 1fr)',
    'repeat(3, 1fr)',
    'repeat(4, 1fr)',
    'repeat(auto-fit, minmax(200px, 1fr))',
    'repeat(auto-fill, minmax(150px, 1fr))',
    '1fr 1fr',
    '1fr 2fr 1fr',
    '200px 1fr',
    'auto 1fr auto',
    '1fr 1fr 1fr 1fr',
  ],
  gridTemplateRows: [
    'auto',
    'repeat(2, auto)',
    'repeat(3, 1fr)',
    'auto 1fr auto',
    '1fr 1fr',
    'min-content 1fr min-content',
  ],
  gridColumn: [
    'auto',
    'span 1',
    'span 2',
    'span 3',
    'span 4',
    'span 6',
    '1 / 3',
    '1 / 4',
    '1 / -1',
    '2 / -1',
  ],
  gridRow: [
    'auto',
    'span 1',
    'span 2',
    'span 3',
    '1 / 3',
    '1 / -1',
  ],
}

type PanelTab = 'theme' | 'layout' | 'content' | 'style' | 'animation' | 'events' | 'state' | 'assets' | 'data' | 'seo'

const APP_TABS: { id: PanelTab; label: string }[] = [
  { id: 'theme', label: 'Theme' },
  { id: 'seo', label: 'SEO' },
  { id: 'state', label: 'State' },
  { id: 'assets', label: 'Assets' },
  { id: 'data', label: 'Data' },
]

const COMPONENT_TABS: { id: PanelTab; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'content', label: 'Content' },
  { id: 'style', label: 'Style' },
  { id: 'animation', label: 'Animate' },
  { id: 'events', label: 'Events' },
]

// Keep a flat list for any code that still needs it
const TABS = [...APP_TABS, ...COMPONENT_TABS]

function collectReusablePropsSchemaFromNode(node: Node | null | undefined): ReusablePropSchema[] {
  if (!node) return []
  const byKey = new Map<string, ReusablePropSchema>()
  const walk = (n: Node) => {
    const contract = (n.props?.__propContract as Array<{ key: string; type: string; required?: boolean }> | undefined) ?? []
    for (const entry of contract) {
      const key = String(entry.key ?? '').trim()
      if (!key || byKey.has(key)) continue
      const type: 'string' | 'number' | 'boolean' = entry.type === 'number' || entry.type === 'boolean' ? entry.type : 'string'
      const rawDefault = (n.props as Record<string, unknown>)[key]
      const defaultValue = rawDefault != null ? String(rawDefault) : undefined
      const isEmpty = defaultValue === undefined || defaultValue === ''
      byKey.set(key, { key, type, defaultValue, required: entry.required ?? isEmpty })
    }
    for (const child of n.children ?? []) walk(child)
  }
  walk(node)
  return Array.from(byKey.values())
}

export function PropertyPanel({
  node,
  onUpdate,
  stateDefinitions = [],
  onStateDefinitionsChange,
  dataSources = [],
  onDataSourcesChange,
  runtimeData = {},
  namedScripts = {},
  scriptsLoading = false,
  onNamedScriptsChange,
  theme = {},
  onThemeChange,
  globalStateDefinitions = [],
  onGlobalStateDefinitionsChange,
  globalTheme = {},
  onGlobalThemeChange,
  screenTargets = [],
  globalReusables = [],
  parentPropSchema = [],
  presentation = 'page',
  onPresentationChange,
  projectId,
  projectAssets,
  seoSettings = {},
  onSeoChange,
  onWrapSelectedWithSuspense,
  tabStorageKey,
  scrollStorageKey,
}: Props) {
  const expandSourceAliases = useCallback((name: string): string[] => {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) return []
    const snake = trimmed.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
    const kebab = trimmed.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
    const compact = trimmed.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase()
    return Array.from(new Set([trimmed, snake, kebab, compact].filter(Boolean)))
  }, [])

  const [activeTab, setActiveTab] = useState<PanelTab>('layout')
  const [bindingFor, setBindingFor] = useState<string | null>(null)
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null)
  const [fontPickerOpen, setFontPickerOpen] = useState(false)
  const [gradientBuilderFor, setGradientBuilderFor] = useState<string | null>(null)
  const [expressionModal, setExpressionModal] = useState<{ ev: string; stepIdx: number; field: 'value' | 'conditionLeft' | 'conditionRight' } | null>(null)
  const [assetPickerFor, setAssetPickerFor] = useState<{ ev: string; stepIdx: number } | { propKey: string; filterType?: 'image' | 'audio' | 'video' | 'all' } | null>(null)
  const [propExpressionKey, setPropExpressionKey] = useState<string | null>(null)
  const [projectApiSourceNames, setProjectApiSourceNames] = useState<string[]>([])
  const [projectTableNames, setProjectTableNames] = useState<string[]>([])
  const [inspectorSource, setInspectorSource] = useState('')
  const [inspectorCopyNotice, setInspectorCopyNotice] = useState('')
  const [monacoReady, setMonacoReady] = useState(false)
  const inspectorCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyScrollRef = useRef<HTMLDivElement | null>(null)

  const props = node?.props ?? {}

  const copyInspectorText = useCallback((text: string, label = 'Copied') => {
    navigator.clipboard?.writeText(text)
      .then(() => {
        setInspectorCopyNotice(label)
        if (inspectorCopyTimerRef.current) clearTimeout(inspectorCopyTimerRef.current)
        inspectorCopyTimerRef.current = setTimeout(() => setInspectorCopyNotice(''), 1200)
      })
      .catch(() => {
        setInspectorCopyNotice('Copy failed')
        if (inspectorCopyTimerRef.current) clearTimeout(inspectorCopyTimerRef.current)
        inspectorCopyTimerRef.current = setTimeout(() => setInspectorCopyNotice(''), 1600)
      })
  }, [])

  useEffect(() => () => {
    if (inspectorCopyTimerRef.current) clearTimeout(inspectorCopyTimerRef.current)
  }, [])

  useEffect(() => {
    let canceled = false
    if (!projectId) {
      setProjectApiSourceNames([])
      setProjectTableNames([])
      return
    }
    fetch(`/api/projects/${projectId}/api-sources`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (canceled) return
        const names = Array.isArray(payload?.sources)
          ? payload.sources
            .map((src: any) => String(src?.name ?? '').trim())
            .filter((name: string) => name.length > 0)
          : []
        setProjectApiSourceNames(Array.from(new Set(names)))
      })
      .catch(() => {
        if (!canceled) setProjectApiSourceNames([])
      })

    fetch(`/api/projects/${projectId}/datasources`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (canceled) return
        const tableNames = Array.isArray(payload?.datasources)
          ? payload.datasources.flatMap((ds: any) =>
            Array.isArray(ds?.tables)
              ? ds.tables
                .map((table: any) => String(table?.name ?? '').trim())
                .filter((name: string) => name.length > 0)
              : []
          )
          : []
        setProjectTableNames(Array.from(new Set(tableNames)))
      })
      .catch(() => {
        if (!canceled) setProjectTableNames([])
      })

    return () => {
      canceled = true
    }
  }, [projectId])

  useEffect(() => {
    if (!tabStorageKey || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(tabStorageKey)
      if (!raw) return
      const validTabs: PanelTab[] = ['theme', 'layout', 'content', 'style', 'animation', 'events', 'state', 'assets', 'data', 'seo']
      if ((validTabs as string[]).includes(raw)) {
        setActiveTab(raw as PanelTab)
      }
    } catch {}
  }, [tabStorageKey])

  useEffect(() => {
    if (!tabStorageKey || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(tabStorageKey, activeTab)
    } catch {}
  }, [tabStorageKey, activeTab])

  useEffect(() => {
    if (!scrollStorageKey || typeof window === 'undefined' || !bodyScrollRef.current) return
    try {
      const raw = window.localStorage.getItem(`${scrollStorageKey}:scrollTop`)
      if (raw) bodyScrollRef.current.scrollTop = Math.max(0, Number(raw) || 0)
    } catch {}
  }, [scrollStorageKey, activeTab])

  useEffect(() => {
    if (!scrollStorageKey || typeof window === 'undefined' || !bodyScrollRef.current) return
    const el = bodyScrollRef.current
    const onScroll = () => {
      try { window.localStorage.setItem(`${scrollStorageKey}:scrollTop`, String(el.scrollTop)) } catch {}
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollStorageKey])

  useEffect(() => {
    let raf = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    raf = window.requestAnimationFrame(() => {
      timer = setTimeout(() => setMonacoReady(true), 0)
    })
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      if (timer) clearTimeout(timer)
    }
  }, [])
  const setProp = useCallback(
    (key: string, value: unknown) => {
      if (!node) return

      if (typeof value === 'string') {
        const dataSourceMatch = value.match(/^\{\{data\.([^}]+)\}\}$/)
        if (dataSourceMatch) {
          const sourceToken = dataSourceMatch[1].trim()
          // Keep transformed paths intact; normalize only root source tokens picked from dropdown.
          if (sourceToken && !sourceToken.includes('.')) {
            const preferred = expandSourceAliases(sourceToken).find((alias) => /^[a-z0-9_]+$/.test(alias)) ?? sourceToken
            value = `{{data.${preferred}}}`
          }
        }
      }

      // Data repeater expects the whole array source ({{data.sourceName}}), not a field token.
      if (node.type === 'dataRepeater' && key === 'dataSource' && typeof value === 'string') {
        const normalized = value.replace(/^\{\{data\.([^}.]+)\.field\}\}$/, '{{data.$1}}')
        onUpdate({ ...props, [key]: normalized })
        return
      }

      onUpdate({ ...props, [key]: value })
    },
    [node, props, onUpdate, expandSourceAliases]
  )
  const reusablePropsObj = (props.reusableProps ?? {}) as Record<string, unknown>
  const setReusableProp = useCallback(
    (key: string, value: unknown) => {
      if (!node) return
      onUpdate({ ...props, reusableProps: { ...reusablePropsObj, [key]: value } })
    },
    [node, props, onUpdate, reusablePropsObj]
  )

  const def = node ? getComponentDef(node.type) : null
  const bindingDataSourceNames = useMemo(() => {
    const base = [
      ...dataSources.map((d) => d.name.trim()).filter(Boolean),
      ...projectApiSourceNames,
      ...projectTableNames,
    ]
    return Array.from(new Set(
      base
        .map((name) => expandSourceAliases(name).find((alias) => /^[a-z0-9_]+$/.test(alias)) ?? name)
        .filter(Boolean)
    ))
  }, [dataSources, projectApiSourceNames, projectTableNames])
  const bindingDataSources = useMemo<DataSourceDef[]>(() => bindingDataSourceNames.map((name) => ({ id: `binding-${name}`, name })), [bindingDataSourceNames])
  const runtimeSourceLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    for (const key of Object.keys(runtimeData)) {
      const canonical = expandSourceAliases(key).find((alias) => /^[a-z0-9_]+$/.test(alias)) ?? key
      if (!lookup[canonical]) lookup[canonical] = key
    }
    return lookup
  }, [runtimeData, expandSourceAliases])
  const runtimeSourceNames = useMemo(
    () => Object.keys(runtimeSourceLookup).sort((a, b) => a.localeCompare(b)),
    [runtimeSourceLookup]
  )
  useEffect(() => {
    if (runtimeSourceNames.length === 0) {
      setInspectorSource('')
      return
    }
    if (!inspectorSource || !runtimeSourceNames.includes(inspectorSource)) {
      setInspectorSource(runtimeSourceNames[0])
    }
  }, [runtimeSourceNames, inspectorSource])

  const inspectorTokens = useMemo(() => {
    if (!inspectorSource) return [] as string[]
    const sourceValue = runtimeData[runtimeSourceLookup[inspectorSource] ?? inspectorSource]
    const out = new Set<string>()

    const walk = (value: unknown, path: string, depth: number) => {
      if (!path || depth > 4 || out.size >= 80) return

      if (Array.isArray(value)) {
        out.add(path)
        const first = value[0]
        if (first && typeof first === 'object' && !Array.isArray(first)) {
          for (const [k, v] of Object.entries(first as Record<string, unknown>).slice(0, 12)) {
            walk(v, `${path}.0.${k}`, depth + 1)
            if (out.size >= 80) break
          }
        }
        return
      }

      if (value && typeof value === 'object') {
        out.add(path)
        for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
          walk(v, `${path}.${k}`, depth + 1)
          if (out.size >= 80) break
        }
        return
      }

      out.add(path)
    }

    walk(sourceValue, `data.${inspectorSource}`, 0)
    return Array.from(out)
  }, [inspectorSource, runtimeData, runtimeSourceLookup])
  const inspectorPreferredSource = useMemo(() => {
    if (!inspectorSource) return ''
    const aliases = expandSourceAliases(inspectorSource)
    return aliases.find((alias) => /^[a-z0-9_]+$/.test(alias)) ?? inspectorSource
  }, [inspectorSource, expandSourceAliases])
  const inspectorDumpToken = useMemo(() => {
    if (!inspectorSource) return ''
    return `{{data.${inspectorSource}}}`
  }, [inspectorSource])
  const inspectorSafeDumpToken = useMemo(() => {
    if (!inspectorPreferredSource) return ''
    return `{{data.${inspectorPreferredSource}}}`
  }, [inspectorPreferredSource])
  const inspectorPayloadPreview = useMemo(() => {
    if (!inspectorSource) return ''
    const value = runtimeData[runtimeSourceLookup[inspectorSource] ?? inspectorSource]
    if (value === undefined) return ''
    try {
      const raw = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      return raw.length > 6000 ? `${raw.slice(0, 6000)}\n... (truncated)` : raw
    } catch {
      return String(value)
    }
  }, [inspectorSource, runtimeData, runtimeSourceLookup])
  const inspectorTokenValuePreview = useMemo(() => {
    const readByPath = (root: unknown, path: string): unknown => {
      const parts = path.split('.').filter(Boolean)
      let current: unknown = root
      for (const part of parts) {
        if (current == null) return undefined
        if (Array.isArray(current)) {
          const idx = Number(part)
          if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) return undefined
          current = current[idx]
          continue
        }
        if (typeof current !== 'object') return undefined
        current = (current as Record<string, unknown>)[part]
      }
      return current
    }

    const formatInline = (value: unknown): string => {
      if (value === undefined) return 'undefined'
      if (value === null) return 'null'
      if (typeof value === 'string') {
        const compact = value.length > 120 ? `${value.slice(0, 120)}...` : value
        return `"${compact}"`
      }
      if (typeof value === 'number' || typeof value === 'boolean') return String(value)
      try {
        const json = JSON.stringify(value)
        if (!json) return String(value)
        return json.length > 140 ? `${json.slice(0, 140)}...` : json
      } catch {
        return String(value)
      }
    }

    const out: Record<string, string> = {}
    for (const token of inspectorTokens) {
      const path = token.startsWith('data.') ? token.slice(5) : token
      out[token] = formatInline(readByPath(runtimeData, path))
    }
    return out
  }, [inspectorTokens, runtimeData])
  const propKeys = def ? Object.keys(def.defaultProps) : Object.keys(props)
  const uniqueKeys = Array.from(new Set([...propKeys, ...Object.keys(props), ...STYLE_PROP_KEYS, ...LAYOUT_KEYS, 'visibleWhen']))
  const isLayout = node ? ['container', 'section', 'stackV', 'stackH', 'header', 'main', 'footer', 'nav', 'aside', 'article'].includes(node.type) : false
  const layoutKeys = uniqueKeys.filter((k) => LAYOUT_KEYS.includes(k))
  const boxKeys = ['width', 'height', 'padding', 'margin'] as const
  const flexKeys = layoutKeys.filter((k) => !boxKeys.includes(k as any))
  const styleKeys = [...STYLE_PROP_KEYS]
  const eventKeys = (def?.events ?? BUILDER_EVENT_KEYS) as readonly string[]
  const availableStateDefinitions = [...globalStateDefinitions, ...stateDefinitions.filter((s) => !globalStateDefinitions.some((g) => g.name === s.name))]
  const contentKeysAll = uniqueKeys.filter((k) => k !== 'customId' && k !== 'script' && k !== '__propContract' && k !== 'visibleWhen' && k !== 'suspenseEnabled' && k !== 'suspenseVariant' && k !== 'suspenseDirection' && k !== 'suspenseLabel' && k !== 'suspenseWhen' && k !== 'suspenseSmart' && !k.startsWith('__') && !LAYOUT_KEYS.includes(k) && !STYLE_PROP_KEYS.includes(k as any) && !eventKeys.includes(k))
  const selectedReusable = node?.type === 'reusableInstance' && node?.props?.reusableId
    ? globalReusables.find((r) => r.id === node.props.reusableId)
    : null
  const reusablePropsSchemaFromContract = collectReusablePropsSchemaFromNode(selectedReusable?.root)
  const reusablePropsSchema = (selectedReusable?.propsSchema?.length ?? 0) > 0
    ? (selectedReusable?.propsSchema ?? [])
    : reusablePropsSchemaFromContract
  // Keys declared in __propContract are managed in the "Component props" editor — exclude from the generic content fields to avoid duplication
  const contractKeys = new Set(((node?.props?.__propContract as Array<{ key: string }> | undefined) ?? []).map((e) => e.key))
  const contentKeys = reusablePropsSchema.length > 0
    ? contentKeysAll.filter((k) => k !== 'reusableProps')
    : contentKeysAll.filter((k) => !contractKeys.has(k))
  // Every content, layout, and style input is bindable so we can interpolate ({{state.x}}, {{data.x}}, etc.).
  const bindableSet = (() => {
    const set = new Set((def?.bindableProps ?? []) as string[])
    set.add('visibleWhen')
    set.add('customId')
    for (const k of [...contentKeys, ...layoutKeys, ...styleKeys]) set.add(k)
    return set
  })()
  const hasDataOrStateBinding = useMemo(
    () => Object.values(props).some((v) => typeof v === 'string' && /\{\{\s*(data|state|script|prop|navProp)\./.test(v)),
    [props]
  )
  const namedScriptNames = useMemo(() => Object.keys(namedScripts).filter(Boolean), [namedScripts])
  const loadingUxEnabled = Boolean(props.suspenseEnabled)
  /* Style only: typography, colors, borders, shadow, position, etc. No layout (width/height/padding/margin live in Layout tab). */
  const styleGroups: { title: string; keys: readonly string[] }[] = [
    { title: 'Typography', keys: ['color', 'fontSize', 'fontWeight', 'fontFamily', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'textDecoration', 'textTransform', 'textOverflow', 'textShadow', 'textIndent', 'whiteSpace', 'wordBreak', 'verticalAlign', 'lineClamp', 'listStyleType', 'listStylePosition'] },
    { title: 'Background', keys: ['backgroundColor', 'background', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundBlendMode', 'opacity'] },
    { title: 'Border', keys: ['border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft', 'borderWidth', 'borderStyle', 'borderColor', 'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'] },
    { title: 'Shadow & outline', keys: ['boxShadow', 'outline', 'outlineOffset'] },
    { title: 'Animation & FX', keys: ['animation', 'animationDuration', 'animationTimingFunction', 'animationDelay', 'animationIterationCount', 'animationDirection', 'animationFillMode', 'transition', 'transform', 'willChange'] },
    { title: 'Filters & Blend', keys: ['filter', 'backdropFilter', 'mixBlendMode'] },
    { title: 'Position', keys: ['position', 'top', 'right', 'bottom', 'left', 'zIndex'] },
    { title: 'Other', keys: ['cursor', 'pointerEvents', 'userSelect', 'aspectRatio', 'overflow', 'overflowX', 'overflowY', 'objectFit', 'objectPosition', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'] },
  ]

  const monacoLoading = (
    <div className="w-full h-full flex items-center justify-center bg-white dark:bg-[#0d1117]">
      <span className="w-4 h-4 border-2 border-gray-300 dark:border-[#30363d] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const renderExpressionEditor = (
    value: string,
    onChange: (next: string) => void,
    placeholder?: string,
    className = 'w-full'
  ) => {
    const expressionLike = /\{\{[^}]*\}\}|\b(state|data|prop|script|navProp)\.|\?[^:]*:|&&|\|\||===|!==|>=|<=|==|!=/.test(value)
    if (!expressionLike) {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${className} px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono`}
        />
      )
    }
    if (!monacoReady) {
      return (
        <div className={`${className} h-[60px] border border-gray-300 dark:border-[#30363d] rounded overflow-hidden bg-white dark:bg-[#0d1117]`}>
          {monacoLoading}
        </div>
      )
    }
    return (
      <div className={`${className} border border-gray-300 dark:border-[#30363d] rounded overflow-hidden bg-white dark:bg-[#0d1117]`} title={placeholder}>
        <MonacoEditor
          language="javascript"
          value={value}
          onChange={(next) => onChange(next ?? '')}
          height="60px"
          loading={monacoLoading}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            scrollBeyondLastLine: false,
            wordWrap: 'off',
            fontSize: 12,
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>
    )
  }

  const renderLayoutField = (key: string) => {
    const val = props[key]
    const isNumber = typeof def?.defaultProps[key] === 'number'
    const options = def?.options?.[key]
    const label = PROP_LABELS[key] ?? key

    if (key === 'customId') {
      const rawVal = String(props.customId ?? '')
      const isBound = rawVal.startsWith('{{') && rawVal.endsWith('}}')
      return (
        <div key={key} className="relative">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
            <button type="button" onClick={() => setBindingFor(bindingFor === key ? null : key)} className={`ml-1.5 p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`} title="Bind to state, data, or expression"><Zap className="w-3.5 h-3.5" /></button>
          </label>
          {bindingFor === key && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
              <select className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white" onChange={(e) => { const v = e.target.value; if (v.startsWith('state:')) setProp(key, `{{state.${v.slice(6)}}}`); else if (v.startsWith('data:')) setProp(key, `{{data.${v.slice(5)}}}`); else if (v.startsWith('script:')) setProp(key, `{{script.${v.slice(7)}}}`); else if (v.startsWith('prop:')) setProp(key, `{{prop.${v.slice(5)}}}`); else if (v.startsWith('asset:')) setProp(key, v.slice(6)); else if (v === 'expr') setProp(key, '{{ }}'); setBindingFor(null) }}>
                <option value="">Select…</option>
                {parentPropSchema.length > 0 && parentPropSchema.map((p) => <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>)}
                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>)}
                {bindingDataSourceNames.map((name) => <option key={name} value={`data:${name}`}>Data: {name}</option>)}
                {Object.keys(namedScripts).filter(Boolean).map((name) => <option key={name} value={`script:${name}`}>Script: {name}</option>)}
                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                <option value="expr">Expression</option>
              </select>
              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
            </div>
          )}
          {renderExpressionEditor(rawVal, (next) => setProp('customId', next.trim() || undefined), node?.id ?? 'node-id')}
        </div>
      )
    }
    const rawVal = typeof val === 'string' || typeof val === 'number' ? String(val) : ''
    const isBinding = rawVal.startsWith('{{') && rawVal.endsWith('}}')
    // Quick-pick pill fields for layout keys that have well-known discrete values but no component-specific options
    if (key in STYLE_QUICK_PICKS && !options?.length) {
      const picks = STYLE_QUICK_PICKS[key]
      const isBound = isBinding
      return (
        <div key={key} className="relative">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
            <button type="button" onClick={() => setBindingFor(bindingFor === key ? null : key)} className={`ml-1.5 p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`} title="Bind to state, data, or expression"><Zap className="w-3.5 h-3.5" /></button>
          </label>
          {bindingFor === key && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
              <select className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white" onChange={(e) => { const v = e.target.value; if (v.startsWith('state:')) setProp(key, `{{state.${v.slice(6)}}}`); else if (v.startsWith('data:')) setProp(key, `{{data.${v.slice(5)}}}`); else if (v.startsWith('script:')) setProp(key, `{{script.${v.slice(7)}}}`); else if (v.startsWith('prop:')) setProp(key, `{{prop.${v.slice(5)}}}`); else if (v.startsWith('asset:')) setProp(key, v.slice(6)); else if (v === 'expr') setProp(key, '{{ }}'); setBindingFor(null) }}>
                <option value="">Select…</option>
                {parentPropSchema.length > 0 && parentPropSchema.map((p) => <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>)}
                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>)}
                {bindingDataSourceNames.map((name) => <option key={name} value={`data:${name}`}>Data: {name}</option>)}
                {Object.keys(namedScripts).filter(Boolean).map((name) => <option key={name} value={`script:${name}`}>Script: {name}</option>)}
                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                <option value="expr">Expression</option>
              </select>
              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
            </div>
          )}
          <div className="mb-1.5">
            {renderExpressionEditor(rawVal, (next) => setProp(key, next), `e.g. ${picks[0]}${picks[1] ? `, ${picks[1]}` : ''}, {{state.x}}`)}
          </div>
          <div className="flex flex-wrap gap-1">
            {picks.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProp(key, p)}
                className={`px-1.5 py-0.5 text-[10px] border font-medium transition-colors ${
                  rawVal === p
                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                    : 'border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
            {rawVal && (
              <button type="button" onClick={() => setProp(key, '')} className="px-1.5 py-0.5 text-[10px] border border-red-300 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                Clear
              </button>
            )}
          </div>
        </div>
      )
    }
    if (options?.length && !(bindableSet.has(key) && isBinding)) {
      return (
        <div key={key} className="relative">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
            <button type="button" onClick={() => setBindingFor(bindingFor === key ? null : key)} className={`ml-1.5 p-0.5 rounded ${rawVal.startsWith('{{') ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`} title="Bind to state, data, or expression"><Zap className="w-3.5 h-3.5" /></button>
          </label>
          {bindingFor === key && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
              <select className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white" onChange={(e) => { const v = e.target.value; if (v.startsWith('state:')) setProp(key, `{{state.${v.slice(6)}}}`); else if (v.startsWith('data:')) setProp(key, `{{data.${v.slice(5)}}}`); else if (v.startsWith('script:')) setProp(key, `{{script.${v.slice(7)}}}`); else if (v.startsWith('prop:')) setProp(key, `{{prop.${v.slice(5)}}}`); else if (v.startsWith('asset:')) setProp(key, v.slice(6)); else if (v === 'expr') setProp(key, '{{ }}'); setBindingFor(null) }}>
                <option value="">Select…</option>
                {parentPropSchema.length > 0 && parentPropSchema.map((p) => <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>)}
                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>)}
                {bindingDataSourceNames.map((name) => <option key={name} value={`data:${name}`}>Data: {name}</option>)}
                {Object.keys(namedScripts).filter(Boolean).map((name) => <option key={name} value={`script:${name}`}>Script: {name}</option>)}
                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                <option value="expr">Expression</option>
              </select>
              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
            </div>
          )}
          <select value={String(val ?? options[0].value)} onChange={(e) => setProp(key, e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white">
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="text-[10px] text-gray-500 mt-0.5">Or use bolt to bind e.g. {`{{state.x}}`}</p>
        </div>
      )
    }
    if (options?.length && bindableSet.has(key) && isBinding) {
      return (
        <div key={key} className="relative">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
            <button type="button" onClick={() => setBindingFor(bindingFor === key ? null : key)} className="ml-1.5 p-0.5 rounded text-amber-500" title="Bind to state, data, or expression"><Zap className="w-3.5 h-3.5" /></button>
          </label>
          {bindingFor === key && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
              <select className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white" onChange={(e) => { const v = e.target.value; if (v.startsWith('state:')) setProp(key, `{{state.${v.slice(6)}}}`); else if (v.startsWith('data:')) setProp(key, `{{data.${v.slice(5)}}}`); else if (v.startsWith('script:')) setProp(key, `{{script.${v.slice(7)}}}`); else if (v.startsWith('prop:')) setProp(key, `{{prop.${v.slice(5)}}}`); else if (v.startsWith('asset:')) setProp(key, v.slice(6)); else if (v === 'expr') setProp(key, '{{ }}'); setBindingFor(null) }}>
                <option value="">Select…</option>
                {parentPropSchema.length > 0 && parentPropSchema.map((p) => <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>)}
                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>)}
                {bindingDataSourceNames.map((name) => <option key={name} value={`data:${name}`}>Data: {name}</option>)}
                {Object.keys(namedScripts).filter(Boolean).map((name) => <option key={name} value={`script:${name}`}>Script: {name}</option>)}
                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                <option value="expr">Expression</option>
              </select>
              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
            </div>
          )}
          {renderExpressionEditor(rawVal, (next) => setProp(key, next), 'e.g. {{state.x}}')}
        </div>
      )
    }
    const isBindable = bindableSet.has(key)
    const isBound = isBindable && rawVal.startsWith('{{') && rawVal.endsWith('}}')
    if (isBindable) {
      return (
        <div key={key} className="relative">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
            <button
              type="button"
              onClick={() => setBindingFor(bindingFor === key ? null : key)}
              className={`ml-1.5 p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`}
              title="Bind to state, data, or expression"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
          </label>
          {bindingFor === key && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
              <select
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                onChange={(e) => {
                  const v = e.target.value
                  if (v.startsWith('state:')) setProp(key, `{{state.${v.slice(6)}}}`)
                  else if (v.startsWith('data:')) setProp(key, `{{data.${v.slice(5)}}}`)
                  else if (v.startsWith('script:')) setProp(key, `{{script.${v.slice(7)}}}`)
                  else if (v.startsWith('prop:')) setProp(key, `{{prop.${v.slice(5)}}}`)
                  else if (v.startsWith('asset:')) setProp(key, v.slice(6))
                  else if (v === 'expr') setProp(key, '{{ }}')
                  setBindingFor(null)
                }}
              >
                <option value="">Select…</option>
                {parentPropSchema.length > 0 && parentPropSchema.map((p) => (
                  <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>
                ))}
                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => (
                  <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>
                ))}
                {bindingDataSourceNames.map((name) => (
                  <option key={name} value={`data:${name}`}>Data: {name}</option>
                ))}
                {Object.keys(namedScripts).filter(Boolean).map((name) => (
                  <option key={name} value={`script:${name}`}>Script: {name}</option>
                ))}
                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                <option value="expr">Expression</option>
              </select>
              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
            </div>
          )}
          {renderExpressionEditor(rawVal, (next) => setProp(key, next), key === 'width' || key === 'height' ? 'e.g. 100%, 200px, {{state.w}}' : 'e.g. {{state.x}}')}
        </div>
      )
    }
    return (
      <div key={key}>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
        <input
          type={isNumber ? 'number' : 'text'}
          value={rawVal}
          onChange={(e) => setProp(key, isNumber ? Number(e.target.value) : e.target.value)}
          placeholder={key === 'width' || key === 'height' ? 'e.g. 100% or 200px' : ''}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
        />
      </div>
    )
  }

  const renderStyleField = (key: string): React.ReactNode => {
    const val = (props as Record<string, unknown>)[key]
    const label = PROP_LABELS[key] ?? key
    const strVal = val != null ? String(val) : ''

    if (key === 'fontFamily') {
      const isBound = strVal.startsWith('{{') && strVal.endsWith('}}')
      const injectFont = (fam: string) => {
        if (fam && fam !== 'inherit' && fam !== '' && !fam.startsWith('{{')) {
          const encoded = fam.replace(/\s+/g, '+')
          const id = `bunny-font-${encoded}`
          if (!document.getElementById(id)) {
            const link = document.createElement('link')
            link.id = id
            link.rel = 'stylesheet'
            link.href = `https://fonts.bunny.net/css?family=${encoded}:400,700`
            document.head.appendChild(link)
          }
        }
      }
      return (
        <div key={key} className="relative">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
            <button
              type="button"
              onClick={() => setBindingFor(bindingFor === key ? null : key)}
              className={`ml-1.5 p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`}
              title="Bind to state, data, or expression"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
          </label>
          {bindingFor === key && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
              <select className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white" onChange={(e) => { const v = e.target.value; if (v.startsWith('state:')) setProp(key, `{{state.${v.slice(6)}}}`); else if (v.startsWith('data:')) setProp(key, `{{data.${v.slice(5)}}}`); else if (v.startsWith('script:')) setProp(key, `{{script.${v.slice(7)}}}`); else if (v.startsWith('prop:')) setProp(key, `{{prop.${v.slice(5)}}}`); else if (v.startsWith('asset:')) setProp(key, v.slice(6)); else if (v === 'expr') setProp(key, '{{ }}'); setBindingFor(null) }}>
                <option value="">Select…</option>
                {parentPropSchema.length > 0 && parentPropSchema.map((p) => <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>)}
                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>)}
                {bindingDataSourceNames.map((name) => <option key={name} value={`data:${name}`}>Data: {name}</option>)}
                {Object.keys(namedScripts).filter(Boolean).map((name) => <option key={name} value={`script:${name}`}>Script: {name}</option>)}
                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                <option value="expr">Expression</option>
              </select>
              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
            </div>
          )}
          <div className="flex gap-1">
            {renderExpressionEditor(strVal, (next) => { setProp(key, next); injectFont(next) }, "e.g. Inter, 'Roboto Mono', {{state.font}}", 'flex-1')}
            <button
              type="button"
              onClick={() => setFontPickerOpen(true)}
              className="px-2 py-1.5 text-xs border border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white shrink-0 font-medium"
              title="Browse all fonts"
            >
              Browse
            </button>
          </div>
        </div>
      )
    }
    // --- Quick-pick pill fields (typography, flex, etc.) – also accept free text / interpolation ---
    if (key in STYLE_QUICK_PICKS) {
      const picks = STYLE_QUICK_PICKS[key]
      const isBound = strVal.startsWith('{{') && strVal.endsWith('}}')
      return (
        <div key={key} className="relative">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
            <button
              type="button"
              onClick={() => setBindingFor(bindingFor === key ? null : key)}
              className={`ml-1.5 p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`}
              title="Bind to state, data, or expression"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
          </label>
          {bindingFor === key && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
              <select className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white" onChange={(e) => { const v = e.target.value; if (v.startsWith('state:')) setProp(key, `{{state.${v.slice(6)}}}`); else if (v.startsWith('data:')) setProp(key, `{{data.${v.slice(5)}}}`); else if (v.startsWith('script:')) setProp(key, `{{script.${v.slice(7)}}}`); else if (v.startsWith('prop:')) setProp(key, `{{prop.${v.slice(5)}}}`); else if (v.startsWith('asset:')) setProp(key, v.slice(6)); else if (v === 'expr') setProp(key, '{{ }}'); setBindingFor(null) }}>
                <option value="">Select…</option>
                {parentPropSchema.length > 0 && parentPropSchema.map((p) => <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>)}
                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>)}
                {bindingDataSourceNames.map((name) => <option key={name} value={`data:${name}`}>Data: {name}</option>)}
                {Object.keys(namedScripts).filter(Boolean).map((name) => <option key={name} value={`script:${name}`}>Script: {name}</option>)}
                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                <option value="expr">Expression</option>
              </select>
              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
            </div>
          )}
          <div className="mb-1.5">
            {renderExpressionEditor(strVal, (next) => setProp(key, next), `e.g. ${picks[0]}${picks[1] ? `, ${picks[1]}` : ''}, {{state.x}}`)}
          </div>
          <div className="flex flex-wrap gap-1">
            {picks.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProp(key, p)}
                className={`px-1.5 py-0.5 text-[10px] border font-medium transition-colors ${
                  strVal === p
                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                    : 'border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
            {strVal && (
              <button
                type="button"
                onClick={() => setProp(key, '')}
                className="px-1.5 py-0.5 text-[10px] border border-red-300 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )
    }
    // --- Select-based style fields ---
    const selectFields: Record<string, { options: string[]; defaultVal?: string }> = {
      borderStyle: { options: BORDER_STYLE_OPTIONS, defaultVal: 'solid' },
      position: { options: POSITION_OPTIONS, defaultVal: 'static' },
      overflow: { options: OVERFLOW_OPTIONS, defaultVal: 'visible' },
      overflowX: { options: OVERFLOW_OPTIONS, defaultVal: 'visible' },
      overflowY: { options: OVERFLOW_OPTIONS, defaultVal: 'visible' },
      objectFit: { options: OBJECT_FIT_OPTIONS, defaultVal: 'fill' },
      cursor: { options: CURSOR_OPTIONS, defaultVal: 'auto' },
      backgroundSize: { options: BG_SIZE_OPTIONS },
      backgroundRepeat: { options: BG_REPEAT_OPTIONS, defaultVal: 'repeat' },
      backgroundBlendMode: { options: BLEND_MODE_OPTIONS, defaultVal: 'normal' },
      mixBlendMode: { options: BLEND_MODE_OPTIONS, defaultVal: 'normal' },
      animationTimingFunction: { options: ANIMATION_TIMING_OPTIONS, defaultVal: 'ease' },
      animationDirection: { options: ANIMATION_DIRECTION_OPTIONS, defaultVal: 'normal' },
      animationFillMode: { options: ANIMATION_FILL_MODE_OPTIONS, defaultVal: 'none' },
      animationIterationCount: { options: ANIMATION_ITERATION_OPTIONS, defaultVal: '1' },
      pointerEvents: { options: POINTER_EVENTS_OPTIONS, defaultVal: 'auto' },
      userSelect: { options: USER_SELECT_OPTIONS, defaultVal: 'auto' },
    }
    if (key in selectFields) {
      const sf = selectFields[key]
      const isBound = strVal.startsWith('{{') && strVal.endsWith('}}')
      return (
        <div key={key} className="relative">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
            <button
              type="button"
              onClick={() => setBindingFor(bindingFor === key ? null : key)}
              className={`ml-1.5 p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`}
              title="Bind to state, data, or expression"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
          </label>
          {bindingFor === key && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
              <select className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white" onChange={(e) => { const v = e.target.value; if (v.startsWith('state:')) setProp(key, `{{state.${v.slice(6)}}}`); else if (v.startsWith('data:')) setProp(key, `{{data.${v.slice(5)}}}`); else if (v.startsWith('script:')) setProp(key, `{{script.${v.slice(7)}}}`); else if (v.startsWith('prop:')) setProp(key, `{{prop.${v.slice(5)}}}`); else if (v.startsWith('asset:')) setProp(key, v.slice(6)); else if (v === 'expr') setProp(key, '{{ }}'); setBindingFor(null) }}>
                <option value="">Select…</option>
                {parentPropSchema.length > 0 && parentPropSchema.map((p) => <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>)}
                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>)}
                {bindingDataSourceNames.map((name) => <option key={name} value={`data:${name}`}>Data: {name}</option>)}
                {Object.keys(namedScripts).filter(Boolean).map((name) => <option key={name} value={`script:${name}`}>Script: {name}</option>)}
                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                <option value="expr">Expression</option>
              </select>
              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
            </div>
          )}
          {isBound ? (
            renderExpressionEditor(strVal, (next) => setProp(key, next), 'e.g. {{state.x}}')
          ) : (
            <select
              value={strVal || sf.defaultVal || ''}
              onChange={(e) => setProp(key, e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
            >
              {sf.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          )}
        </div>
      )
    }
    // --- Animation preset picker ---
    if (key === 'animation') {
      return (
        <div key={key}>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
          <div className="mb-1.5">
            {renderExpressionEditor(strVal, (next) => setProp(key, next), 'e.g. fadeIn 0.5s ease both')}
          </div>
          <div className="flex flex-wrap gap-1">
            {ANIMATION_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setProp(key, p.value)}
                className={`px-1.5 py-0.5 text-[10px] border font-medium transition-colors ${
                  strVal === p.value
                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                    : 'border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white'
                }`}
                title={p.value}
              >
                {p.label}
              </button>
            ))}
            {strVal && (
              <button
                type="button"
                onClick={() => setProp(key, '')}
                className="px-1.5 py-0.5 text-[10px] border border-red-300 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )
    }
    // --- Background image / gradient ---
    if (key === 'backgroundImage' || key === 'background' || key === 'gradient') {
      return (
        <div key={key}>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
          <div className="flex gap-1 mb-1.5">
            {renderExpressionEditor(strVal, (next) => setProp(key, next), 'linear-gradient(135deg, #f00, #00f) or url(…)', 'flex-1')}
            <button
              type="button"
              onClick={() => setGradientBuilderFor(key)}
              className="px-2 py-1.5 text-xs border border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white shrink-0 font-medium"
              title="Open gradient builder"
            >
              Build
            </button>
          </div>
          {/* Live preview swatch */}
          {strVal && (
            <div
              className="w-full h-8 border border-gray-200 dark:border-[#30363d] mb-1.5"
              style={{ background: strVal }}
            />
          )}
          <div className="flex flex-wrap gap-1">
            {GRADIENT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setProp(key, p.value)}
                className="relative overflow-hidden px-2 py-1 text-[10px] border border-gray-200 dark:border-[#30363d] font-medium text-gray-700 dark:text-gray-300 hover:border-black dark:hover:border-white"
                title={p.value}
              >
                <span
                  className="absolute inset-0 opacity-30"
                  style={{ background: p.value }}
                />
                <span className="relative">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )
    }
    const isColor = String(key ?? '').toLowerCase().includes('color') || key === 'backgroundColor'
    const isBindableStyle = bindableSet.has(key)
    const isBound = isBindableStyle && strVal.startsWith('{{') && strVal.endsWith('}}')
    if (isBindableStyle) {
      return (
        <div key={key} className="relative">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
            <button
              type="button"
              onClick={() => setBindingFor(bindingFor === key ? null : key)}
              className={`ml-1.5 p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`}
              title="Bind to state, data, or expression"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
          </label>
          {bindingFor === key && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
              <select
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                onChange={(e) => {
                  const v = e.target.value
                  if (v.startsWith('state:')) setProp(key, `{{state.${v.slice(6)}}}`)
                  else if (v.startsWith('data:')) setProp(key, `{{data.${v.slice(5)}}}`)
                  else if (v.startsWith('script:')) setProp(key, `{{script.${v.slice(7)}}}`)
                  else if (v.startsWith('prop:')) setProp(key, `{{prop.${v.slice(5)}}}`)
                  else if (v.startsWith('asset:')) setProp(key, v.slice(6))
                  else if (v === 'expr') setProp(key, '{{ }}')
                  setBindingFor(null)
                }}
              >
                <option value="">Select…</option>
                {parentPropSchema.length > 0 && parentPropSchema.map((p) => (
                  <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>
                ))}
                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => (
                  <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>
                ))}
                {bindingDataSourceNames.map((name) => (
                  <option key={name} value={`data:${name}`}>Data: {name}</option>
                ))}
                {Object.keys(namedScripts).filter(Boolean).map((name) => (
                  <option key={name} value={`script:${name}`}>Script: {name}</option>
                ))}
                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                <option value="expr">Expression</option>
              </select>
              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
            </div>
          )}
          <div className="flex gap-1">
            {isColor && (
              <input
                type="color"
                value={strVal.match(/^#[0-9A-Fa-f]{6}$/) ? strVal : '#000000'}
                onChange={(e) => setProp(key, e.target.value)}
                className="w-8 h-8 rounded border border-gray-300 dark:border-[#30363d] cursor-pointer"
              />
            )}
            {renderExpressionEditor(strVal, (next) => setProp(key, next), isColor ? '#hex or {{state.color}}' : 'e.g. 14px, {{state.size}}', 'flex-1')}
          </div>
        </div>
      )
    }
    return (
      <div key={key}>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
        <div className="flex gap-1">
          {isColor && (
            <input
              type="color"
              value={strVal.match(/^#[0-9A-Fa-f]{6}$/) ? strVal : '#000000'}
              onChange={(e) => setProp(key, e.target.value)}
              className="w-8 h-8 rounded border border-gray-300 dark:border-[#30363d] cursor-pointer"
            />
          )}
          <input
            type={isColor ? 'text' : 'text'}
            value={strVal}
            onChange={(e) => setProp(key, e.target.value)}
            placeholder={isColor ? '#hex or name' : 'e.g. 14px, 1rem'}
            className={`flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white ${isColor ? 'font-mono' : ''}`}
          />
        </div>
      </div>
    )
  }

  const renderContentField = (key: string) => {
    const val = props[key]
    const isBindable = bindableSet.has(key)
    const isBool = typeof def?.defaultProps[key] === 'boolean'
    const isNumber = typeof def?.defaultProps[key] === 'number'
    const options = def?.options?.[key]
    const label = PROP_LABELS[key] ?? key

    if (key === 'reusableProps') {
      const rawJson = (() => {
        try { return JSON.stringify((val as Record<string, unknown>) ?? {}, null, 2) } catch { return '{}' }
      })()
      return (
        <div key={key}>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
          <div className="border border-gray-300 dark:border-[#30363d] rounded overflow-hidden bg-white dark:bg-[#0d1117]">
            <MonacoEditor
              language="json"
              value={rawJson}
              onChange={(value) => {
                try {
                  const parsed = JSON.parse(value ?? '{}')
                  if (parsed && typeof parsed === 'object') setProp(key, parsed)
                } catch {
                  // Keep raw input editable; parser applies when JSON is valid.
                }
              }}
              height="132px"
              loading={monacoLoading}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                fontSize: 12,
                padding: { top: 8, bottom: 8 },
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Use values or bindings like <code>{'{{state.userName}}'}</code>. Reusable internals can read <code>{'{{prop.userName}}'}</code>.</p>
        </div>
      )
    }

    const rawVal = typeof val === 'string' ? val : typeof val === 'number' ? String(val) : ''
    const isBound = rawVal.startsWith('{{') && rawVal.endsWith('}}')

    // ── Hamburger color fields — text input + colour swatch picker ───────────
    if (key === 'hamburgerBg' || key === 'hamburgerColor') {
      const isHexLike = /^#[0-9A-Fa-f]{3,8}$/.test(rawVal)
      const swatchColor = isHexLike ? rawVal : key === 'hamburgerColor' ? '#000000' : '#ffffff'
      return (
        <div key={key}>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
          <div className="flex gap-1">
            <input
              type="color"
              value={swatchColor}
              onChange={(e) => setProp(key, e.target.value)}
              className="w-8 h-8 border border-gray-300 dark:border-[#30363d] cursor-pointer shrink-0 p-0"
              title="Pick colour"
            />
            <input
              type="text"
              value={rawVal}
              onChange={(e) => setProp(key, e.target.value)}
              placeholder={key === 'hamburgerBg' ? 'rgba(255,255,255,0.9) or #hex' : '#hex or rgba(…)'}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono"
            />
          </div>
        </div>
      )
    }

    // ── Hamburger icon — preview + Browse button (same as icon field) ────────
    if (key === 'hamburgerIcon') {
      const parts = rawVal.split(':')
      const previewUrl = parts.length === 2 && parts[0] && parts[1]
        ? `https://api.iconify.design/${parts[0]}/${parts[1]}.svg?color=%234b5563`
        : null
      return (
        <div key={key}>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
          <div className="flex gap-1">
            {previewUrl && (
              <img src={previewUrl} alt="" width={28} height={28} className="shrink-0 border border-gray-200 dark:border-[#30363d] p-0.5 bg-gray-50 dark:bg-[#0d1117] dark:invert" />
            )}
            <input
              type="text"
              value={rawVal}
              onChange={(e) => setProp(key, e.target.value)}
              placeholder="e.g. mdi:menu, lucide:sidebar — leave blank for 3-bar"
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono"
            />
            <button
              type="button"
              onClick={() => setIconPickerFor(key)}
              className="px-2 py-1.5 text-xs border border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white shrink-0 font-medium"
              title="Browse icons"
            >
              Browse
            </button>
            {rawVal && (
              <button
                type="button"
                onClick={() => setProp(key, '')}
                className="px-2 py-1.5 text-xs border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                title="Reset to 3-bar"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Leave blank to use the default 3-bar lines.</p>
        </div>
      )
    }

    if (isBindable && !isBool && (!options?.length || isBound)) {
      return (
        <div key={key} className="relative">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
            <button
              type="button"
              onClick={() => setBindingFor(bindingFor === key ? null : key)}
              className={`ml-1.5 p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`}
              title="Connect to state, data, or expression"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
          </label>
          {bindingFor === key && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
              <select
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                onChange={(e) => {
                  const v = e.target.value
                  if (v.startsWith('state:')) setProp(key, `{{state.${v.slice(6)}}}`)
                  else if (v.startsWith('data:')) setProp(key, `{{data.${v.slice(5)}}}`)
                  else if (v.startsWith('script:')) setProp(key, `{{script.${v.slice(7)}}}`)
                  else if (v.startsWith('prop:')) setProp(key, `{{prop.${v.slice(5)}}}`)
                  else if (v.startsWith('asset:')) setProp(key, v.slice(6))
                  else if (v === 'expr') setProp(key, '{{ }}')
                  setBindingFor(null)
                }}
              >
                <option value="">Select…</option>
                {parentPropSchema.length > 0 && (
                  <>
                    {parentPropSchema.map((p) => (
                      <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>
                    ))}
                  </>
                )}
                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => (
                  <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>
                ))}
                {bindingDataSourceNames.map((name) => (
                  <option key={name} value={`data:${name}`}>Data: {name}</option>
                ))}
                {Object.keys(namedScripts).filter(Boolean).map((name) => (
                  <option key={name} value={`script:${name}`}>Script: {name}</option>
                ))}
                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                <option value="expr">Expression (edit below)</option>
              </select>
              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
            </div>
          )}
          <div className="flex gap-1">
            {key === 'icon' && rawVal && (() => {
              const parts = rawVal.split(':')
              const previewUrl = parts.length === 2
                ? `https://api.iconify.design/${parts[0]}/${parts[1]}.svg?color=%234b5563`
                : null
              return previewUrl ? (
                <img src={previewUrl} alt="" width={28} height={28} className="shrink-0 border border-gray-200 dark:border-[#30363d] rounded p-0.5 bg-gray-50 dark:bg-[#0d1117] dark:invert" />
              ) : null
            })()}
            {renderExpressionEditor(rawVal, (next) => setProp(key, next), key === 'icon' ? 'e.g. mdi:home, lucide:star' : 'e.g. {{prop.x}}, {{state.count}}', 'flex-1')}
            {key === 'icon' && (
              <button
                type="button"
                onClick={() => setIconPickerFor(key)}
                className="px-2 py-1.5 text-xs border border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 shrink-0 font-medium"
                title="Browse all icons"
              >
                Browse
              </button>
            )}
            {((key === 'url' && node?.type === 'image') || (key === 'src' && (node?.type === 'video' || node?.type === 'avatar' || node?.type === 'embed')) || key === 'poster' || key === 'backgroundImage') && projectId && (
              <button
                type="button"
                onClick={() => setAssetPickerFor({ propKey: key, filterType: key === 'poster' || (key === 'url' && node?.type === 'image') || (key === 'src' && node?.type === 'avatar') || key === 'backgroundImage' ? 'image' : key === 'src' && node?.type === 'video' ? 'video' : 'all' })}
                className="px-2 py-1.5 text-xs border border-emerald-300 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/30 shrink-0 font-medium"
                title="Browse project assets"
              >
                Browse
              </button>
            )}
            {key === 'url' && node?.type === 'link' && screenTargets.length > 0 && (
              <select
                className="px-1 py-1.5 text-xs border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-[#0d1117] text-emerald-700 dark:text-emerald-400 rounded shrink-0 max-w-[90px]"
                value=""
                title="Navigate to a screen"
                onChange={(e) => { if (e.target.value) setProp('url', `screen:${e.target.value}`) }}
              >
                <option value="">Screen…</option>
                {screenTargets.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setPropExpressionKey(key)}
              className="px-2 py-1.5 text-xs border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d] shrink-0"
            >
              Build
            </button>
          </div>
        </div>
      )
    }
    if (options?.length) {
      return (
        <div key={key} className="relative">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
            {isBindable && (
              <button type="button" onClick={() => setBindingFor(bindingFor === key ? null : key)} className={`ml-1.5 p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`} title="Bind to state, data, or expression"><Zap className="w-3.5 h-3.5" /></button>
            )}
          </label>
          {isBindable && bindingFor === key && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
              <select className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white" onChange={(e) => { const v = e.target.value; if (v.startsWith('state:')) setProp(key, `{{state.${v.slice(6)}}}`); else if (v.startsWith('data:')) setProp(key, `{{data.${v.slice(5)}}}`); else if (v.startsWith('script:')) setProp(key, `{{script.${v.slice(7)}}}`); else if (v.startsWith('prop:')) setProp(key, `{{prop.${v.slice(5)}}}`); else if (v.startsWith('asset:')) setProp(key, v.slice(6)); else if (v === 'expr') setProp(key, '{{ }}'); setBindingFor(null) }}>
                <option value="">Select…</option>
                {parentPropSchema.length > 0 && parentPropSchema.map((p) => <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>)}
                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>)}
                {bindingDataSourceNames.map((name) => <option key={name} value={`data:${name}`}>Data: {name}</option>)}
                {Object.keys(namedScripts).filter(Boolean).map((name) => <option key={name} value={`script:${name}`}>Script: {name}</option>)}
                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                <option value="expr">Expression</option>
              </select>
              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
            </div>
          )}
          {isBound ? (
            renderExpressionEditor(rawVal, (next) => setProp(key, next), 'e.g. {{state.x}}')
          ) : (
            <select value={String(val ?? options[0].value)} onChange={(e) => setProp(key, e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white">
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {isBindable && <p className="text-[10px] text-gray-500 mt-0.5">Or use bolt to bind e.g. {`{{state.x}}`}</p>}
        </div>
      )
    }
    if (isBool) {
      return (
        <div key={key}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!val}
              onChange={(e) => setProp(key, e.target.checked)}
              className="rounded border-gray-300 dark:border-[#30363d]"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
          </label>
        </div>
      )
    }
    if (key === 'rows' && node?.type === 'table') {
      return (
        <div key={key}>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
          <div className="border border-gray-300 dark:border-[#30363d] rounded overflow-hidden bg-white dark:bg-[#0d1117]">
            <MonacoEditor
              language="json"
              value={String(val ?? '')}
              onChange={(value) => setProp(key, value ?? '')}
              height="100px"
              loading={monacoLoading}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                fontSize: 12,
                padding: { top: 8, bottom: 8 },
              }}
            />
          </div>
        </div>
      )
    }
    return (
      <div key={key}>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
        <input
          type={isNumber ? 'number' : 'text'}
          value={typeof val === 'string' || typeof val === 'number' ? String(val) : ''}
          onChange={(e) => setProp(key, isNumber ? Number(e.target.value) : e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
        />
      </div>
    )
  }


  return (
    <div className="w-full h-full min-h-0 min-w-0 border-l border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] flex flex-col overflow-hidden">
      <div className="shrink-0 border-b border-gray-200 dark:border-[#30363d]">
        {/* ── App Properties ────────────────────────────────── */}
        <div className="px-3 pt-2.5 pb-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5 select-none">App</p>
          <div className="flex gap-1">
            {APP_TABS.map((t) => {
              const isActive = activeTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    isActive
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#21262d]'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Component Properties ──────────────────────────── */}
        <div className="px-3 pb-2.5 pt-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-amber-500 dark:text-amber-400 select-none">
              {node ? (def?.label ?? node.type) : 'Component'}
            </p>
            {!node && <span className="text-[9px] text-gray-300 dark:text-gray-600 italic">— select a component</span>}
          </div>
          <div className="flex gap-1">
            {COMPONENT_TABS.map((t) => {
              const isActive = activeTab === t.id
              const disabled = !node
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { if (!disabled) setActiveTab(t.id) }}
                  disabled={disabled}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    disabled
                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                      : isActive
                        ? 'bg-amber-500 dark:bg-amber-500 text-white'
                        : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div ref={bodyScrollRef} className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
        {activeTab === 'theme' && onThemeChange && (() => {
          const ThemeColorRow = ({ label, themeKey, placeholder }: { label: string; themeKey: keyof ScreenTheme; placeholder: string }) => {
            const val = (theme[themeKey] as string) ?? ''
            const isHex = /^#[0-9A-Fa-f]{3,8}$/.test(val)
            return (
              <div className="flex items-center gap-2">
                <label className="w-28 shrink-0 text-xs text-gray-500 dark:text-gray-400">{label}</label>
                <input type="color" value={isHex ? val : '#000000'}
                  onChange={(e) => onThemeChange({ [themeKey]: e.target.value } as Partial<ScreenTheme>)}
                  className="w-7 h-7 border border-gray-300 dark:border-[#30363d] cursor-pointer shrink-0 p-0" />
                <input type="text" value={val}
                  onChange={(e) => onThemeChange({ [themeKey]: e.target.value || undefined } as Partial<ScreenTheme>)}
                  placeholder={placeholder}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono" />
              </div>
            )
          }
          const GlobalThemeColorRow = ({ label, themeKey, placeholder }: { label: string; themeKey: keyof ScreenTheme; placeholder: string }) => {
            const val = ((globalTheme as ScreenTheme)[themeKey] as string) ?? ''
            const isHex = /^#[0-9A-Fa-f]{3,8}$/.test(val)
            return (
              <div className="flex items-center gap-2">
                <label className="w-28 shrink-0 text-xs text-gray-500 dark:text-gray-400">{label}</label>
                <input type="color" value={isHex ? val : '#000000'}
                  onChange={(e) => onGlobalThemeChange?.({ [themeKey]: e.target.value } as Partial<ScreenTheme>)}
                  className="w-7 h-7 border border-gray-300 dark:border-[#30363d] cursor-pointer shrink-0 p-0" />
                <input type="text" value={val}
                  onChange={(e) => onGlobalThemeChange?.({ [themeKey]: e.target.value || undefined } as Partial<ScreenTheme>)}
                  placeholder={placeholder}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono" />
              </div>
            )
          }

          const RADIUS_PRESETS = ['0px', '4px', '8px', '12px', '16px', '24px', '9999px']

          return (
          <div className="space-y-4">
            {/* Screen type */}
            {onPresentationChange && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Screen type</label>
                <select value={presentation} onChange={(e) => onPresentationChange(e.target.value as 'page' | 'modal')}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white">
                  <option value="page">Page (full-screen navigation)</option>
                  <option value="modal">Modal (overlay on current screen)</option>
                </select>
              </div>
            )}

            {/* Color mode toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Color mode</label>
              <div className="flex gap-0 border border-gray-300 dark:border-[#30363d] w-fit">
                {(['light', 'dark', 'adaptive'] as const).map((m) => (
                  <button key={m} type="button"
                    onClick={() => onThemeChange({ colorMode: m })}
                    className={`px-3 py-1 text-xs font-medium border-r last:border-r-0 border-gray-300 dark:border-[#30363d] transition-colors ${
                      (theme.colorMode ?? 'light') === m
                        ? 'bg-black dark:bg-white text-white dark:text-black'
                        : 'bg-white dark:bg-[#0d1117] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#21262d]'
                    }`}>
                    {m === 'light' ? '☀️ Light' : m === 'dark' ? '🌙 Dark' : '🔄 Adaptive'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Adaptive follows the user's OS preference.</p>
            </div>

            {/* Screen-level colors */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Screen colors</div>
              <p className="text-[10px] text-gray-400">Overrides global theme for this screen. Use <code className="bg-gray-100 dark:bg-[#21262d] px-0.5">var(--primary)</code> etc. in style props.</p>
              <ThemeColorRow label="Primary" themeKey="primary" placeholder="#2563eb" />
              <ThemeColorRow label="Background" themeKey="background" placeholder="#ffffff" />
              <ThemeColorRow label="Text" themeKey="text" placeholder="#1f2937" />
              <ThemeColorRow label="Surface" themeKey="surface" placeholder="#f9fafb" />
              <ThemeColorRow label="Border" themeKey="borderColor" placeholder="#e5e7eb" />
            </div>

            {/* Border radius */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Border radius</div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0">Base</span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {RADIUS_PRESETS.map(p => (
                    <button key={p} type="button" onClick={() => onThemeChange({ borderRadius: p })}
                      className={`px-1.5 py-0.5 text-[10px] border font-mono ${(theme.borderRadius ?? '0px') === p ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0">Small</span>
                <input type="text" value={theme.borderRadiusSm ?? ''} onChange={(e) => onThemeChange({ borderRadiusSm: e.target.value || undefined })}
                  placeholder="4px" className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono" />
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0">Large</span>
                <input type="text" value={theme.borderRadiusLg ?? ''} onChange={(e) => onThemeChange({ borderRadiusLg: e.target.value || undefined })}
                  placeholder="16px" className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono" />
              </div>
            </div>

            {/* Custom CSS */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Custom CSS</label>
              <p className="text-[10px] text-gray-400">Injected into this screen's canvas. Use CSS variables, keyframe animations, etc.</p>
              <div className="border border-gray-300 dark:border-[#30363d] rounded overflow-hidden bg-white dark:bg-[#0d1117]">
                <MonacoEditor
                  language="css"
                  value={theme.customCss ?? ''}
                  onChange={(value) => onThemeChange({ customCss: (value ?? '').trim() || undefined })}
                  height="140px"
                  loading={monacoLoading}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    fontSize: 12,
                    padding: { top: 8, bottom: 8 },
                  }}
                />
              </div>
            </div>

            {/* Global theme */}
            {onGlobalThemeChange && (
              <div className="pt-3 border-t border-gray-200 dark:border-[#30363d] space-y-3">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Global project theme</div>
                <p className="text-[10px] text-gray-400">Applies across all screens. Screen-level overrides above take priority.</p>

                {/* Global color mode */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Color mode (global)</label>
                  <div className="flex gap-0 border border-gray-300 dark:border-[#30363d] w-fit">
                    {(['light', 'dark', 'adaptive'] as const).map((m) => (
                      <button key={m} type="button"
                        onClick={() => onGlobalThemeChange({ colorMode: m })}
                        className={`px-3 py-1 text-xs font-medium border-r last:border-r-0 border-gray-300 dark:border-[#30363d] transition-colors ${
                          ((globalTheme as ScreenTheme).colorMode ?? 'light') === m
                            ? 'bg-black dark:bg-white text-white dark:text-black'
                            : 'bg-white dark:bg-[#0d1117] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#21262d]'
                        }`}>
                        {m === 'light' ? '☀️ Light' : m === 'dark' ? '🌙 Dark' : '🔄 Adaptive'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Adaptive follows the user's OS preference. Set to Light or Dark to disable auto-switching.</p>
                </div>

                <GlobalThemeColorRow label="Primary" themeKey="primary" placeholder="#2563eb" />
                <GlobalThemeColorRow label="Background" themeKey="background" placeholder="#ffffff" />
                <GlobalThemeColorRow label="Text" themeKey="text" placeholder="#1f2937" />
                <GlobalThemeColorRow label="Surface" themeKey="surface" placeholder="#f9fafb" />
                <GlobalThemeColorRow label="Border" themeKey="borderColor" placeholder="#e5e7eb" />
              </div>
            )}
          </div>
          )
        })()}

        {activeTab === 'seo' && (() => {
          const s = seoSettings as SeoSettings
          const SeoField = ({ label, field, placeholder, textarea, hint }: { label: string; field: keyof SeoSettings; placeholder?: string; textarea?: boolean; hint?: string }) => (
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">{label}</label>
              {textarea ? (
                field === 'customHead' ? (
                  <div className="border border-[var(--border)] rounded overflow-hidden bg-[var(--background)]">
                    <MonacoEditor
                      language="html"
                      value={(s[field] as string) ?? ''}
                      onChange={(value) => onSeoChange?.({ [field]: (value ?? '').trim() || undefined } as Partial<SeoSettings>)}
                      height="120px"
                      loading={monacoLoading}
                      options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        fontSize: 12,
                        padding: { top: 8, bottom: 8 },
                      }}
                    />
                  </div>
                ) : (
                  <textarea value={(s[field] as string) ?? ''} onChange={e => onSeoChange?.({ [field]: e.target.value || undefined } as Partial<SeoSettings>)}
                    placeholder={placeholder} rows={3}
                    className="w-full px-2 py-1.5 text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-mono resize-y" />
                )
              ) : (
                <input type="text" value={(s[field] as string) ?? ''} onChange={e => onSeoChange?.({ [field]: e.target.value || undefined } as Partial<SeoSettings>)}
                  placeholder={placeholder}
                  className="w-full px-2 py-1.5 text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]" />
              )}
              {hint && <p className="text-[10px] text-[var(--muted-foreground)]">{hint}</p>}
            </div>
          )
          return (
            <div className="space-y-4 p-2">
              <div className="space-y-1">
                <p className="text-xs text-[var(--muted-foreground)]">Screen-level SEO — controls <code>&lt;title&gt;</code> and meta tags for this screen. Use <code>{'{{screenName}}'}</code> and <code>{'{{projectName}}'}</code> tokens.</p>
              </div>
              <SeoField label="Page title" field="title" placeholder="{{screenName}} | My App"
                hint="Shown in browser tab and search results. Max 60 chars recommended." />
              <SeoField label="Meta description" field="description" placeholder="A short description of this page…" textarea
                hint="Shown in search snippets. Max 160 chars recommended." />
              <div className="border-t border-[var(--border)] pt-4 space-y-4">
                <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Open Graph (social previews)</p>
                <SeoField label="OG title" field="ogTitle" placeholder="Defaults to Page title if empty" />
                <SeoField label="OG description" field="ogDescription" placeholder="Defaults to Meta description if empty" />
                <SeoField label="OG image URL" field="ogImage" placeholder="https://…/social-preview.png"
                  hint="Recommended: 1200×630 px" />
              </div>
              <div className="border-t border-[var(--border)] pt-4 space-y-4">
                <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Indexing</p>
                <SeoField label="Canonical URL" field="canonical" placeholder="https://yourdomain.com/page"
                  hint="Leave blank to use the default URL." />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Robots</label>
                  <select value={(s.robots as string) ?? 'index,follow'} onChange={e => onSeoChange?.({ robots: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
                    <option value="index,follow">index, follow (default)</option>
                    <option value="noindex,follow">noindex, follow</option>
                    <option value="index,nofollow">index, nofollow</option>
                    <option value="noindex,nofollow">noindex, nofollow</option>
                  </select>
                </div>
              </div>
              <div className="border-t border-[var(--border)] pt-4 space-y-4">
                <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Custom head tags</p>
                <SeoField label="Extra &lt;head&gt; markup" field="customHead" placeholder={'<meta name="..." content="..." />'} textarea
                  hint="Raw HTML injected into <head>. Use for custom meta, structured data, etc." />
              </div>
            </div>
          )
        })()}

        {activeTab === 'layout' && (
          node ? (
            <>
              {node.type === 'reusableInstance' ? (
                <>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Instance sizing</div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">Control how this instance fits inside its parent. Use the <strong>Content</strong> tab to pass props.</p>
                  {renderLayoutField('customId')}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {['width', 'height'].map((k) => (
                      <div key={k}>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5 capitalize">{k}</label>
                        <input
                          type="text"
                          value={String(props[k] ?? '')}
                          onChange={(e) => onUpdate({ ...props, [k]: e.target.value })}
                          placeholder="100% or 200"
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Flex (grow/shrink, e.g. 1)</label>
                    <input
                      type="text"
                      value={String(props.flex ?? '')}
                      onChange={(e) => onUpdate({ ...props, flex: e.target.value })}
                      placeholder="1  or  0 0 auto"
                      className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                    />
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Align self</label>
                    <select
                      value={String(props.alignSelf ?? '')}
                      onChange={(e) => onUpdate({ ...props, alignSelf: e.target.value })}
                      className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                    >
                      <option value="">auto</option>
                      <option value="stretch">stretch</option>
                      <option value="flex-start">start</option>
                      <option value="flex-end">end</option>
                      <option value="center">center</option>
                      <option value="baseline">baseline</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1">ID &amp; Box</div>
                  {renderLayoutField('customId')}
                  {boxKeys.map((k) => (LAYOUT_KEYS.includes(k) ? renderLayoutField(k) : null))}
                  {flexKeys.length > 0 && (
                    <>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-300 pt-2 uppercase tracking-wider">Layout (flex/grid)</div>
                      {flexKeys.map(renderLayoutField)}
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p className="font-medium text-gray-800 dark:text-gray-200">Layout</p>
              <p>Click a component on the canvas or in the tree to edit:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>ID (for refs / getElementById)</li>
                <li>Width, height, padding, margin</li>
                <li>Flex/grid (containers only)</li>
              </ul>
            </div>
          )
        )}
        {activeTab === 'content' && (
          node ? (
            <>
              {node.type === 'reusableInstance' ? (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Pass props — {selectedReusable?.name ?? 'Reusable'}</div>
                  {reusablePropsSchema.length > 0 ? (
                    <>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Values or bindings like {'{{state.x}}'}. Inside the reusable, access as {'{{prop.key}}'}.</p>
                      {reusablePropsSchema.map((entry) => {
                        const val = reusablePropsObj[entry.key]
                        const rawVal = typeof val === 'string' ? val : typeof val === 'number' ? String(val) : typeof val === 'boolean' ? String(val) : ''
                        return (
                          <div key={entry.key} className="mb-3 p-2 rounded border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117]">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                              {entry.key}
                              {entry.required && <span className="text-red-500 ml-1">*</span>}
                              <span className="ml-1 text-gray-400 font-normal">({entry.type})</span>
                            </label>
                            {entry.type === 'boolean' ? (
                              <select
                                value={rawVal}
                                onChange={(e) => setReusableProp(entry.key, e.target.value === 'true')}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                              >
                                <option value="">— unset —</option>
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : (
                              <input
                                type={entry.type === 'number' ? 'number' : 'text'}
                                value={rawVal}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (entry.type === 'number' && v !== '' && !v.startsWith('{{')) setReusableProp(entry.key, Number(v))
                                  else setReusableProp(entry.key, v)
                                }}
                                placeholder={entry.type === 'number' ? '0' : `Value or {{state.x}}`}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono"
                              />
                            )}
                          </div>
                        )
                      })}
                    </>
                  ) : (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">This reusable has no props defined. Open Edit source → Component Props to add them.</p>
                  )}
                </div>
              ) : (
                <>
                  {/* ── Visibility ─────────────────────────────────── */}
                  <div className="mb-3 pb-3 border-b border-gray-200 dark:border-[#30363d]">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1">Visibility</div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">Show this component only when a condition is true. Leave blank to always show.</p>
                    <div className="relative">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Show when
                        {(() => {
                          const vw = String(props.visibleWhen ?? '')
                          const isBound = vw.startsWith('{{') && vw.endsWith('}}')
                          return (
                            <button
                              type="button"
                              onClick={() => setBindingFor(bindingFor === 'visibleWhen' ? null : 'visibleWhen')}
                              className={`ml-1.5 p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`}
                              title="Bind to state, data, or expression"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                          )
                        })()}
                      </label>
                      {bindingFor === 'visibleWhen' && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
                          <select
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                            onChange={(e) => {
                              const v = e.target.value
                              if (v.startsWith('state:')) setProp('visibleWhen', `{{state.${v.slice(6)}}}`)
                              else if (v.startsWith('data:')) setProp('visibleWhen', `{{data.${v.slice(5)}}}`)
                              else if (v.startsWith('script:')) setProp('visibleWhen', `{{script.${v.slice(7)}}}`)
                              else if (v.startsWith('prop:')) setProp('visibleWhen', `{{prop.${v.slice(5)}}}`)
                              setBindingFor(null)
                            }}
                          >
                            <option value="">Select…</option>
                            {parentPropSchema.length > 0 && parentPropSchema.map((p) => (
                              <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>
                            ))}
                            {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => (
                              <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>
                            ))}
                            {bindingDataSourceNames.map((name) => (
                  <option key={name} value={`data:${name}`}>Data: {name}</option>
                ))}
                            {Object.keys(namedScripts).filter(Boolean).map((name) => (
                              <option key={name} value={`script:${name}`}>Script: {name}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
                        </div>
                      )}
                      <div className="flex gap-1">
                        {renderExpressionEditor(
                          String(props.visibleWhen ?? ''),
                          (next) => setProp('visibleWhen', next || undefined),
                          "e.g. {{state.isLoggedIn}} or {{state.role}} === 'admin'",
                          'flex-1'
                        )}
                        <button
                          type="button"
                          onClick={() => setPropExpressionKey('visibleWhen')}
                          className="px-2 py-1.5 text-xs border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d] shrink-0"
                          title="Open expression builder"
                        >
                          Build
                        </button>
                      </div>
                      {!!props.visibleWhen && (
                        <button
                          type="button"
                          onClick={() => setProp('visibleWhen', undefined)}
                          className="mt-1 text-[10px] text-red-400 hover:text-red-600"
                        >
                          Clear (always show)
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mb-3 pb-3 border-b border-gray-200 dark:border-[#30363d]">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Loading UX</div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Wrap this component with a suspense-style fallback while data is loading.</p>
                      </div>
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={loadingUxEnabled}
                          onChange={(e) => setProp('suspenseEnabled', e.target.checked)}
                        />
                        Enable
                      </label>
                    </div>
                    {!loadingUxEnabled && hasDataOrStateBinding && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onWrapSelectedWithSuspense && node?.type !== 'suspense') {
                            onWrapSelectedWithSuspense()
                            return
                          }
                          setProp('suspenseEnabled', true)
                          if (props.suspenseSmart === undefined) setProp('suspenseSmart', true)
                          if (!props.suspenseVariant) setProp('suspenseVariant', 'skeleton')
                        }}
                        className="text-[11px] px-2 py-1 border border-gray-300 dark:border-[#30363d] hover:bg-gray-100 dark:hover:bg-[#21262d]"
                      >
                        {onWrapSelectedWithSuspense && node?.type !== 'suspense'
                          ? 'Suggestion: wrap in Suspense component'
                          : 'Suggestion: add loading fallback for bound data'}
                      </button>
                    )}
                    {loadingUxEnabled && (
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Style</label>
                            <select
                              value={String(props.suspenseVariant ?? 'skeleton')}
                              onChange={(e) => setProp('suspenseVariant', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                            >
                              <option value="skeleton">Skeleton</option>
                              <option value="spinner">Spinner</option>
                              <option value="line">Line loader</option>
                              <option value="dots">Dots</option>
                              <option value="custom">Custom label</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Direction</label>
                            <select
                              value={String(props.suspenseDirection ?? 'horizontal')}
                              onChange={(e) => setProp('suspenseDirection', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                            >
                              <option value="horizontal">Horizontal</option>
                              <option value="vertical">Vertical</option>
                            </select>
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={props.suspenseSmart !== false}
                            onChange={(e) => setProp('suspenseSmart', e.target.checked)}
                          />
                          Auto-detect bound data sources still loading
                        </label>
                        <div>
                          <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Manual loading condition (optional)</label>
                          <div className="flex gap-1">
                            {renderExpressionEditor(
                              String(props.suspenseWhen ?? ''),
                              (next) => setProp('suspenseWhen', next || undefined),
                              '{{state.isLoading}}',
                              'flex-1'
                            )}
                            <button
                              type="button"
                              onClick={() => setPropExpressionKey('suspenseWhen')}
                              className="px-2 py-1.5 text-xs border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d] shrink-0"
                              title="Open expression builder"
                            >
                              Build
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Fallback label</label>
                          <input
                            type="text"
                            value={String(props.suspenseLabel ?? 'Loading...')}
                            onChange={(e) => setProp('suspenseLabel', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {contentKeys.length > 0 && (
                    <>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1">Content</div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">Component-specific: label, title, placeholder, URL, etc.</p>
                      {contentKeys.map(renderContentField)}
                    </>
                  )}
                  <div className="pt-2 border-t border-gray-200 dark:border-[#30363d] mt-2">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Component props</div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">Define props (e.g. name, age) this component expects. When you make this a reusable, these become the props you pass per instance.</p>
                    {((props.__propContract as PropContractEntry[] | undefined) ?? []).map((entry, idx) => {
                      const val = props[entry.key]
                      const rawVal = typeof val === 'string' ? val : typeof val === 'number' ? String(val) : typeof val === 'boolean' ? String(val) : ''
                      const isBound = rawVal.startsWith('{{') && rawVal.endsWith('}}')
                      return (
                        <div key={idx} className="mb-3 p-2 rounded border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="text"
                              value={entry.key}
                              onChange={(e) => {
                                const newKey = e.target.value.trim()
                                if (newKey === entry.key) return
                                // Prevent using reserved property names
                                if (newKey && RESERVED_PROP_NAMES.has(newKey)) {
                                  alert(`"${newKey}" is a reserved property name and cannot be used. Please choose a different name.`)
                                  return
                                }
                                const nextContract = ((props.__propContract as PropContractEntry[] | undefined) ?? []).map((e2, i) => (i === idx ? { ...e2, key: newKey } : e2))
                                const next: Record<string, unknown> = { ...props, __propContract: nextContract }
                                if (newKey) {
                                  next[newKey] = (props as Record<string, unknown>)[entry.key]
                                  delete next[entry.key]
                                } else {
                                  delete next[entry.key]
                                }
                                onUpdate(next)
                              }}
                              placeholder="e.g. name, age"
                              className="flex-1 min-w-[80px] px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white font-mono"
                            />
                            <select
                              value={entry.type}
                              onChange={(e) => {
                                const nextContract = ((props.__propContract as PropContractEntry[] | undefined) ?? []).map((e2, i) => (i === idx ? { ...e2, type: e.target.value as 'string' | 'number' | 'boolean' } : e2))
                                onUpdate({ ...props, __propContract: nextContract })
                              }}
                              className="px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white"
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="boolean">Boolean</option>
                            </select>
                            <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={!!entry.required}
                                onChange={(e) => {
                                  const nextContract = ((props.__propContract as PropContractEntry[] | undefined) ?? []).map((e2, i) => (i === idx ? { ...e2, required: e.target.checked } : e2))
                                  onUpdate({ ...props, __propContract: nextContract })
                                }}
                                className="rounded border-gray-300 dark:border-[#30363d]"
                              />
                              Required
                            </label>
                            <button type="button" onClick={() => setBindingFor(bindingFor === `__prop:${entry.key}` ? null : `__prop:${entry.key}`)} className={`p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-[var(--primary)]'}`} title="Bind to state, data, or expression"><Zap className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => { const nextContract = ((props.__propContract as PropContractEntry[] | undefined) ?? []).filter((_, i) => i !== idx); const next: Record<string, unknown> = { ...props, __propContract: nextContract }; delete next[entry.key]; onUpdate(next) }} className="text-red-500 text-xs">Remove</button>
                          </div>
                          {bindingFor === `__prop:${entry.key}` && (
                            <div className="p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
                              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
                              <select
                                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v.startsWith('state:')) setProp(entry.key, `{{state.${v.slice(6)}}}`)
                                  else if (v.startsWith('data:')) setProp(entry.key, `{{data.${v.slice(5)}}}`)
                                  else if (v.startsWith('script:')) setProp(entry.key, `{{script.${v.slice(7)}}}`)
                                  else if (v.startsWith('prop:')) setProp(entry.key, `{{prop.${v.slice(5)}}}`)
                                  else if (v.startsWith('asset:')) setProp(entry.key, v.slice(6))
                                  else if (v === 'expr') setProp(entry.key, '{{ }}')
                                  setBindingFor(null)
                                }}
                              >
                                <option value="">Select…</option>
                                {parentPropSchema.length > 0 && (
                                  <>
                                    {parentPropSchema.map((p) => (
                                      <option key={p.key} value={`prop:${p.key}`}>Prop: {p.key}</option>
                                    ))}
                                  </>
                                )}
                                {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => (
                                  <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>
                                ))}
                                {bindingDataSourceNames.map((name) => (
                  <option key={name} value={`data:${name}`}>Data: {name}</option>
                ))}
                                {Object.keys(namedScripts).filter(Boolean).map((name) => (
                                  <option key={name} value={`script:${name}`}>Script: {name}</option>
                                ))}
                                {projectAssets?.length ? projectAssets.map((a) => <option key={a.id} value={`asset:${a.url}`}>📎 {a.name}</option>) : null}
                                <option value="expr">Expression (edit below)</option>
                              </select>
                              <button type="button" onClick={() => setBindingFor(null)} className="mt-2 text-xs text-gray-500">Close</button>
                            </div>
                          )}
                          <input
                            type="text"
                            value={rawVal}
                            onChange={(e) => { const v = e.target.value; if (entry.type === 'number' && v !== '' && !v.startsWith('{{')) setProp(entry.key, Number(v)); else setProp(entry.key, v); }}
                            placeholder={entry.type === 'boolean' ? 'true / false' : entry.type === 'number' ? '0' : 'Value or {{prop.x}}, {{state.x}}'}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono"
                          />
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        const contract = (props.__propContract as PropContractEntry[] | undefined) ?? []
                        const key = contract.length === 0 ? 'name' : `prop_${Date.now()}`
                        const nextContract = contract.concat([{ key, type: 'string', required: false }])
                        onUpdate({ ...props, __propContract: nextContract, [key]: '' })
                      }}
                      className="w-full py-2 border border-dashed border-gray-300 dark:border-[#30363d] rounded text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#21262d]"
                    >
                      + Add component prop
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p className="font-medium text-gray-800 dark:text-gray-200">Content &amp; props</p>
              <p>Click a component to edit its content (label, title, placeholder, etc.) and define Component props (e.g. name, age) it expects.</p>
            </div>
          )
        )}
        {activeTab === 'style' && (
          node ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">CSS values (e.g. 14px, #333, 1px solid). Applied inline; script can override.</p>
              {styleGroups.map((g) => {
                const keys = g.keys.filter((k): k is string => styleKeys.includes(k as (typeof styleKeys)[number]))
                if (keys.length === 0) return null
                return (
                  <div key={g.title} className="space-y-2 mb-4">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">{g.title}</div>
                    <div className="grid gap-2">
                      {keys.map((k) => renderStyleField(k))}
                    </div>
                  </div>
                )
              })}
            </>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p className="font-medium text-gray-800 dark:text-gray-200">Style</p>
              <p>Click a component to edit CSS: typography, colors, borders, shadow, position, overflow, etc.</p>
            </div>
          )
        )}
        {activeTab === 'animation' && (
          node ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Add entrance animations, transitions, transforms, and sequential effects.</p>

              <div className="border border-blue-200 dark:border-blue-900/40 p-3 bg-blue-50 dark:bg-blue-950/10">
                <AnimationSequenceBuilder
                  value={props.animationSequence as AnimationSequenceConfig | undefined}
                  onChange={(config) => setProp('animationSequence', config)}
                />
              </div>

              <div className="space-y-2 p-2 border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117]">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Visibility + Sequence</div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Use this when your element has <code className="font-mono">visibleWhen</code> and you want it to appear/disappear smoothly.
                </p>
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">When visibleWhen changes</label>
                  <select
                    value={String(props.visibleWhenMode ?? 'remove')}
                    onChange={(e) => setProp('visibleWhenMode', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                  >
                    <option value="remove">Instant (remove from layout)</option>
                    <option value="animate">Animate (fade + slide)</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Duration</label>
                    {renderExpressionEditor(String(props.visibleWhenDuration ?? '0.25s'), (next) => setProp('visibleWhenDuration', next), '0.25s')}
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Easing</label>
                    {renderExpressionEditor(String(props.visibleWhenEasing ?? 'ease'), (next) => setProp('visibleWhenEasing', next), 'ease')}
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Slide offset</label>
                    <input
                      type="number"
                      value={Number(props.visibleWhenOffset ?? 8)}
                      onChange={(e) => setProp('visibleWhenOffset', Number(e.target.value || 0))}
                      className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Tip: Keep your sequence for motion style and set this to <strong>Animate</strong> so visibleWhen does not pop in/out instantly.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Quick Presets</div>
                <div className="flex flex-wrap gap-1">
                  {ANIMATION_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setProp('animation', p.value)}
                      className={`px-2 py-1 text-[11px] border font-medium transition-colors ${
                        String(props.animation ?? '') === p.value
                          ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                          : 'border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:border-black dark:hover:border-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setProp('animation', '')}
                    className="px-2 py-1 text-[11px] border border-red-300 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400">Animation (shorthand)</label>
                {renderExpressionEditor(String(props.animation ?? ''), (next) => setProp('animation', next), 'e.g. fadeIn 0.5s ease both')}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Fine-tune</div>
                <div className="grid gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Duration</label>
                    {renderExpressionEditor(String(props.animationDuration ?? ''), (next) => setProp('animationDuration', next), '0.5s')}
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Timing Function</label>
                    <select value={String(props.animationTimingFunction ?? 'ease')} onChange={(e) => setProp('animationTimingFunction', e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white">
                      {ANIMATION_TIMING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Delay</label>
                    {renderExpressionEditor(String(props.animationDelay ?? ''), (next) => setProp('animationDelay', next), '0s')}
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Iteration Count</label>
                    <select value={String(props.animationIterationCount ?? '1')} onChange={(e) => setProp('animationIterationCount', e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white">
                      {ANIMATION_ITERATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Transition & Transform</div>
                <div className="grid gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Transition</label>
                    {renderExpressionEditor(String(props.transition ?? ''), (next) => setProp('transition', next), 'all 0.3s ease')}
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Transform</label>
                    {renderExpressionEditor(String(props.transform ?? ''), (next) => setProp('transform', next), 'rotate(5deg) scale(1.1)')}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p className="font-medium text-gray-800 dark:text-gray-200">Animation</p>
              <p>Select a component to add entrance, loop, or sequence animations.</p>
            </div>
          )
        )}
        {activeTab === 'events' && (
          node ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Add multiple steps per event — each runs in order. Use Log to print any data, state or expression to the debug console.</p>
              {eventKeys.map((ev) => {
                const steps = parseEventSteps(props[ev])
                const updateStep = (idx: number, c: EventActionConfig) => {
                  const next = steps.map((s, i) => (i === idx ? c : s))
                  setProp(ev, stringifyEventSteps(next))
                }
                const addStep = () => {
                  const next = [...steps, { action: 'log' as EventActionType, message: '' }]
                  setProp(ev, stringifyEventSteps(next))
                }
                const removeStep = (idx: number) => {
                  const next = steps.filter((_, i) => i !== idx)
                  setProp(ev, stringifyEventSteps(next))
                }
                return (
                  <div key={ev} className="border border-gray-200 dark:border-[#30363d] rounded p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">{EVENT_LABELS[ev] ?? ev}</label>
                      <button
                        type="button"
                        onClick={addStep}
                        className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border border-dashed border-gray-300 dark:border-[#30363d] text-gray-500 dark:text-gray-400 hover:border-gray-500 dark:hover:border-gray-300 hover:text-black dark:hover:text-white transition-colors"
                      >
                        + Add step
                      </button>
                    </div>
                    {steps.length === 0 && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">No steps yet — click &quot;+ Add step&quot; to begin.</p>
                    )}
                    {steps.map((config, stepIdx) => (
                      <div key={stepIdx} className="border border-gray-100 dark:border-[#21262d] rounded p-2 space-y-2 bg-gray-50 dark:bg-[#0d1117]">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500 shrink-0">STEP {stepIdx + 1}</span>
                          <select
                            value={config.action}
                            onChange={(e) => updateStep(stepIdx, { ...config, action: e.target.value as EventActionType })}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white"
                          >
                            <option value="log">🖨 Log / print</option>
                            <option value="setState">Set state</option>
                            <option value="alert">Alert (popup)</option>
                            <option value="navigate">Navigate</option>
                            <option value="runScript">Run script</option>
                            <option value="haptic">📳 Haptic (mobile only)</option>
                            <option value="speak">🔊 Speak (TTS)</option>
                            <option value="playAudio">▶ Play audio</option>
                            <option value="startAnimationSequence">▶ Start animation sequence</option>
                            <option value="startAnimationStep">⏭ Start from step N</option>
                            <option value="stopAnimationSequence">⏸ Stop animation sequence</option>
                            <option value="resetAnimationSequence">⏮ Reset animation sequence</option>
                            <option value="custom">Custom JS</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeStep(stepIdx)}
                            className="shrink-0 px-1.5 py-1 text-[11px] text-red-400 hover:text-red-600 border border-transparent hover:border-red-300 rounded transition-colors"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Log / print */}
                        {config.action === 'log' && (
                          <div>
                            <div className="flex gap-1">
                              {renderExpressionEditor(config.message ?? '', (next) => updateStep(stepIdx, { ...config, message: next }), '{{state.x}}, {{data.posts}}, {{prop.item.name}}, literals…', 'flex-1')}
                              <button type="button" onClick={() => setExpressionModal({ ev, stepIdx, field: 'value' })} className="shrink-0 px-1.5 py-1 text-xs border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d]">Build</button>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">Prints to browser console + debug panel. Supports any binding.</p>
                          </div>
                        )}

                        {/* Set state */}
                        {config.action === 'setState' && (
                          <>
                            <select
                              value={config.stateKey ?? ''}
                              onChange={(e) => updateStep(stepIdx, { ...config, stateKey: e.target.value || undefined })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white"
                            >
                              <option value="">Select state variable</option>
                              {availableStateDefinitions.filter((s) => s.name.trim()).map((s) => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                            <div className="flex gap-1">
                              {renderExpressionEditor(config.value ?? '', (next) => updateStep(stepIdx, { ...config, value: next }), 'Value or {{state.x}} + 1', 'flex-1')}
                              <button type="button" onClick={() => setExpressionModal({ ev, stepIdx, field: 'value' })} className="shrink-0 px-1.5 py-1 text-xs border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d]">Build</button>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                              <input
                                type="checkbox"
                                checked={!!config.cacheValue}
                                onChange={(e) => updateStep(stepIdx, { ...config, cacheValue: e.target.checked })}
                                className="rounded"
                              />
                              Cache in browser (persist across reloads)
                            </label>
                          </>
                        )}

                        {/* Alert */}
                        {config.action === 'alert' && (
                          renderExpressionEditor(config.message ?? '', (next) => updateStep(stepIdx, { ...config, message: next }), 'Alert message or {{state.x}}')
                        )}

                        {/* Navigate */}
                        {config.action === 'navigate' && (
                          <div className="space-y-1.5">
                            <select
                              value={config.targetScreenId ?? ''}
                              onChange={(e) => {
                                const nextId = e.target.value || undefined
                                const target = screenTargets.find((s) => s.id === nextId)
                                updateStep(stepIdx, { ...config, targetScreenId: nextId, targetScreenType: target?.presentation ?? 'page' })
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white"
                            >
                              <option value="">Pick screen (optional)</option>
                              {screenTargets.map((s) => (
                                <option key={s.id} value={s.id}>{s.name} ({s.presentation ?? 'page'})</option>
                              ))}
                            </select>
                            {renderExpressionEditor(config.url ?? '', (next) => updateStep(stepIdx, { ...config, url: next }), 'URL or {{state.redirectTo}}')}
                          </div>
                        )}

                        {/* Run script */}
                        {config.action === 'runScript' && (
                          <>
                            {scriptsLoading && (
                              <div className="mb-1.5 flex items-center gap-2 rounded border border-emerald-300/60 bg-emerald-50/70 dark:bg-emerald-900/20 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="font-semibold">DCCortex</span>
                                <span>loading scripts...</span>
                              </div>
                            )}
                            <select
                              value={config.scriptName ?? ''}
                              onChange={(e) => updateStep(stepIdx, { ...config, scriptName: e.target.value || undefined })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white"
                            >
                              <option value="">Select named script</option>
                              {namedScriptNames.map((name) => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                              <option value="__inline__">Inline script</option>
                            </select>
                            {!scriptsLoading && namedScriptNames.length === 0 && (
                              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">No named scripts found yet. Use Inline script or add scripts in the Data tab.</p>
                            )}
                            {(config.scriptName === '__inline__' || !config.scriptName) && (
                              <div className="border border-gray-300 dark:border-[#30363d] rounded overflow-hidden bg-white dark:bg-[#161b22]">
                                <MonacoEditor
                                  language="javascript"
                                  value={config.customScript ?? ''}
                                  onChange={(value) => updateStep(stepIdx, { ...config, customScript: value ?? '' })}
                                  height="88px"
                                  loading={monacoLoading}
                                  options={{
                                    minimap: { enabled: false },
                                    lineNumbers: 'off',
                                    glyphMargin: false,
                                    folding: false,
                                    scrollBeyondLastLine: false,
                                    wordWrap: 'on',
                                    fontSize: 12,
                                    padding: { top: 8, bottom: 8 },
                                  }}
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* Haptic */}
                        {config.action === 'haptic' && (
                          <div className="space-y-1.5">
                            <select
                              value={config.hapticPreset ?? 'medium'}
                              onChange={(e) => updateStep(stepIdx, { ...config, hapticPreset: e.target.value })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white"
                            >
                              <option value="light">light — subtle tap</option>
                              <option value="medium">medium — standard button press</option>
                              <option value="heavy">heavy — major action / force press</option>
                              <option value="selection">selection — picker scroll / stepper</option>
                              <option value="success">success — form saved / confirmed</option>
                              <option value="warning">warning — destructive action ahead</option>
                              <option value="error">error — validation / network failure</option>
                              <option value="custom">custom pattern…</option>
                            </select>
                            {config.hapticPreset === 'custom' && (
                              <div>
                                {renderExpressionEditor(config.hapticCustom ?? '', (next) => updateStep(stepIdx, { ...config, hapticCustom: next }), 'e.g. 100,50,100 or [{"duration":50},{"delay":50,"duration":50}]')}
                                <p className="text-[10px] text-gray-400 mt-0.5">Number array (ms on/off) or Vibration object array with duration/delay/intensity.</p>
                              </div>
                            )}
                            <p className="text-[11px] text-amber-500 dark:text-amber-400">⚠️ Haptics only work on mobile devices. Silently ignored on desktop.</p>
                          </div>
                        )}

                        {/* Speak (TTS) */}
                        {config.action === 'speak' && (
                          <div className="space-y-1.5">
                            <div className="flex gap-1">
                              {renderExpressionEditor(config.speakText ?? '', (next) => updateStep(stepIdx, { ...config, speakText: next }), 'Text or {{state.x}}, {{data.weather.current.temperature_2m}}°C…', 'flex-1')}
                              <button type="button" onClick={() => setExpressionModal({ ev, stepIdx, field: 'value' })} className="shrink-0 px-1.5 py-1 text-xs border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d]">Build</button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="text-[10px] text-gray-500 mb-0.5 block">Rate (0.1–10, default 1)</label>
                                {renderExpressionEditor(config.speakRate ?? '', (next) => updateStep(stepIdx, { ...config, speakRate: next }), '1')}
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 mb-0.5 block">Pitch (0–2, default 1)</label>
                                {renderExpressionEditor(config.speakPitch ?? '', (next) => updateStep(stepIdx, { ...config, speakPitch: next }), '1')}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Play audio */}
                        {config.action === 'playAudio' && (
                          <div className="space-y-1.5">
                            <div className="flex gap-1">
                              {renderExpressionEditor(config.audioUrl ?? '', (next) => updateStep(stepIdx, { ...config, audioUrl: next }), 'URL, /uploads/… or {{state.audioUrl}}', 'flex-1')}
                              {projectId && (
                                <button
                                  type="button"
                                  onClick={() => setAssetPickerFor({ ev, stepIdx })}
                                  className="shrink-0 px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d]"
                                >
                                  Browse
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500">Upload audio files in the asset library or paste any URL.</p>
                          </div>
                        )}

                        {(config.action === 'startAnimationSequence' || config.action === 'startAnimationStep' || config.action === 'stopAnimationSequence' || config.action === 'resetAnimationSequence') && (
                          <div className="space-y-1.5">
                            {renderExpressionEditor(config.animationTargetId ?? '', (next) => updateStep(stepIdx, { ...config, animationTargetId: next }), 'Target DOM id or node id (empty = this component)')}
                            {config.action === 'startAnimationStep' && (
                              <input
                                type="number"
                                min={1}
                                value={config.animationStep ?? '1'}
                                onChange={(e) => updateStep(stepIdx, { ...config, animationStep: e.target.value })}
                                placeholder="1"
                                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white"
                              />
                            )}
                            <p className="text-[11px] text-gray-500">
                              Tip: leave target empty to control the component that fired this event.
                            </p>
                          </div>
                        )}

                        {/* Custom JS */}
                        {config.action === 'custom' && (
                          <div className="border border-gray-300 dark:border-[#30363d] rounded overflow-hidden bg-white dark:bg-[#161b22]">
                            <MonacoEditor
                              language="javascript"
                              value={config.customScript ?? ''}
                              onChange={(value) => updateStep(stepIdx, { ...config, customScript: value ?? '' })}
                              height="88px"
                              loading={monacoLoading}
                              options={{
                                minimap: { enabled: false },
                                lineNumbers: 'off',
                                glyphMargin: false,
                                folding: false,
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                                fontSize: 12,
                                padding: { top: 8, bottom: 8 },
                              }}
                            />
                          </div>
                        )}

                        {/* Per-step condition */}
                        <div className="pt-1 border-t border-gray-200 dark:border-[#30363d]">
                          <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1">Run only when (optional)</div>
                          <div className="grid grid-cols-[1fr,auto,1fr] gap-1 items-center">
                            <div className="flex gap-1">
                              {renderExpressionEditor(config.condition?.left ?? '', (next) => updateStep(stepIdx, { ...config, condition: { left: next, op: config.condition?.op ?? '==', right: config.condition?.right ?? '' } }), '{{state.x}}', 'flex-1 min-w-0')}
                              <button type="button" onClick={() => setExpressionModal({ ev, stepIdx, field: 'conditionLeft' })} className="shrink-0 px-1.5 py-1 text-[10px] border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d]">Build</button>
                            </div>
                            <select
                              value={config.condition?.op ?? '=='}
                              onChange={(e) => updateStep(stepIdx, { ...config, condition: { left: config.condition?.left ?? '', op: e.target.value, right: config.condition?.right ?? '' } })}
                              className="px-1 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white"
                            >
                              {CONDITION_OPS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <div className="flex gap-1">
                              {renderExpressionEditor(config.condition?.right ?? '', (next) => updateStep(stepIdx, { ...config, condition: { left: config.condition?.left ?? '', op: config.condition?.op ?? '==', right: next } }), 'value', 'flex-1 min-w-0')}
                              <button type="button" onClick={() => setExpressionModal({ ev, stepIdx, field: 'conditionRight' })} className="shrink-0 px-1.5 py-1 text-[10px] border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d]">Build</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
              {expressionModal && (() => {
                const ev = expressionModal.ev
                const steps = parseEventSteps(props[ev])
                const cur = steps[expressionModal.stepIdx] ?? { action: 'setState' as EventActionType }
                const initial =
                  expressionModal.field === 'value'
                    ? (cur.action === 'log' ? (cur.message ?? '') : cur.action === 'speak' ? (cur.speakText ?? '') : (cur.value ?? ''))
                    : expressionModal.field === 'conditionLeft'
                      ? (cur.condition?.left ?? '')
                      : (cur.condition?.right ?? '')
                return (
                  <ExpressionBuilderModal
                    open
                    initialValue={typeof initial === 'string' ? initial : ''}
                    onClose={() => setExpressionModal(null)}
                    onInsert={(expression) => {
                      const updated: EventActionConfig =
                        expressionModal.field === 'value'
                          ? (cur.action === 'log' ? { ...cur, message: expression } : cur.action === 'speak' ? { ...cur, speakText: expression } : { ...cur, value: expression })
                          : {
                              ...cur,
                              condition: {
                                left: expressionModal.field === 'conditionLeft' ? expression : (cur.condition?.left ?? ''),
                                op: cur.condition?.op ?? '==',
                                right: expressionModal.field === 'conditionRight' ? expression : (cur.condition?.right ?? ''),
                              },
                            }
                      const next = steps.map((s, i) => (i === expressionModal.stepIdx ? updated : s))
                      setProp(ev, stringifyEventSteps(next))
                      setExpressionModal(null)
                    }}
                    stateDefinitions={availableStateDefinitions}
                    dataSources={bindingDataSources}
                    namedScripts={namedScripts}
                    propNames={parentPropSchema.map((p) => p.key).filter((k) => k.trim())}
                  />
                )
              })()}
              {assetPickerFor && projectId && (
                <AssetPickerModal
                  projectId={projectId}
                  open
                  filterType={'propKey' in assetPickerFor ? (assetPickerFor.filterType ?? 'all') : 'audio'}
                  onClose={() => setAssetPickerFor(null)}
                  onSelect={(url) => {
                    if ('propKey' in assetPickerFor) {
                      if (assetPickerFor.propKey !== '__browse__') {
                        setProp(assetPickerFor.propKey, url)
                      }
                      // For __browse__ (Assets tab) the modal itself handles the select (user just browsed)
                    } else {
                      const steps = parseEventSteps(props[assetPickerFor.ev])
                      const cur = steps[assetPickerFor.stepIdx]
                      if (cur) {
                        const updated: EventActionConfig = { ...cur, audioUrl: url }
                        const next = steps.map((s, i) => (i === assetPickerFor.stepIdx ? updated : s))
                        setProp(assetPickerFor.ev, stringifyEventSteps(next))
                      }
                    }
                    setAssetPickerFor(null)
                  }}
                />
              )}
              <div className="rounded bg-gray-50 dark:bg-[#0d1117] p-2 border border-gray-200 dark:border-[#30363d]">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Helpers (use in expressions)</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  {Object.entries(EVENT_HELPERS).map(([group, items]) => (
                    <div key={group}>
                      <span className="font-medium">{group}:</span>{' '}
                      {items.map((h, i) => (
                        <span key={i}><code className="px-0.5 rounded bg-gray-200 dark:bg-[#21262d]">{h.name}</code> — {h.desc}. </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p className="font-medium text-gray-800 dark:text-gray-200">Events</p>
              <p>Click a component to edit onLoad, onClick, onChange, etc. Set state, run scripts, navigate, or use conditions and helpers.</p>
            </div>
          )
        )}
        {activeTab === 'state' && (
          <div className="space-y-3">
            {onGlobalStateDefinitionsChange && (
              <div className="space-y-2 p-2 rounded border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117]">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Project global state (shared by all screens)</p>
                {globalStateDefinitions.map((s) => (
                  <div key={s.id} className="flex flex-wrap gap-2 items-center">
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => onGlobalStateDefinitionsChange(globalStateDefinitions.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
                      placeholder="Variable name"
                      className="flex-1 min-w-[80px] px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                    />
                    <select
                      value={s.type ?? 'string'}
                      onChange={(e) => onGlobalStateDefinitionsChange(globalStateDefinitions.map((x) => (x.id === s.id ? { ...x, type: e.target.value as 'string' | 'number' | 'boolean' } : x)))}
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                    </select>
                    <input
                      type="text"
                      value={s.initialValue}
                      onChange={(e) => onGlobalStateDefinitionsChange(globalStateDefinitions.map((x) => (x.id === s.id ? { ...x, initialValue: e.target.value } : x)))}
                      placeholder="Initial value"
                      className="flex-1 min-w-[80px] px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                    />
                    <button type="button" onClick={() => onGlobalStateDefinitionsChange(globalStateDefinitions.filter((x) => x.id !== s.id))} className="text-red-500 text-xs">Remove</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onGlobalStateDefinitionsChange([...globalStateDefinitions, { id: `global-state-${Date.now()}`, name: '', initialValue: '', type: 'string' }])}
                  className="w-full py-1.5 border border-dashed border-gray-300 dark:border-[#30363d] rounded text-xs text-gray-500"
                >
                  + Add global state variable
                </button>
              </div>
            )}
            <p className="text-sm text-gray-700 dark:text-gray-300">Create state variables. Bind them with <code className="px-1 py-0.5 bg-gray-100 dark:bg-[#21262d] rounded text-xs">&#123;&#123;state.name&#125;&#125;</code> in any prop that has the bolt icon (Text content, Image URL, Input value, etc.).</p>
            <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
              <strong>Example:</strong> Add variable <code>count</code> (Number, initial 0). Add a Text, click bolt on content and type <code>&#123;&#123;state.count&#125;&#125;</code>. Add a Button, Events → onClick → Set state → variable <code>count</code>, value <code>&#123;&#123;state.count&#125;&#125;</code>. Preview and click: number updates.
            </div>
            {onStateDefinitionsChange && (
              <>
                {stateDefinitions.map((s) => (
                  <div key={s.id} className="flex flex-wrap gap-2 items-center p-2 rounded border border-gray-200 dark:border-[#30363d]">
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => onStateDefinitionsChange(stateDefinitions.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
                      placeholder="Variable name"
                      className="flex-1 min-w-[80px] px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                    />
                    <select
                      value={s.type ?? 'string'}
                      onChange={(e) => onStateDefinitionsChange(stateDefinitions.map((x) => (x.id === s.id ? { ...x, type: e.target.value as 'string' | 'number' | 'boolean' } : x)))}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                    </select>
                    <input
                      type="text"
                      value={s.initialValue}
                      onChange={(e) => onStateDefinitionsChange(stateDefinitions.map((x) => (x.id === s.id ? { ...x, initialValue: e.target.value } : x)))}
                      placeholder="Initial value"
                      className="flex-1 min-w-[80px] px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => onStateDefinitionsChange(stateDefinitions.filter((x) => x.id !== s.id))}
                      className="text-red-500 hover:text-red-600 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onStateDefinitionsChange([...stateDefinitions, { id: `state-${Date.now()}`, name: '', initialValue: '', type: 'string' }])}
                  className="w-full py-2 border border-dashed border-gray-300 dark:border-[#30363d] rounded text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  + Add state variable
                </button>
              </>
            )}
            {!onStateDefinitionsChange && <p className="text-xs text-gray-500">State is not configurable here.</p>}
          </div>
        )}
        {activeTab === 'assets' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">Upload and manage images, audio, video and other files for this project. Use in component props like <code className="px-1 py-0.5 bg-gray-100 dark:bg-[#21262d] rounded text-xs">url</code>, <code className="px-1 py-0.5 bg-gray-100 dark:bg-[#21262d] rounded text-xs">src</code>, <code className="px-1 py-0.5 bg-gray-100 dark:bg-[#21262d] rounded text-xs">poster</code>.</p>
            {projectId ? (
              <>
                <button
                  type="button"
                  onClick={() => setAssetPickerFor({ propKey: '__browse__', filterType: 'all' })}
                  className="w-full py-2.5 border border-dashed border-gray-300 dark:border-[#30363d] rounded text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:border-gray-500 dark:hover:border-gray-400 transition-colors"
                >
                  📂 Open Asset Library
                </button>
                {projectAssets && projectAssets.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{projectAssets.length} asset{projectAssets.length === 1 ? '' : 's'}</p>
                    {projectAssets.slice(0, 20).map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 py-0.5">
                        <span className="shrink-0">{a.mimetype?.startsWith('image/') ? '🖼' : a.mimetype?.startsWith('audio/') ? '🔊' : a.mimetype?.startsWith('video/') ? '🎬' : '📄'}</span>
                        <span className="truncate flex-1">{a.name}</span>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard?.writeText(a.url).catch(() => {}) }}
                          className="shrink-0 text-[10px] px-1.5 py-0.5 border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d]"
                          title="Copy URL"
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                    {projectAssets.length > 20 && <p className="text-[10px] text-gray-400">…and {projectAssets.length - 20} more</p>}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">Save this project first to manage assets.</p>
            )}
          </div>
        )}
        {activeTab === 'data' && (() => {
          // find any available external API sources from the dataSources list
          // that have urlParams — these need per-screen param bindings
          const sourcesWithParams = dataSources.filter(d => (d as any).urlParamDefs?.length)
          return (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">Read data from project sources. Use <code className="px-1 py-0.5 bg-gray-100 dark:bg-[#21262d] rounded text-xs">&#123;&#123;data.source_name&#125;&#125;</code> for full payloads, <code className="px-1 py-0.5 bg-gray-100 dark:bg-[#21262d] rounded text-xs">&#123;&#123;data.source_name.some.path&#125;&#125;</code> for nested fields. Use snake_case source keys in bindings.</p>

            <div className="border border-gray-200 dark:border-[#30363d] rounded p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Data Inspector</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Live keys from preview runtime. Click to copy. Source names are normalized to snake_case.</p>
                </div>
                {runtimeSourceNames.length > 0 && (
                  <select
                    value={inspectorSource}
                    onChange={(e) => setInspectorSource(e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
                  >
                    {runtimeSourceNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
              </div>
              {runtimeSourceNames.length > 0 && inspectorDumpToken && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyInspectorText(inspectorDumpToken, 'Copied payload token')}
                    className="px-2 py-1 text-[10px] border border-gray-300 dark:border-[#30363d] rounded bg-white dark:bg-[#0d1117] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d] font-mono"
                    title={`Copy ${inspectorDumpToken}`}
                  >
                    Copy full payload token
                  </button>
                  {inspectorSafeDumpToken && inspectorSafeDumpToken !== inspectorDumpToken && (
                    <button
                      type="button"
                      onClick={() => copyInspectorText(inspectorSafeDumpToken, 'Copied safe alias token')}
                      className="px-2 py-1 text-[10px] border border-gray-300 dark:border-[#30363d] rounded bg-white dark:bg-[#0d1117] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d] font-mono"
                      title={`Copy ${inspectorSafeDumpToken}`}
                    >
                      Copy safe alias token
                    </button>
                  )}
                  {inspectorCopyNotice && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{inspectorCopyNotice}</span>
                  )}
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">For a dump preview in Text, set Content to only this token (no extra text) while Preview is ON.</p>
                </div>
              )}
              {runtimeSourceNames.length > 0 && inspectorPayloadPreview && (
                <div className="border border-gray-200 dark:border-[#30363d] bg-black text-green-300">
                  <div className="px-2 py-1 border-b border-gray-700 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-gray-300">Payload Preview</span>
                    <button
                      type="button"
                      onClick={() => copyInspectorText(inspectorPayloadPreview, 'Copied payload preview')}
                      className="px-1.5 py-0.5 text-[10px] border border-gray-500 text-gray-200 hover:bg-gray-800"
                      title="Copy payload preview"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="max-h-72 min-h-36 overflow-auto px-2 py-1.5 text-[10px] leading-relaxed font-mono whitespace-pre-wrap break-words">{inspectorPayloadPreview}</pre>
                </div>
              )}
              {runtimeSourceNames.length === 0 ? (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">No live data detected yet. Turn Preview on to fetch runtime data for this screen.</p>
              ) : inspectorTokens.length === 0 ? (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">No inspectable keys for this source yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 max-h-[32rem] min-h-40 overflow-auto">
                  {inspectorTokens.map((token) => (
                    <div
                      key={token}
                      className="text-left p-1.5 border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] text-gray-700 dark:text-gray-300 font-mono">{`{{${token}}}`}</div>
                        <button
                          type="button"
                          onClick={() => copyInspectorText(`{{${token}}}`, 'Copied token')}
                          className="px-1.5 py-0.5 text-[10px] border border-gray-300 dark:border-[#30363d] rounded bg-white dark:bg-[#0d1117] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]"
                          title={`Copy {{${token}}}`}
                        >
                          Copy
                        </button>
                      </div>
                      <div className="mt-1 bg-black text-emerald-300 font-mono text-[10px] px-1.5 py-1 overflow-hidden text-ellipsis whitespace-nowrap">{inspectorTokenValuePreview[token] ?? 'undefined'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {onDataSourcesChange && dataSources.length > 0 && (
              <div className="space-y-3">
                {dataSources.map((d) => (
                  <div key={d.id} className="border border-gray-200 dark:border-[#30363d] rounded p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{d.name}</span>
                      <button type="button" onClick={() => onDataSourcesChange(dataSources.filter((x) => x.id !== d.id))} className="ml-auto text-red-500 hover:text-red-600 text-xs">Remove</button>
                    </div>
                    {(d as any).urlParamDefs?.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">URL parameters — bind to state or enter value</p>
                        {((d as any).urlParamDefs as Array<{name: string; defaultValue?: string; description?: string}>).map((p) => (
                          <div key={p.name} className="flex gap-1.5 items-center">
                            <code className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-[#21262d] text-gray-700 dark:text-gray-300 font-mono shrink-0">&#123;&#123;{p.name}&#125;&#125;</code>
                            <input type="text"
                              value={(d.urlParamBindings ?? {})[p.name] ?? p.defaultValue ?? ''}
                              onChange={e => onDataSourcesChange(dataSources.map(x => x.id !== d.id ? x : { ...x, urlParamBindings: { ...(x.urlParamBindings ?? {}), [p.name]: e.target.value } }))}
                              placeholder={`{{state.${p.name}}} or fixed value`}
                              className="flex-1 px-2 py-0.5 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono" />
                            {p.description && <span className="text-[10px] text-gray-400 shrink-0">{p.description}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {dataSources.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">No data sources attached to this screen yet. Add REST APIs and database tables in the Data tab, then reference them here.</p>
            )}
          </div>
          )
        })()}
        {propExpressionKey && (
          <ExpressionBuilderModal
            open
            initialValue={String(props[propExpressionKey] ?? '')}
            onClose={() => setPropExpressionKey(null)}
            onInsert={(expression) => {
              setProp(propExpressionKey, expression)
              setPropExpressionKey(null)
            }}
            stateDefinitions={availableStateDefinitions}
            dataSources={bindingDataSources}
            namedScripts={namedScripts}
            propNames={parentPropSchema.map((p) => p.key).filter((k) => k.trim())}
          />
        )}
        <IconPickerModal
          open={iconPickerFor !== null}
          currentValue={iconPickerFor ? String(props[iconPickerFor] ?? '') : undefined}
          onClose={() => setIconPickerFor(null)}
          onSelect={(icon) => {
            if (iconPickerFor) setProp(iconPickerFor, icon)
            setIconPickerFor(null)
          }}
        />
        <FontPickerModal
          open={fontPickerOpen}
          currentValue={String(props.fontFamily ?? '')}
          onClose={() => setFontPickerOpen(false)}
          onSelect={(family) => {
            setProp('fontFamily', family)
            setFontPickerOpen(false)
          }}
        />
        <GradientBuilderModal
          open={gradientBuilderFor !== null}
          initialValue={gradientBuilderFor ? String(props[gradientBuilderFor] ?? '') : undefined}
          onClose={() => setGradientBuilderFor(null)}
          onApply={(payload) => {
            if (!gradientBuilderFor) return
            setProp(gradientBuilderFor, payload.css)
            if (payload.animation) {
              if (payload.animation.backgroundSize) setProp('backgroundSize', payload.animation.backgroundSize)
              setProp(
                'animation',
                `${payload.animation.name} ${payload.animation.durationSec}s ${payload.animation.timing} ${payload.animation.direction} infinite`
              )
            }
          }}
        />
      </div>
    </div>
  )
}
