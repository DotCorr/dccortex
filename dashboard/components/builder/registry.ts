/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Full component registry for no-code UI builder.
 * Layout components support flex/grid; PropertyPanel uses option sets for dropdowns.
 */
export type Node = {
  id: string
  type: string
  props: Record<string, unknown>
  children: Node[]
}

/** Event keys that can be configured per component. Extensible for plugins. */
export const BUILDER_EVENT_KEYS = [
  'onLoad', 'onRender', 'onClick', 'onDoubleClick', 'onChange', 'onSubmit', 'onFocus', 'onBlur', 'onInput',
  'onMouseEnter', 'onMouseLeave', 'onPressIn', 'onPressOut', 'onKeyDown', 'onKeyUp',
  'onAnimationStart', 'onAnimationEnd', 'onAnimationTick',
] as const

export type ComponentDef = {
  id: string
  label: string
  category: 'Layout' | 'Form' | 'Display' | 'Actions' | 'Charts'
  defaultProps: Record<string, unknown>
  /** Props that support {{state.x}} / {{data.x}}. BuilderCanvas must pass each through resolve() when rendering. */
  bindableProps: string[]
  allowsChildren: boolean
  /** prop key -> array of { value, label } for dropdowns */
  options?: Record<string, { value: string; label: string }[]>
  /** Events this component supports. If omitted, all BUILDER_EVENT_KEYS are shown. */
  events?: readonly string[]
}

const LAYOUT_DEFAULTS = {
  display: 'flex',
  flex: '',
  flexDirection: 'column',
  flexWrap: 'nowrap',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  gap: 8,
  padding: 12,
  margin: 0,
  width: '',
  height: '',
  minHeight: 48,
}

export const COMPONENT_REGISTRY: ComponentDef[] = [
  {
    id: 'container',
    label: 'Container',
    category: 'Layout',
    defaultProps: { ...LAYOUT_DEFAULTS },
    bindableProps: [],
    allowsChildren: true,
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'],
    options: {
      display: [
        { value: 'flex', label: 'Flex' },
      ],
      flexDirection: [
        { value: 'row', label: 'Row' },
        { value: 'column', label: 'Column' },
        { value: 'row-reverse', label: 'Row reverse' },
        { value: 'column-reverse', label: 'Column reverse' },
      ],
      flexWrap: [
        { value: 'nowrap', label: 'No wrap' },
        { value: 'wrap', label: 'Wrap' },
        { value: 'wrap-reverse', label: 'Wrap reverse' },
      ],
      alignItems: [
        { value: 'flex-start', label: 'Start' },
        { value: 'flex-end', label: 'End' },
        { value: 'center', label: 'Center' },
        { value: 'stretch', label: 'Stretch' },
        { value: 'baseline', label: 'Baseline' },
      ],
      justifyContent: [
        { value: 'flex-start', label: 'Start' },
        { value: 'flex-end', label: 'End' },
        { value: 'center', label: 'Center' },
        { value: 'space-between', label: 'Space between' },
        { value: 'space-around', label: 'Space around' },
        { value: 'space-evenly', label: 'Space evenly' },
      ],
    },
  },
  {
    id: 'suspense',
    label: 'Suspense',
    category: 'Layout',
    defaultProps: {
      ...LAYOUT_DEFAULTS,
      suspenseEnabled: true,
      suspenseSmart: true,
      suspenseVariant: 'skeleton',
      suspenseDirection: 'horizontal',
      suspenseLabel: 'Loading...',
      suspenseWhen: '',
    },
    bindableProps: ['suspenseWhen', 'suspenseLabel'],
    allowsChildren: true,
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'],
    options: {
      display: [
        { value: 'flex', label: 'Flex' },
      ],
      flexDirection: [
        { value: 'row', label: 'Row' },
        { value: 'column', label: 'Column' },
        { value: 'row-reverse', label: 'Row reverse' },
        { value: 'column-reverse', label: 'Column reverse' },
      ],
      alignItems: [
        { value: 'flex-start', label: 'Start' },
        { value: 'flex-end', label: 'End' },
        { value: 'center', label: 'Center' },
        { value: 'stretch', label: 'Stretch' },
      ],
      justifyContent: [
        { value: 'flex-start', label: 'Start' },
        { value: 'flex-end', label: 'End' },
        { value: 'center', label: 'Center' },
        { value: 'space-between', label: 'Space between' },
        { value: 'space-around', label: 'Space around' },
      ],
    },
  },
  {
    id: 'section',
    label: 'Section',
    category: 'Layout',
    defaultProps: { title: '', ...LAYOUT_DEFAULTS },
    bindableProps: ['title'],
    allowsChildren: true,
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'],
    options: {
      display: [
        { value: 'flex', label: 'Flex' },
      ],
      flexDirection: [
        { value: 'row', label: 'Row' },
        { value: 'column', label: 'Column' },
        { value: 'row-reverse', label: 'Row reverse' },
        { value: 'column-reverse', label: 'Column reverse' },
      ],
      alignItems: [
        { value: 'flex-start', label: 'Start' },
        { value: 'flex-end', label: 'End' },
        { value: 'center', label: 'Center' },
        { value: 'stretch', label: 'Stretch' },
      ],
      justifyContent: [
        { value: 'flex-start', label: 'Start' },
        { value: 'flex-end', label: 'End' },
        { value: 'center', label: 'Center' },
        { value: 'space-between', label: 'Space between' },
        { value: 'space-around', label: 'Space around' },
      ],
    },
  },
  {
    id: 'stackV',
    label: 'Stack (vertical)',
    category: 'Layout',
    defaultProps: { ...LAYOUT_DEFAULTS, flexDirection: 'column' },
    bindableProps: [],
    allowsChildren: true,
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'],
    options: {
      alignItems: [
        { value: 'flex-start', label: 'Start' },
        { value: 'flex-end', label: 'End' },
        { value: 'center', label: 'Center' },
        { value: 'stretch', label: 'Stretch' },
      ],
      justifyContent: [
        { value: 'flex-start', label: 'Start' },
        { value: 'flex-end', label: 'End' },
        { value: 'center', label: 'Center' },
        { value: 'space-between', label: 'Space between' },
      ],
    },
  },
  {
    id: 'stackH',
    label: 'Stack (horizontal)',
    category: 'Layout',
    defaultProps: { ...LAYOUT_DEFAULTS, flexDirection: 'row' },
    bindableProps: [],
    allowsChildren: true,
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'],
    options: {
      alignItems: [
        { value: 'flex-start', label: 'Start' },
        { value: 'flex-end', label: 'End' },
        { value: 'center', label: 'Center' },
        { value: 'stretch', label: 'Stretch' },
      ],
      justifyContent: [
        { value: 'flex-start', label: 'Start' },
        { value: 'flex-end', label: 'End' },
        { value: 'center', label: 'Center' },
        { value: 'space-between', label: 'Space between' },
      ],
    },
  },
  { id: 'header', label: 'Header', category: 'Layout', defaultProps: { ...LAYOUT_DEFAULTS, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, bindableProps: [], allowsChildren: true, events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'] },
  { id: 'main', label: 'Main', category: 'Layout', defaultProps: { ...LAYOUT_DEFAULTS, minHeight: 120 }, bindableProps: [], allowsChildren: true, events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'] },
  { id: 'footer', label: 'Footer', category: 'Layout', defaultProps: { ...LAYOUT_DEFAULTS, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, bindableProps: [], allowsChildren: true, events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'] },
  { id: 'nav', label: 'Nav', category: 'Layout', defaultProps: { ...LAYOUT_DEFAULTS, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }, bindableProps: [], allowsChildren: true, events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'] },
  { id: 'aside', label: 'Aside', category: 'Layout', defaultProps: { ...LAYOUT_DEFAULTS, minHeight: 120, collapsible: false, hamburgerTop: 10, hamburgerLeft: 10, hamburgerBg: 'rgba(255,255,255,0.9)', hamburgerColor: '#000000', hamburgerBorder: '1px solid rgba(0,0,0,0.15)', hamburgerRadius: '0px', hamburgerIcon: '', hamburgerIconSize: 20, hamburgerContentOffset: 50, hamburgerBreakpoint: 'always' }, bindableProps: [], allowsChildren: true, options: { hamburgerBreakpoint: [ { value: 'always', label: 'Always (hamburger on all sizes)' }, { value: 'sm', label: 'Mobile only (≤ 640 px)' }, { value: 'md', label: 'Mobile + small tablet (≤ 768 px)' }, { value: 'lg', label: 'Up to laptop (≤ 1024 px)' }, { value: 'xl', label: 'Up to desktop (≤ 1280 px)' }, { value: 'never', label: 'Never (always visible in layout)' }, ] }, events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'] },
  { id: 'article', label: 'Article', category: 'Layout', defaultProps: { ...LAYOUT_DEFAULTS, minHeight: 120 }, bindableProps: [], allowsChildren: true, events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'] },
  { id: 'divider', label: 'Divider', category: 'Display', defaultProps: { orientation: 'horizontal', thickness: 1, color: '#e5e7eb', width: '100%', margin: 8 }, bindableProps: ['color'], allowsChildren: false, options: { orientation: [{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }] }, events: ['onClick', 'onMouseEnter', 'onMouseLeave'] },
  { id: 'spacer', label: 'Spacer', category: 'Layout', defaultProps: { width: '100%', height: 16 }, bindableProps: [], allowsChildren: false, events: ['onClick', 'onMouseEnter', 'onMouseLeave'] },
  {
    id: 'text',
    label: 'Text',
    category: 'Display',
    defaultProps: { content: 'Text', variant: 'body' },
    bindableProps: ['content'],
    allowsChildren: false,
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'],
    options: {
      variant: [
        { value: 'body', label: 'Body' },
        { value: 'h1', label: 'Heading 1' },
        { value: 'h2', label: 'Heading 2' },
        { value: 'h3', label: 'Heading 3' },
        { value: 'caption', label: 'Caption' },
        { value: 'small', label: 'Small' },
      ],
    },
  },
  {
    id: 'gradientText',
    label: 'Gradient Text',
    category: 'Display',
    defaultProps: {
      content: 'Gradient Text',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontSize: 42,
      fontWeight: 700,
      lineHeight: 1.1,
      backgroundSize: '200% 200%',
      animation: 'dccGradientShiftX 8s ease infinite',
      textAlign: 'left',
    },
    bindableProps: ['content', 'gradient'],
    allowsChildren: false,
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'gradientSvg',
    label: 'Gradient SVG',
    category: 'Display',
    defaultProps: {
      shape: 'wave',
      gradient: 'linear-gradient(90deg, #22d3ee 0%, #6366f1 100%)',
      width: 240,
      height: 140,
      strokeColor: '',
      strokeWidth: 0,
      opacity: 1,
      animation: '',
    },
    bindableProps: ['gradient', 'strokeColor'],
    allowsChildren: false,
    options: {
      shape: [
        { value: 'wave', label: 'Wave' },
        { value: 'blob', label: 'Blob' },
        { value: 'ring', label: 'Ring' },
        { value: 'diamond', label: 'Diamond' },
      ],
    },
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'],
  },
  { id: 'image', label: 'Image', category: 'Display', defaultProps: { url: '', alt: '', width: 200, height: 150, objectFit: 'cover', objectPosition: 'center' }, bindableProps: ['url', 'alt'], allowsChildren: false, events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'], options: { objectFit: [{ value: 'fill', label: 'Fill' }, { value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Cover' }, { value: 'none', label: 'None' }, { value: 'scale-down', label: 'Scale down' }] } },
  // Iconify icon — any icon from iconify.design (e.g. "mdi:home", "lucide:star", "heroicons:user")
  { id: 'icon', label: 'Icon', category: 'Display', defaultProps: { icon: 'mdi:star', size: 24, color: '' }, bindableProps: ['icon', 'color'], allowsChildren: false, events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'] },
  { id: 'table', label: 'Table', category: 'Display', defaultProps: { columns: 'Name,Email', rows: '', showExport: false, showSearch: false, sortable: false, paginate: false, pageSize: 10, striped: false, compact: false }, bindableProps: ['rows', 'columns'], allowsChildren: false, events: ['onClick', 'onMouseEnter', 'onMouseLeave'] },
  {
    id: 'button',
    label: 'Button',
    category: 'Actions',
    defaultProps: { label: 'Button', variant: 'primary' },
    bindableProps: ['label'],
    allowsChildren: false,
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'],
    options: {
      variant: [
        { value: 'primary', label: 'Primary' },
        { value: 'secondary', label: 'Secondary' },
        { value: 'outline', label: 'Outline' },
        { value: 'ghost', label: 'Ghost' },
      ],
    },
  },
  { id: 'link', label: 'Link', category: 'Actions', defaultProps: { label: 'Link', url: '#' }, bindableProps: ['label', 'url'], allowsChildren: false, events: ['onClick', 'onMouseEnter', 'onMouseLeave'] },
  { id: 'textInput', label: 'Text input', category: 'Form', defaultProps: { label: '', placeholder: '', value: '' }, bindableProps: ['label', 'placeholder', 'value'], allowsChildren: false, events: ['onChange', 'onFocus', 'onBlur', 'onInput'] },
  { id: 'numberInput', label: 'Number input', category: 'Form', defaultProps: { label: '', placeholder: '0', value: '' }, bindableProps: ['label', 'placeholder', 'value'], allowsChildren: false, events: ['onChange', 'onFocus', 'onBlur', 'onInput'] },
  { id: 'dropdown', label: 'Dropdown', category: 'Form', defaultProps: { label: '', options: 'Option 1,Option 2', value: '' }, bindableProps: ['label', 'options', 'value'], allowsChildren: false, events: ['onChange', 'onFocus', 'onBlur'] },
  { id: 'checkbox', label: 'Checkbox', category: 'Form', defaultProps: { label: 'Checkbox', checked: false }, bindableProps: ['label', 'checked'], allowsChildren: false, events: ['onChange', 'onClick'] },
  {
    id: 'gestureDetector',
    label: 'Gesture detector',
    category: 'Actions',
    defaultProps: { behavior: 'opacity', activeOpacity: 0.7, activeScale: 0.98 },
    bindableProps: [],
    allowsChildren: true,
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave', 'onPressIn', 'onPressOut'],
    options: {
      behavior: [
        { value: 'opacity', label: 'Opacity (touchable)' },
        { value: 'scale', label: 'Scale down' },
        { value: 'none', label: 'None (no feedback)' },
      ],
    },
  },
  {
    id: 'reusableInstance',
    label: 'Reusable instance',
    category: 'Layout',
    defaultProps: { reusableId: '', reusableProps: {} },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'lineChart',
    label: 'Line chart',
    category: 'Charts',
    defaultProps: { data: '10,20,30,40,50', width: 300, height: 200, color: '#2563eb', showDots: true },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'barChart',
    label: 'Bar chart',
    category: 'Charts',
    defaultProps: { data: '10,20,30,40,50', width: 300, height: 200, color: '#2563eb' },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'pieChart',
    label: 'Pie chart',
    category: 'Charts',
    defaultProps: { data: '30,25,20,15,10', width: 200, height: 200 },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'areaChart',
    label: 'Area chart',
    category: 'Charts',
    defaultProps: { data: '10,20,30,40,50', width: 300, height: 200, color: '#2563eb' },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'doughnutChart',
    label: 'Doughnut chart',
    category: 'Charts',
    defaultProps: { data: '35,25,20,12,8', width: 200, height: 200, innerRadiusPercent: 50 },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'horizontalBarChart',
    label: 'Horizontal bar chart',
    category: 'Charts',
    defaultProps: { data: '40,65,55,80,45', width: 300, height: 200, color: '#2563eb' },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'stackedBarChart',
    label: 'Stacked bar chart',
    category: 'Charts',
    defaultProps: { dataA: '10,20,15', dataB: '20,15,25', dataC: '15,25,20', width: 280, height: 180 },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'scatterChart',
    label: 'Scatter chart',
    category: 'Charts',
    defaultProps: { data: '10,20|25,45|40,35|55,70|70,50', width: 280, height: 200, color: '#2563eb' },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'radarChart',
    label: 'Radar chart',
    category: 'Charts',
    defaultProps: { data: '70,85,60,90,75', width: 220, height: 220 },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'gaugeChart',
    label: 'Gauge / KPI',
    category: 'Charts',
    defaultProps: { value: 72, min: 0, max: 100, width: 180, height: 120, color: '#2563eb' },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'funnelChart',
    label: 'Funnel chart',
    category: 'Charts',
    defaultProps: { data: '1000,600,350,180,80', width: 240, height: 220 },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'stepLineChart',
    label: 'Step line chart',
    category: 'Charts',
    defaultProps: { data: '10,20,20,35,35,50', width: 300, height: 200, color: '#2563eb' },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'heatmapChart',
    label: 'Heatmap',
    category: 'Charts',
    defaultProps: { data: '2,5,8|4,9,3|7,1,6', width: 240, height: 180 },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'bubbleChart',
    label: 'Bubble chart',
    category: 'Charts',
    defaultProps: { data: '20,30,15|45,50,25|60,40,35|70,70,20', width: 280, height: 200 },
    bindableProps: [],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },

  // ─── Form ─────────────────────────────────────────────────────────────────
  { id: 'textarea', label: 'Textarea', category: 'Form', defaultProps: { label: '', placeholder: '', value: '', rows: 4 }, bindableProps: ['label', 'placeholder', 'value'], allowsChildren: false, events: ['onChange', 'onFocus', 'onBlur', 'onInput'] },
  {
    id: 'toggle',
    label: 'Toggle / Switch',
    category: 'Form',
    defaultProps: { label: 'Toggle', checked: false, labelPosition: 'right' },
    bindableProps: ['label', 'checked'],
    allowsChildren: false,
    events: ['onChange', 'onClick'],
    options: { labelPosition: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
  },
  {
    id: 'radioGroup',
    label: 'Radio group',
    category: 'Form',
    defaultProps: { label: '', options: 'Option 1,Option 2,Option 3', value: '', layout: 'vertical' },
    bindableProps: ['label', 'options', 'value'],
    allowsChildren: false,
    events: ['onChange'],
    options: { layout: [{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }] },
  },
  {
    id: 'slider',
    label: 'Slider',
    category: 'Form',
    defaultProps: { label: '', min: 0, max: 100, step: 1, value: 50, showValue: true },
    bindableProps: ['label', 'value', 'min', 'max'],
    allowsChildren: false,
    events: ['onChange', 'onInput'],
  },
  {
    id: 'datepicker',
    label: 'Date picker',
    category: 'Form',
    defaultProps: { label: '', value: '', type: 'date' },
    bindableProps: ['label', 'value'],
    allowsChildren: false,
    events: ['onChange', 'onFocus', 'onBlur'],
    options: { type: [{ value: 'date', label: 'Date' }, { value: 'datetime-local', label: 'Date & time' }, { value: 'time', label: 'Time' }, { value: 'month', label: 'Month' }] },
  },
  {
    id: 'fileUpload',
    label: 'File upload',
    category: 'Form',
    defaultProps: { label: 'Choose file', accept: '', multiple: false, dragDrop: true },
    bindableProps: ['label'],
    allowsChildren: false,
    events: ['onChange', 'onClick'],
    options: {},
  },
  {
    id: 'searchInput',
    label: 'Search input',
    category: 'Form',
    defaultProps: { label: '', placeholder: 'Search…', value: '', suggestions: '' },
    bindableProps: ['label', 'placeholder', 'value', 'suggestions'],
    allowsChildren: false,
    events: ['onChange', 'onInput', 'onFocus', 'onBlur', 'onSubmit'],
  },
  {
    id: 'formWrapper',
    label: 'Form',
    category: 'Form',
    defaultProps: { ...LAYOUT_DEFAULTS, submitLabel: 'Submit', method: 'none' },
    bindableProps: ['submitLabel'],
    allowsChildren: true,
    events: ['onSubmit'],
    options: { method: [{ value: 'none', label: 'None (manual)' }, { value: 'post', label: 'POST to URL' }, { value: 'api', label: 'Call data source' }] },
  },

  // ─── Display ──────────────────────────────────────────────────────────────
  {
    id: 'alertBanner',
    label: 'Alert / Banner',
    category: 'Display',
    defaultProps: { title: '', message: 'This is an alert message.', variant: 'info', dismissible: true },
    bindableProps: ['title', 'message'],
    allowsChildren: false,
    events: ['onDismiss', 'onClick'],
    options: {
      variant: [
        { value: 'info', label: 'Info' },
        { value: 'success', label: 'Success' },
        { value: 'warning', label: 'Warning' },
        { value: 'error', label: 'Error' },
      ],
    },
  },
  {
    id: 'badge',
    label: 'Badge / Tag',
    category: 'Display',
    defaultProps: { label: 'Badge', variant: 'default', size: 'sm' },
    bindableProps: ['label'],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
    options: {
      variant: [
        { value: 'default', label: 'Default' },
        { value: 'success', label: 'Success' },
        { value: 'warning', label: 'Warning' },
        { value: 'error', label: 'Error' },
        { value: 'info', label: 'Info' },
        { value: 'outline', label: 'Outline' },
      ],
      size: [{ value: 'xs', label: 'XS' }, { value: 'sm', label: 'SM' }, { value: 'md', label: 'MD' }],
    },
  },
  {
    id: 'avatar',
    label: 'Avatar',
    category: 'Display',
    defaultProps: { src: '', alt: '', initials: 'AB', size: 40, shape: 'circle', showStatus: false, status: 'online' },
    bindableProps: ['src', 'alt', 'initials'],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
    options: {
      shape: [{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }],
      status: [{ value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' }, { value: 'away', label: 'Away' }, { value: 'busy', label: 'Busy' }],
    },
  },
  {
    id: 'progressBar',
    label: 'Progress bar',
    category: 'Display',
    defaultProps: { value: 60, max: 100, label: '', showPercent: true, color: '#2563eb', height: 8, animated: false },
    bindableProps: ['value', 'max', 'label'],
    allowsChildren: false,
    events: ['onClick', 'onMouseEnter', 'onMouseLeave'],
  },
  {
    id: 'spinner',
    label: 'Spinner',
    category: 'Display',
    defaultProps: { size: 32, color: '#2563eb', label: '' },
    bindableProps: ['label'],
    allowsChildren: false,
    events: [],
  },
  {
    id: 'card',
    label: 'Card',
    category: 'Display',
    defaultProps: { ...LAYOUT_DEFAULTS, flexDirection: 'column', padding: 20, shadow: 'md', rounded: 'md', bordered: true },
    bindableProps: [],
    allowsChildren: true,
    events: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave'],
    options: {
      shadow: [{ value: 'none', label: 'None' }, { value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }, { value: 'xl', label: 'XL' }],
      rounded: [{ value: 'none', label: 'None' }, { value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }, { value: 'full', label: 'Full' }],
    },
  },
  {
    id: 'modal',
    label: 'Modal / Dialog',
    category: 'Display',
    defaultProps: { ...LAYOUT_DEFAULTS, title: 'Dialog title', open: false, size: 'md', showOverlay: true, showCloseButton: true },
    bindableProps: ['title', 'open'],
    allowsChildren: true,
    events: ['onClose'],
    options: {
      size: [{ value: 'sm', label: 'Small (400px)' }, { value: 'md', label: 'Medium (560px)' }, { value: 'lg', label: 'Large (720px)' }, { value: 'xl', label: 'XL (900px)' }, { value: 'full', label: 'Full screen' }],
    },
  },
  {
    id: 'tabs',
    label: 'Tabs',
    category: 'Display',
    defaultProps: { tabs: 'Tab 1,Tab 2,Tab 3', activeTab: 0, variant: 'line' },
    bindableProps: ['tabs', 'activeTab'],
    allowsChildren: true,
    events: ['onChange'],
    options: { variant: [{ value: 'line', label: 'Underline' }, { value: 'pills', label: 'Pills' }, { value: 'boxed', label: 'Boxed' }] },
  },
  {
    id: 'accordion',
    label: 'Accordion',
    category: 'Display',
    defaultProps: { items: 'Section 1|Content 1,Section 2|Content 2,Section 3|Content 3', multiple: false, defaultOpen: '0' },
    bindableProps: ['items'],
    allowsChildren: false,
    events: ['onChange'],
  },
  {
    id: 'richText',
    label: 'Rich text (Markdown)',
    category: 'Display',
    defaultProps: { content: '# Hello\n\nThis is **rich text** with _markdown_.\n\n- Item 1\n- Item 2' },
    bindableProps: ['content'],
    allowsChildren: false,
    events: ['onClick'],
  },
  {
    id: 'video',
    label: 'Video',
    category: 'Display',
    defaultProps: { src: '', poster: '', controls: true, autoplay: false, loop: false, muted: true, width: 320, height: 180 },
    bindableProps: ['src', 'poster'],
    allowsChildren: false,
    events: ['onClick'],
    options: {},
  },
  {
    id: 'embed',
    label: 'Embed / iFrame',
    category: 'Display',
    defaultProps: { src: '', title: 'Embed', width: 400, height: 300, allow: '' },
    bindableProps: ['src', 'title'],
    allowsChildren: false,
    events: ['onClick'],
  },
  {
    id: 'tooltip',
    label: 'Tooltip',
    category: 'Display',
    defaultProps: { content: 'Tooltip text', position: 'top', delay: 0 },
    bindableProps: ['content'],
    allowsChildren: true,
    events: ['onMouseEnter', 'onMouseLeave'],
    options: { position: [{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
  },

  // ─── Data ─────────────────────────────────────────────────────────────────
  {
    id: 'dataRepeater',
    label: 'Data repeater',
    category: 'Display',
    defaultProps: { ...LAYOUT_DEFAULTS, dataSource: '', itemVar: 'item', flexDirection: 'column', gap: 8, emptyText: 'No items' },
    bindableProps: ['dataSource'],
    allowsChildren: true,
    events: ['onClick'],
    options: {},
  },
]

const byId = new Map(COMPONENT_REGISTRY.map((c) => [c.id, c]))
const customComponentRegistry: ComponentDef[] = []

export function getComponentDef(type: string): ComponentDef | undefined {
  return byId.get(type)
}

export function registerBuilderComponents(defs: ComponentDef[]) {
  for (const def of defs) {
    byId.set(def.id, def)
    const idx = customComponentRegistry.findIndex((c) => c.id === def.id)
    if (idx > -1) customComponentRegistry[idx] = def
    else customComponentRegistry.push(def)
  }
}

export function getAllComponentDefs(): ComponentDef[] {
  return [...COMPONENT_REGISTRY, ...customComponentRegistry]
}

export function createNode(type: string, id?: string): Node {
  const def = byId.get(type)
  const props = def ? { ...def.defaultProps } : {}
  return {
    id: id ?? `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    props,
    children: [],
  }
}

export function getDefaultProps(type: string): Record<string, unknown> {
  const def = byId.get(type)
  return def ? { ...def.defaultProps } : {}
}

export const CATEGORIES = ['Layout', 'Form', 'Display', 'Actions', 'Charts'] as const

/** Build inline style from layout props (display, flex*, gap, padding, margin, width, height) */
export function layoutPropsToStyle(props: Record<string, unknown>): Record<string, string | number> {
  const p = props as Record<string, unknown>
  const style: Record<string, string | number> = {}
  // Builder layout primitives are flex-only to keep behavior predictable.
  style.display = 'flex'
  const flexRaw = p.flex != null && String(p.flex).trim() ? String(p.flex).trim() : ''
  if (flexRaw) {
    const maybeNum = Number(flexRaw)
    style.flex = Number.isNaN(maybeNum) ? flexRaw : maybeNum
  }
  const fd = String(p.flexDirection ?? 'column')
  if (fd) style.flexDirection = fd as any
  const fw = String(p.flexWrap ?? 'nowrap')
  if (fw) style.flexWrap = fw as any
  const ai = String(p.alignItems ?? 'stretch')
  if (ai) style.alignItems = ai as any
  const jc = String(p.justifyContent ?? 'flex-start')
  if (jc) style.justifyContent = jc as any
  const gap = p.gap != null ? Number(p.gap) : 8
  if (typeof gap === 'number' && !isNaN(gap)) style.gap = `${gap}px`
  const pad = p.padding != null ? Number(p.padding) : 12
  if (typeof pad === 'number' && !isNaN(pad)) style.padding = `${pad}px`
  const margin = p.margin != null ? Number(p.margin) : 0
  if (typeof margin === 'number' && !isNaN(margin)) style.margin = margin ? `${margin}px` : 0
  const wRaw = p.width != null && String(p.width).trim() ? String(p.width).trim() : ''
  if (wRaw) {
    style.width = /^\d+$/.test(wRaw) ? `${wRaw}px` : wRaw
  }
  const hRaw = p.height != null && String(p.height).trim() ? String(p.height).trim() : ''
  if (hRaw) {
    style.height = /^\d+$/.test(hRaw) ? `${hRaw}px` : hRaw
  }
  const minH = p.minHeight != null ? Number(p.minHeight) : 48
  if (typeof minH === 'number' && !isNaN(minH)) style.minHeight = minH
  return style
}

/** Full CSS property keys – 1:1 with web for scripting and export to Next.js/React Native */
export const STYLE_PROP_KEYS = [
  'backgroundColor',
  'color',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textDecoration',
  'textTransform',
  'border',
  'borderTop',
  'borderRight',
  'borderBottom',
  'borderLeft',
  'borderWidth',
  'borderStyle',
  'borderColor',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
  'boxShadow',
  'opacity',
  'outline',
  'outlineOffset',
  'cursor',
  'transition',
  'transform',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'aspectRatio',
  'overflow',
  'overflowX',
  'overflowY',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'zIndex',
  'objectFit',
  'objectPosition',
  // Gradient / background image
  'background',
  'backgroundImage',
  'backgroundSize',
  'backgroundPosition',
  'backgroundRepeat',
  'backgroundBlendMode',
  // Animation & transitions
  'animation',
  'animationDuration',
  'animationTimingFunction',
  'animationDelay',
  'animationIterationCount',
  'animationDirection',
  'animationFillMode',
  'willChange',
  // Filters & blend
  'filter',
  'backdropFilter',
  'mixBlendMode',
  // Interaction
  'pointerEvents',
  'userSelect',
  // Text extras
  'textOverflow',
  'whiteSpace',
  'wordBreak',
  'verticalAlign',
  'listStyleType',
  'listStylePosition',
  'textShadow',
  'textIndent',
  'lineClamp',
] as const

/** DOM id for scripting: user-defined customId or stable node.id. Refs and getElementById use this. */
export function getDomId(node: Node): string {
  const custom = node.props?.customId
  if (custom != null && String(custom).trim()) return String(custom).trim()
  return node.id
}

function parseTimeMs(raw: unknown, fallbackMs: number): number {
  const s = String(raw ?? '').trim()
  if (!s) return fallbackMs
  if (s.endsWith('ms')) {
    const n = Number(s.slice(0, -2).trim())
    return Number.isFinite(n) ? n : fallbackMs
  }
  if (s.endsWith('s')) {
    const n = Number(s.slice(0, -1).trim())
    return Number.isFinite(n) ? n * 1000 : fallbackMs
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : fallbackMs
}

function toCssMs(ms: number): string {
  return `${Math.max(0, Math.round(ms))}ms`
}

function normalizeAnimationTime(raw: unknown, fallback: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return fallback
  if (/^-?\d*\.?\d+$/.test(s)) return `${s}s`
  if (/^-?\d*\.?\d+(ms|s)$/i.test(s)) return s
  return fallback
}

/** Build inline style from CSS-like props (100% web-aligned for scripting and export) */
export function stylePropsToStyle(props: Record<string, unknown>): Record<string, string | number> {
  const p = props as Record<string, unknown>
  const style: Record<string, string | number> = {}
  for (const key of STYLE_PROP_KEYS) {
    const v = p[key]
    if (v == null || v === '') continue
    const str = String(v).trim()
    if (!str) continue
    style[key] = str
  }

  // Handle animationSequence: convert to CSS animation string
  const animSeq = p.animationSequence as any
  if (animSeq && animSeq.steps && Array.isArray(animSeq.steps) && animSeq.steps.length > 0) {
    const playMode = animSeq.playMode || 'sequential'
    const seqIterationsRaw = String(animSeq.sequenceIterationCount ?? '1').trim()
    const seqIterations = seqIterationsRaw === 'infinite' ? Infinity : Math.max(1, Number(seqIterationsRaw) || 1)
    const steps = animSeq.steps as Array<{ preset?: string; duration?: string; timingFunction?: string; delay?: string; iterationCount?: string; mode?: 'auto' | 'manual' }>
    const allManual = steps.length > 0 && steps.every((s) => (s.mode ?? 'auto') === 'manual')
    if (allManual) {
      style['--has-animation-sequence' as any] = playMode
      return style
    }

    let animations: string[] = []
    if (playMode === 'parallel') {
      const base = steps.map((step) => {
        const preset = step.preset || 'none'
        const duration = normalizeAnimationTime(step.duration, '0.5s')
        const timing = step.timingFunction || 'ease'
        const delay = normalizeAnimationTime(step.delay, '0s')
        const iteration = step.iterationCount || '1'
        return `${preset} ${duration} ${timing} ${delay} ${iteration} both`
      })
      animations = base
    } else {
      // Sequential mode: convert each step into a delayed animation in one CSS timeline.
      // For finite sequence loops we duplicate the whole timeline N times.
      const base: string[] = []
      let cycleMs = 0
      for (const step of steps) {
        const preset = step.preset || 'none'
        const durationRaw = normalizeAnimationTime(step.duration, '0.5s')
        const timing = step.timingFunction || 'ease'
        const delayRaw = normalizeAnimationTime(step.delay, '0s')
        const delayMs = parseTimeMs(delayRaw, 0)
        const durationMs = parseTimeMs(durationRaw, 500)
        const iterationRaw = String(step.iterationCount ?? '1').trim()
        const iterationCount = iterationRaw === 'infinite' ? Infinity : Math.max(1, Number(iterationRaw) || 1)
        const totalDelayMs = cycleMs + delayMs
        base.push(`${preset} ${durationRaw} ${timing} ${toCssMs(totalDelayMs)} ${iterationRaw} both`)
        if (Number.isFinite(iterationCount)) {
          cycleMs += delayMs + durationMs * iterationCount
        }
      }

      // Browser cannot natively loop an entire composed sequence forever as a single unit.
      // For "infinite", expand to a long-running repeated timeline so live auto-play behaves as expected.
      // This keeps CSS-only playback (no event trigger required) while avoiding unbounded CSS strings.
      const effectiveCycles = seqIterations === Infinity ? 240 : seqIterations
      for (let i = 0; i < effectiveCycles; i++) {
          const cycleOffsetMs = i * cycleMs
          for (const entry of base) {
            const parts = entry.split(' ')
            // Pattern: name duration timing delay iteration fillMode
            const name = parts[0]
            const duration = parts[1]
            const timing = parts[2]
            const delay = parts[3]
            const iteration = parts[4]
            const fill = parts[5]
            const delayMs = parseTimeMs(delay, 0)
            animations.push(`${name} ${duration} ${timing} ${toCssMs(delayMs + cycleOffsetMs)} ${iteration} ${fill}`)
          }
      }
    }

    const animationCss = animations.join(', ')
    if (animationCss) {
      style.animation = animationCss
      // Mark this element so animation event listeners can find it
      style['--has-animation-sequence' as any] = playMode
    }
  }

  return style
}


/** Box model only (width, height, padding, margin) – applied to every component so Layout tab always affects appearance */
function boxPropsToStyle(props: Record<string, unknown>): Record<string, string | number> {
  const p = props as Record<string, unknown>
  const style: Record<string, string | number> = {}
  const wRaw = p.width != null && String(p.width).trim() ? String(p.width).trim() : ''
  if (wRaw) style.width = /^\d+$/.test(wRaw) ? `${wRaw}px` : wRaw
  const hRaw = p.height != null && String(p.height).trim() ? String(p.height).trim() : ''
  if (hRaw) style.height = /^\d+$/.test(hRaw) ? `${hRaw}px` : hRaw
  if (p.padding != null) style.padding = typeof p.padding === 'number' ? `${p.padding}px` : String(p.padding)
  if (p.margin != null) style.margin = typeof p.margin === 'number' ? `${p.margin}px` : String(p.margin)
  return style
}

/** Merge layout + style props into one style object for DOM (scripting can override via element.style) */
export function nodePropsToStyle(props: Record<string, unknown>, includeLayout: boolean): Record<string, string | number> {
  const layout = includeLayout ? layoutPropsToStyle(props) : boxPropsToStyle(props)
  const style = stylePropsToStyle(props)
  return { ...layout, ...style }
}
