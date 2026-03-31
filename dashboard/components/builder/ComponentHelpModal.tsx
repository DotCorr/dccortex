/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useCallback, useEffect } from 'react'

type Props = {
  open: boolean
  componentType: string
  onClose: () => void
}

/* ── Tiny SVG diagram helpers ──────────────────────────────────────────────── */

function Arrow() {
  return (
    <div className="flex justify-center py-1">
      <svg width="24" height="20" viewBox="0 0 24 20" className="text-gray-400 dark:text-gray-500">
        <path d="M12 2 L12 14 M6 10 L12 16 L18 10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function FlowBox({ label, accent, icon }: { label: string; accent?: string; icon?: string }) {
  const bg = accent === 'blue' ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
    : accent === 'green' ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800'
    : accent === 'amber' ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
    : accent === 'purple' ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800'
    : accent === 'red' ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800'
    : 'bg-gray-50 dark:bg-[#161b22] border-gray-200 dark:border-[#30363d]'
  return (
    <div className={`rounded-lg border px-3 py-2 text-center text-xs font-medium ${bg}`}>
      {icon && <span className="mr-1.5">{icon}</span>}
      {label}
    </div>
  )
}

function FlowDiagram({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-stretch my-3 mx-auto max-w-[260px]">{children}</div>
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-start">
      <span className="shrink-0 w-5 h-5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold flex items-center justify-center mt-0.5">{n}</span>
      <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{children}</div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <code className="px-1 py-0.5 text-[10px] bg-gray-100 dark:bg-[#21262d] border border-gray-200 dark:border-[#30363d] rounded font-mono">{children}</code>
}

/* ── Help content per component type ───────────────────────────────────────── */

type HelpEntry = {
  title: string
  summary: string
  content: React.ReactNode
}

export function getHelp(type: string): HelpEntry | null {
  switch (type) {
    // ─── FILE UPLOAD ──────────────────────────────────────────────────────────
    case 'fileUpload':
      return {
        title: '📤 File Upload',
        summary: 'Let users pick files (images, PDFs, etc.) and upload them to your project.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>
                <strong>Drag the "File upload" component</strong> onto your canvas from the <em>Form</em> section in the left panel.
              </Step>
              <Step n={2}>
                <strong>Create a state variable</strong> to hold the uploaded file&apos;s URL. Go to the <em>State</em> section (bottom-left) and add a variable — for example <Kbd>imageUrl</Kbd> (type: string).
              </Step>
              <Step n={3}>
                <strong>Set up the upload action.</strong> Select the File Upload component, go to the <em>Events</em> tab, and on <strong>onChange</strong> add a step:
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>Action: <strong>📤 Upload file</strong></li>
                  <li>Store URL in: <strong>imageUrl</strong></li>
                  <li>Leave endpoint blank (uses your project&apos;s built-in storage)</li>
                </ul>
              </Step>
              <Step n={4}>
                <strong>Display the result.</strong> Add an <em>Image</em> component and set its <strong>URL</strong> to <Kbd>{'{{state.imageUrl}}'}</Kbd>. When a user uploads a file, the image appears automatically!
              </Step>
            </div>

            <FlowDiagram>
              <FlowBox icon="👤" label="User picks a file" accent="blue" />
              <Arrow />
              <FlowBox icon="📤" label="File auto-uploads to server" accent="amber" />
              <Arrow />
              <FlowBox icon="💾" label="URL saved to {{state.imageUrl}}" accent="green" />
              <Arrow />
              <FlowBox icon="🖼️" label="Image component shows the file" accent="purple" />
            </FlowDiagram>

            <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-1 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip — Loading state:</strong> Add a boolean state variable (e.g. <Kbd>isUploading</Kbd>) and select it as the "Loading state variable" in the upload action. You can then conditionally show a spinner with <Kbd>{'{{state.isUploading}}'}</Kbd>.</p>
              <p><strong>Tip — External APIs:</strong> To upload to an S3 bucket, Cloudflare R2, or any custom API, enter the upload endpoint URL in the "Custom endpoint" field instead of leaving it blank.</p>
              <p><strong>Tip — Multiple files:</strong> Enable the <em>multiple</em> checkbox. The state variable will receive an array of URLs instead of a single URL.</p>
            </div>
          </div>
        ),
      }

    // ─── TEXT INPUT ────────────────────────────────────────────────────────────
    case 'textInput':
      return {
        title: '✏️ Text Input',
        summary: 'A single-line text field — great for names, emails, search, etc.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>
                Drag <strong>Text input</strong> onto the canvas.
              </Step>
              <Step n={2}>
                <strong>Create a state variable</strong> (e.g. <Kbd>name</Kbd>) in the State section.
              </Step>
              <Step n={3}>
                In the <em>Events</em> tab, on <strong>onChange</strong>, add a <strong>Set state</strong> step:
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>State variable: <strong>name</strong></li>
                  <li>Value: <Kbd>{'{{event.value}}'}</Kbd></li>
                </ul>
              </Step>
              <Step n={4}>
                Now <Kbd>{'{{state.name}}'}</Kbd> always holds what the user typed. Bind it to any other component!
              </Step>
            </div>

            <FlowDiagram>
              <FlowBox icon="⌨️" label='User types "Hello"' accent="blue" />
              <Arrow />
              <FlowBox icon="⚡" label='onChange → Set state "name"' accent="amber" />
              <Arrow />
              <FlowBox icon="💾" label='{{state.name}} = "Hello"' accent="green" />
            </FlowDiagram>

            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip:</strong> Set <Kbd>{'{{state.name}}'}</Kbd> as the <em>value</em> prop for controlled input (keeps field and state in sync).</p>
            </div>
          </div>
        ),
      }

    // ─── NUMBER INPUT ─────────────────────────────────────────────────────────
    case 'numberInput':
      return {
        title: '🔢 Number Input',
        summary: 'A numeric field with up/down arrows — for quantities, prices, ages, etc.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Number input</strong> onto the canvas.</Step>
              <Step n={2}>Create a <em>number</em> type state variable (e.g. <Kbd>quantity</Kbd>).</Step>
              <Step n={3}>On <strong>onChange</strong>, add <strong>Set state</strong> → variable: <Kbd>quantity</Kbd>, value: <Kbd>{'{{event.value}}'}</Kbd>.</Step>
              <Step n={4}>Use <Kbd>{'{{state.quantity}}'}</Kbd> anywhere — text, conditions, calculations.</Step>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip:</strong> Works just like Text input but only accepts numbers.</p>
            </div>
          </div>
        ),
      }

    // ─── TEXTAREA ─────────────────────────────────────────────────────────────
    case 'textarea':
      return {
        title: '📝 Textarea',
        summary: 'A multi-line text area — for comments, descriptions, messages.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Textarea</strong> onto the canvas.</Step>
              <Step n={2}>Create a state variable (e.g. <Kbd>message</Kbd>).</Step>
              <Step n={3}>On <strong>onChange</strong>, add <strong>Set state</strong> → <Kbd>message</Kbd> = <Kbd>{'{{event.value}}'}</Kbd>.</Step>
              <Step n={4}>Set the <em>rows</em> prop to control height (default 4).</Step>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip:</strong> Same pattern as Text input — just multi-line.</p>
            </div>
          </div>
        ),
      }

    // ─── DROPDOWN ─────────────────────────────────────────────────────────────
    case 'dropdown':
      return {
        title: '📋 Dropdown',
        summary: 'A select menu — users pick one option from a list.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Dropdown</strong> onto the canvas.</Step>
              <Step n={2}>In the <em>Content</em> tab, set the <strong>options</strong> prop to a comma-separated list: <Kbd>Small,Medium,Large</Kbd></Step>
              <Step n={3}>Create a state variable (e.g. <Kbd>size</Kbd>).</Step>
              <Step n={4}>On <strong>onChange</strong>, <strong>Set state</strong> → <Kbd>size</Kbd> = <Kbd>{'{{event.value}}'}</Kbd>.</Step>
              <Step n={5}>Now <Kbd>{'{{state.size}}'}</Kbd> holds <em>&quot;Small&quot;</em>, <em>&quot;Medium&quot;</em>, or <em>&quot;Large&quot;</em>.</Step>
            </div>

            <FlowDiagram>
              <FlowBox icon="📋" label='User selects "Large"' accent="blue" />
              <Arrow />
              <FlowBox icon="💾" label='{{state.size}} = "Large"' accent="green" />
            </FlowDiagram>

            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip — Dynamic options:</strong> Bind the <em>options</em> prop to data: <Kbd>{'{{data.categories}}'}</Kbd>.</p>
            </div>
          </div>
        ),
      }

    // ─── CHECKBOX ─────────────────────────────────────────────────────────────
    case 'checkbox':
      return {
        title: '☑️ Checkbox',
        summary: 'A true/false toggle — for agreements, filters, settings.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Checkbox</strong> onto the canvas.</Step>
              <Step n={2}>Create a <em>boolean</em> state variable (e.g. <Kbd>agreed</Kbd>, initial: <Kbd>false</Kbd>).</Step>
              <Step n={3}>On <strong>onChange</strong>, <strong>Set state</strong> → <Kbd>agreed</Kbd> = <Kbd>{'{{event.checked}}'}</Kbd>.</Step>
              <Step n={4}>Use <Kbd>{'{{state.agreed}}'}</Kbd> in visibility conditions or to enable/disable a button.</Step>
            </div>

            <FlowDiagram>
              <FlowBox icon="☑️" label="User checks the box" accent="blue" />
              <Arrow />
              <FlowBox icon="💾" label="{{state.agreed}} = true" accent="green" />
            </FlowDiagram>
          </div>
        ),
      }

    // ─── TOGGLE ───────────────────────────────────────────────────────────────
    case 'toggle':
      return {
        title: '🔘 Toggle / Switch',
        summary: 'An on/off switch — for dark mode, notifications, features.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Toggle</strong> onto the canvas.</Step>
              <Step n={2}>Create a <em>boolean</em> state variable (e.g. <Kbd>darkMode</Kbd>).</Step>
              <Step n={3}>On <strong>onChange</strong>, <strong>Set state</strong> → <Kbd>darkMode</Kbd> = <Kbd>{'{{event.checked}}'}</Kbd>.</Step>
              <Step n={4}>Works just like Checkbox but looks like a switch.</Step>
            </div>
          </div>
        ),
      }

    // ─── RADIO GROUP ──────────────────────────────────────────────────────────
    case 'radioGroup':
      return {
        title: '🔘 Radio Group',
        summary: 'Pick one option from a set — for plan selection, rating, choices.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Radio group</strong> onto the canvas.</Step>
              <Step n={2}>Set the <strong>options</strong> prop: <Kbd>Free,Pro,Enterprise</Kbd></Step>
              <Step n={3}>Create a state variable (e.g. <Kbd>plan</Kbd>).</Step>
              <Step n={4}>On <strong>onChange</strong>, <strong>Set state</strong> → <Kbd>plan</Kbd> = <Kbd>{'{{event.value}}'}</Kbd>.</Step>
            </div>
          </div>
        ),
      }

    // ─── SLIDER ───────────────────────────────────────────────────────────────
    case 'slider':
      return {
        title: '🎚️ Slider',
        summary: 'A draggable range control — for volume, brightness, price filters.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Slider</strong> onto the canvas.</Step>
              <Step n={2}>Set <strong>min</strong>, <strong>max</strong>, and <strong>step</strong> in the Content tab.</Step>
              <Step n={3}>Create a <em>number</em> state variable (e.g. <Kbd>volume</Kbd>).</Step>
              <Step n={4}>On <strong>onChange</strong>, <strong>Set state</strong> → <Kbd>volume</Kbd> = <Kbd>{'{{event.value}}'}</Kbd>.</Step>
              <Step n={5}>Enable <em>showValue</em> to display the current number next to the slider.</Step>
            </div>
          </div>
        ),
      }

    // ─── DATE PICKER ──────────────────────────────────────────────────────────
    case 'datepicker':
      return {
        title: '📅 Date Picker',
        summary: 'Pick a date, time, or both — for bookings, deadlines, scheduling.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Date picker</strong> onto the canvas.</Step>
              <Step n={2}>Choose the <strong>type</strong>: Date, Date & Time, Time, or Month.</Step>
              <Step n={3}>Create a state variable (e.g. <Kbd>selectedDate</Kbd>).</Step>
              <Step n={4}>On <strong>onChange</strong>, <strong>Set state</strong> → <Kbd>selectedDate</Kbd> = <Kbd>{'{{event.value}}'}</Kbd>.</Step>
            </div>
          </div>
        ),
      }

    // ─── SEARCH INPUT ─────────────────────────────────────────────────────────
    case 'searchInput':
      return {
        title: '🔍 Search Input',
        summary: 'A search field with optional suggestions — for filtering lists, finding items.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Search input</strong> onto the canvas.</Step>
              <Step n={2}>Create a state variable (e.g. <Kbd>query</Kbd>).</Step>
              <Step n={3}>On <strong>onChange</strong>, <strong>Set state</strong> → <Kbd>query</Kbd> = <Kbd>{'{{event.value}}'}</Kbd>.</Step>
              <Step n={4}>Use <Kbd>{'{{state.query}}'}</Kbd> to filter a data repeater or drive API calls.</Step>
            </div>
          </div>
        ),
      }

    // ─── FORM WRAPPER ─────────────────────────────────────────────────────────
    case 'formWrapper':
      return {
        title: '📋 Form',
        summary: 'Groups form fields together — handles submit with a single event.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Form</strong> onto the canvas.</Step>
              <Step n={2}>Drop input components (text input, dropdown, etc.) <strong>inside</strong> it.</Step>
              <Step n={3}>On <strong>onSubmit</strong>, add your actions — save data, navigate, call an API, etc.</Step>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Note:</strong> Each input inside the form still stores its value in state individually. The form just groups them and fires a single submit event.</p>
            </div>
          </div>
        ),
      }

    // ─── BUTTON ───────────────────────────────────────────────────────────────
    case 'button':
      return {
        title: '🔲 Button',
        summary: 'A clickable button — triggers any action on click.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Button</strong> onto the canvas.</Step>
              <Step n={2}>Set the <strong>label</strong> text and pick a <strong>variant</strong> (Primary, Secondary, Outline, Ghost).</Step>
              <Step n={3}>In the <em>Events</em> tab, on <strong>onClick</strong>, add any action:
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li><strong>Navigate</strong> to another screen</li>
                  <li><strong>Set state</strong> to change a variable</li>
                  <li><strong>Run script</strong> to call an API</li>
                  <li><strong>Alert</strong> to show a message</li>
                  <li>… or chain multiple steps!</li>
                </ul>
              </Step>
            </div>

            <FlowDiagram>
              <FlowBox icon="👆" label="User clicks the button" accent="blue" />
              <Arrow />
              <FlowBox icon="⚡" label="Your actions run in order" accent="amber" />
              <Arrow />
              <FlowBox icon="✅" label="Navigate / update state / call API" accent="green" />
            </FlowDiagram>
          </div>
        ),
      }

    // ─── LINK ─────────────────────────────────────────────────────────────────
    case 'link':
      return {
        title: '🔗 Link',
        summary: 'A clickable text link — for navigation or external URLs.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Link</strong> onto the canvas.</Step>
              <Step n={2}>Set the <strong>label</strong> and the <strong>url</strong> (can be <Kbd>{'{{state.someUrl}}'}</Kbd>).</Step>
              <Step n={3}>For in-app navigation, use the <em>Events</em> tab with a <strong>Navigate</strong> action instead.</Step>
            </div>
          </div>
        ),
      }

    // ─── TEXT ──────────────────────────────────────────────────────────────────
    case 'text':
      return {
        title: '📄 Text',
        summary: 'Displays text — headings, paragraphs, labels, dynamic content.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Text</strong> onto the canvas.</Step>
              <Step n={2}>Set the <strong>content</strong> to any static text or a binding: <Kbd>{'Hello {{state.name}}!'}</Kbd></Step>
              <Step n={3}>Choose a <strong>variant</strong> — Heading 1, Heading 2, Body, Caption, etc.</Step>
              <Step n={4}>Style it in the <em>Style</em> tab (color, font size, weight, etc.).</Step>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip:</strong> Bind the content to data: <Kbd>{'{{data.weather.temperature}}°C'}</Kbd> to display live values.</p>
            </div>
          </div>
        ),
      }

    // ─── IMAGE ────────────────────────────────────────────────────────────────
    case 'image':
      return {
        title: '🖼️ Image',
        summary: 'Displays an image — from a URL, asset library, or state variable.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Image</strong> onto the canvas.</Step>
              <Step n={2}>Set the <strong>URL</strong> — paste a link, click <em>Browse</em> to pick from project assets, or bind to state: <Kbd>{'{{state.imageUrl}}'}</Kbd>.</Step>
              <Step n={3}>Choose <strong>objectFit</strong> (Cover, Contain, Fill) to control how the image scales.</Step>
              <Step n={4}>Set <strong>width</strong> and <strong>height</strong> or use <Kbd>100%</Kbd> for responsive.</Step>
            </div>
          </div>
        ),
      }

    // ─── ICON ─────────────────────────────────────────────────────────────────
    case 'icon':
      return {
        title: '✦ Icon',
        summary: 'Any icon from Iconify — thousands of free icons.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Icon</strong> onto the canvas.</Step>
              <Step n={2}>Click <em>Browse</em> next to the icon prop to search and pick an icon (e.g. <Kbd>mdi:home</Kbd>, <Kbd>lucide:star</Kbd>).</Step>
              <Step n={3}>Set <strong>size</strong> and <strong>color</strong>.</Step>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip:</strong> Browse <a href="https://icon-sets.iconify.design/" target="_blank" rel="noopener" className="underline">icon-sets.iconify.design</a> to find icon names.</p>
            </div>
          </div>
        ),
      }

    // ─── TABLE ────────────────────────────────────────────────────────────────
    case 'table':
      return {
        title: '📊 Table',
        summary: 'Displays tabular data — from static values or data sources.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Table</strong> onto the canvas.</Step>
              <Step n={2}>Set <strong>columns</strong> as a comma list: <Kbd>Name,Email,Role</Kbd></Step>
              <Step n={3}>Bind <strong>rows</strong> to your data: <Kbd>{'{{data.users}}'}</Kbd></Step>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip:</strong> Rows expects a JSON array. Each object&apos;s keys should match your column names.</p>
            </div>
          </div>
        ),
      }

    // ─── CONTAINER / LAYOUT ───────────────────────────────────────────────────
    case 'container':
    case 'section':
    case 'stackV':
    case 'stackH':
    case 'header':
    case 'main':
    case 'footer':
    case 'nav':
    case 'aside':
    case 'article':
      return {
        title: '📦 Layout Container',
        summary: 'A box that holds other components — arranges them in rows or columns.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag a layout component onto the canvas (Container, Stack, Header, etc.).</Step>
              <Step n={2}><strong>Drop other components inside it</strong> — they&apos;ll stack vertically or horizontally based on the <em>flex direction</em>.</Step>
              <Step n={3}>Use the <em>Style</em> tab to control:
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li><strong>Flex direction</strong> — Row (side by side) or Column (stacked)</li>
                  <li><strong>Align items</strong> — Start, Center, End, Stretch</li>
                  <li><strong>Justify content</strong> — Start, Center, Space between</li>
                  <li><strong>Gap</strong> — Spacing between children</li>
                </ul>
              </Step>
            </div>

            <FlowDiagram>
              <FlowBox icon="📦" label="Container (direction: row)" accent="blue" />
              <div className="flex gap-2 justify-center my-2">
                <div className="rounded border border-dashed border-gray-300 dark:border-[#30363d] px-3 py-2 text-[10px] text-gray-500">Child 1</div>
                <div className="rounded border border-dashed border-gray-300 dark:border-[#30363d] px-3 py-2 text-[10px] text-gray-500">Child 2</div>
                <div className="rounded border border-dashed border-gray-300 dark:border-[#30363d] px-3 py-2 text-[10px] text-gray-500">Child 3</div>
              </div>
            </FlowDiagram>

            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip:</strong> Use <em>Stack (vertical)</em> for vertical lists and <em>Stack (horizontal)</em> for rows. They&apos;re just containers with pre-set direction.</p>
            </div>
          </div>
        ),
      }

    // ─── DIVIDER ──────────────────────────────────────────────────────────────
    case 'divider':
      return {
        title: '➖ Divider',
        summary: 'A horizontal or vertical line — separates content sections.',
        content: (
          <div className="space-y-2.5">
            <Step n={1}>Drag <strong>Divider</strong> onto the canvas.</Step>
            <Step n={2}>Set <strong>orientation</strong> (horizontal/vertical), <strong>thickness</strong>, and <strong>color</strong>.</Step>
          </div>
        ),
      }

    // ─── SPACER ───────────────────────────────────────────────────────────────
    case 'spacer':
      return {
        title: '⬜ Spacer',
        summary: 'Invisible spacing — pushes components apart.',
        content: (
          <div className="space-y-2.5">
            <Step n={1}>Drag <strong>Spacer</strong> where you need empty space.</Step>
            <Step n={2}>Set <strong>width</strong> and <strong>height</strong> to control the gap size.</Step>
          </div>
        ),
      }

    // ─── GESTURE DETECTOR ─────────────────────────────────────────────────────
    case 'gestureDetector':
      return {
        title: '👆 Gesture Detector',
        summary: 'Makes any component tappable with touch feedback — wraps children.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Gesture detector</strong> onto the canvas.</Step>
              <Step n={2}><strong>Drop any component inside it</strong> — it becomes tappable.</Step>
              <Step n={3}>Choose <strong>behavior</strong> — Opacity (dims on press), Scale (shrinks), or None.</Step>
              <Step n={4}>Add actions on <strong>onClick</strong>, <strong>onPressIn</strong>, <strong>onPressOut</strong>, etc.</Step>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip:</strong> Use this to make cards, images, or any group of components clickable with a nice press animation.</p>
            </div>
          </div>
        ),
      }

    // ─── DATA REPEATER ────────────────────────────────────────────────────────
    case 'dataRepeater':
      return {
        title: '🔁 Data Repeater',
        summary: 'Loops over data and repeats its children for each item — like a for-each.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Data repeater</strong> onto the canvas.</Step>
              <Step n={2}>Set the <strong>data</strong> prop to your data source: <Kbd>{'{{data.posts}}'}</Kbd></Step>
              <Step n={3}><strong>Drop components inside it</strong> — they become the template for each item.</Step>
              <Step n={4}>Inside the children, use <Kbd>{'{{prop.item.title}}'}</Kbd>, <Kbd>{'{{prop.item.image}}'}</Kbd>, etc. to access fields from each data item.</Step>
            </div>

            <FlowDiagram>
              <FlowBox icon="📦" label='data = {{data.posts}} → 3 items' accent="blue" />
              <Arrow />
              <div className="space-y-1">
                <div className="rounded border border-dashed border-purple-300 dark:border-purple-800 px-3 py-1.5 text-[10px] text-purple-600 dark:text-purple-400">Item 1: {'{{prop.item.title}}'} → &quot;First Post&quot;</div>
                <div className="rounded border border-dashed border-purple-300 dark:border-purple-800 px-3 py-1.5 text-[10px] text-purple-600 dark:text-purple-400">Item 2: {'{{prop.item.title}}'} → &quot;Second Post&quot;</div>
                <div className="rounded border border-dashed border-purple-300 dark:border-purple-800 px-3 py-1.5 text-[10px] text-purple-600 dark:text-purple-400">Item 3: {'{{prop.item.title}}'} → &quot;Third Post&quot;</div>
              </div>
            </FlowDiagram>

            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip:</strong> The repeater also gives you <Kbd>{'{{prop.index}}'}</Kbd> (0, 1, 2…) for the position of each item.</p>
            </div>
          </div>
        ),
      }

    // ─── REUSABLE INSTANCE ────────────────────────────────────────────────────
    case 'reusableInstance':
      return {
        title: '♻️ Reusable Instance',
        summary: 'A copy of a reusable component — edit the source once, all instances update.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>First, create a <strong>Reusable component</strong> in the Reusables panel (bottom-left).</Step>
              <Step n={2}>Drag <strong>Reusable instance</strong> onto the canvas.</Step>
              <Step n={3}>Pick which reusable component to use.</Step>
              <Step n={4}>Pass different <strong>props</strong> to each instance — so the same component can show different data.</Step>
            </div>

            <FlowDiagram>
              <FlowBox icon="🧩" label='Reusable: "ProductCard"' accent="purple" />
              <Arrow />
              <div className="flex gap-2 justify-center">
                <div className="rounded border border-dashed border-green-300 dark:border-green-800 px-2 py-1 text-[10px] text-green-600 dark:text-green-400">Instance A<br/>name=&quot;Phone&quot;</div>
                <div className="rounded border border-dashed border-green-300 dark:border-green-800 px-2 py-1 text-[10px] text-green-600 dark:text-green-400">Instance B<br/>name=&quot;Laptop&quot;</div>
                <div className="rounded border border-dashed border-green-300 dark:border-green-800 px-2 py-1 text-[10px] text-green-600 dark:text-green-400">Instance C<br/>name=&quot;Tablet&quot;</div>
              </div>
            </FlowDiagram>
          </div>
        ),
      }

    // ─── CHARTS ───────────────────────────────────────────────────────────────
    case 'lineChart':
    case 'barChart':
    case 'pieChart':
    case 'areaChart':
    case 'doughnutChart':
    case 'horizontalBarChart':
    case 'stackedBarChart':
    case 'scatterChart':
    case 'radarChart':
    case 'gaugeChart':
    case 'funnelChart':
    case 'stepLineChart':
    case 'heatmapChart':
    case 'bubbleChart':
      return {
        title: '📈 Chart',
        summary: 'Visualizes data — line, bar, pie, area, and more.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag any <strong>Chart</strong> type onto the canvas.</Step>
              <Step n={2}>Set the <strong>data</strong> prop — comma-separated numbers: <Kbd>10,20,30,40,50</Kbd></Step>
              <Step n={3}>Adjust <strong>width</strong>, <strong>height</strong>, and <strong>color</strong> in the Content/Style tabs.</Step>
              <Step n={4}>For live data, bind to a data source: <Kbd>{'{{data.analytics.values}}'}</Kbd></Step>
            </div>

            <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip — Scatter chart:</strong> Uses <Kbd>x,y|x,y</Kbd> format: <Kbd>10,20|25,45|40,35</Kbd></p>
              <p><strong>Tip — Stacked bar:</strong> Has separate <Kbd>dataA</Kbd>, <Kbd>dataB</Kbd>, <Kbd>dataC</Kbd> props for each series.</p>
              <p><strong>Tip — Heatmap:</strong> Uses grid format with <Kbd>|</Kbd> as row separator: <Kbd>2,5,8|4,9,3</Kbd></p>
            </div>
          </div>
        ),
      }

    // ─── VIDEO ────────────────────────────────────────────────────────────────
    case 'video':
      return {
        title: '🎬 Video',
        summary: 'Embeds a video player — from a URL or project assets.',
        content: (
          <div className="space-y-2.5">
            <Step n={1}>Drag <strong>Video</strong> onto the canvas.</Step>
            <Step n={2}>Set the <strong>src</strong> — paste a URL or click <em>Browse</em> for project assets.</Step>
            <Step n={3}>Optionally set a <strong>poster</strong> (thumbnail image shown before play).</Step>
          </div>
        ),
      }

    // ─── AVATAR ───────────────────────────────────────────────────────────────
    case 'avatar':
      return {
        title: '👤 Avatar',
        summary: 'A circular profile image — with fallback initials.',
        content: (
          <div className="space-y-2.5">
            <Step n={1}>Drag <strong>Avatar</strong> onto the canvas.</Step>
            <Step n={2}>Set <strong>src</strong> to an image URL or <Kbd>{'{{state.profilePic}}'}</Kbd>.</Step>
            <Step n={3}>Set <strong>fallback</strong> text (e.g. <Kbd>JD</Kbd>) — shown when no image loads.</Step>
          </div>
        ),
      }

    // ─── EMBED ────────────────────────────────────────────────────────────────
    case 'embed':
      return {
        title: '🌐 Embed (iframe)',
        summary: 'Embeds any external page — maps, videos, dashboards.',
        content: (
          <div className="space-y-2.5">
            <Step n={1}>Drag <strong>Embed</strong> onto the canvas.</Step>
            <Step n={2}>Set the <strong>src</strong> to any URL (Google Maps, YouTube, external dashboard, etc.).</Step>
            <Step n={3}>Adjust <strong>width</strong> and <strong>height</strong>.</Step>
          </div>
        ),
      }

    // ─── MAP ──────────────────────────────────────────────────────────────────
    case 'map':
      return {
        title: '🗺️ Map',
        summary: 'Interactive map — show a location with coordinates.',
        content: (
          <div className="space-y-2.5">
            <Step n={1}>Drag <strong>Map</strong> onto the canvas.</Step>
            <Step n={2}>Set <strong>latitude</strong> and <strong>longitude</strong> (or bind to state/data).</Step>
            <Step n={3}>Set <strong>zoom</strong> level (1 = whole world, 18 = street level).</Step>
          </div>
        ),
      }

    // ─── ALERT BANNER ──────────────────────────────────────────────────────
    case 'alertBanner':
      return {
        title: '🔔 Alert / Banner',
        summary: 'A dismissible notification banner — for success messages, errors, warnings, info.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>
                <strong>Create a boolean state variable</strong> to control the alert&apos;s visibility. Go to the <em>State</em> section and add one — e.g. <Kbd>showAlert</Kbd> (type: boolean, initial: <Kbd>false</Kbd>).
              </Step>
              <Step n={2}>
                <strong>Drag the &quot;Alert / Banner&quot;</strong> component onto your canvas.
              </Step>
              <Step n={3}>
                <strong>Set the visibility condition.</strong> In the <em>Visibility</em> section (top of the properties), set <strong>Show when</strong> to:
                <div className="mt-1"><Kbd>{'{{state.showAlert}}'}</Kbd></div>
              </Step>
              <Step n={4}>
                <strong>Set the content.</strong> In the <em>Content</em> tab, set:
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li><strong>Title</strong> (optional) — e.g. &quot;Success!&quot;</li>
                  <li><strong>Message</strong> — e.g. &quot;Your file was saved.&quot;</li>
                  <li><strong>Variant</strong> — Info, Success, Warning, or Error</li>
                </ul>
              </Step>
              <Step n={5}>
                <strong>Wire up the dismiss button.</strong> In the <em>Events</em> tab, on <strong>onDismiss</strong>, add:
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>Action: <strong>Set state</strong></li>
                  <li>Variable: <Kbd>showAlert</Kbd></li>
                  <li>Value: <Kbd>false</Kbd></li>
                </ul>
              </Step>
              <Step n={6}>
                <strong>Trigger it.</strong> On a button somewhere, add an <strong>onClick</strong> action:
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li><strong>Set state</strong> → <Kbd>showAlert</Kbd> = <Kbd>true</Kbd></li>
                </ul>
              </Step>
            </div>

            <FlowDiagram>
              <FlowBox icon="👆" label='User clicks "Save" button' accent="blue" />
              <Arrow />
              <FlowBox icon="💾" label="showAlert = true" accent="amber" />
              <Arrow />
              <FlowBox icon="🔔" label="Alert banner appears!" accent="green" />
              <Arrow />
              <FlowBox icon="✕" label='User clicks dismiss → showAlert = false' accent="red" />
            </FlowDiagram>

            <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-1 border-t pt-3 border-gray-200 dark:border-[#30363d]">
              <p><strong>Tip — Dynamic message:</strong> Bind the message to state: <Kbd>{'{{state.alertMessage}}'}</Kbd> so you can change it from any event.</p>
              <p><strong>Tip — Auto-dismiss:</strong> There&apos;s no built-in auto-dismiss timer yet. You can approximate it with a script that setTimeout sets the state to false.</p>
            </div>
          </div>
        ),
      }

    // ─── BADGE ────────────────────────────────────────────────────────────────
    case 'badge':
      return {
        title: '🏷️ Badge',
        summary: 'A small label — for status, counts, tags.',
        content: (
          <div className="space-y-2.5">
            <Step n={1}>Drag <strong>Badge</strong> onto the canvas.</Step>
            <Step n={2}>Set the <strong>label</strong> text (e.g. <Kbd>New</Kbd>, <Kbd>{'{{state.count}}'}</Kbd>).</Step>
            <Step n={3}>Choose a <strong>variant</strong> — Default, Success, Warning, Danger, Info.</Step>
          </div>
        ),
      }

    // ─── PROGRESS ─────────────────────────────────────────────────────────────
    case 'progressBar':
      return {
        title: '📊 Progress Bar',
        summary: 'Shows completion — for loading, steps, quotas.',
        content: (
          <div className="space-y-2.5">
            <Step n={1}>Drag <strong>Progress bar</strong> onto the canvas.</Step>
            <Step n={2}>Bind <strong>value</strong> to a number state (0–100): <Kbd>{'{{state.progress}}'}</Kbd></Step>
            <Step n={3}>Optionally enable <strong>showLabel</strong> to display the percentage.</Step>
          </div>
        ),
      }

    // ─── ACCORDION ────────────────────────────────────────────────────────────
    case 'accordion':
      return {
        title: '🪗 Accordion',
        summary: 'Collapsible sections — for FAQs, settings, grouped content.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Accordion</strong> onto the canvas.</Step>
              <Step n={2}>Set <strong>items</strong> as JSON: each item has a <Kbd>title</Kbd> and <Kbd>content</Kbd>.</Step>
              <Step n={3}>Choose <strong>allowMultiple</strong> to let users open several sections at once.</Step>
            </div>
          </div>
        ),
      }

    // ─── TABS ─────────────────────────────────────────────────────────────────
    case 'tabs':
      return {
        title: '📑 Tabs',
        summary: 'Switchable content views — for categories, settings sections.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Drag <strong>Tabs</strong> onto the canvas.</Step>
              <Step n={2}>Set <strong>tabs</strong> as comma-separated labels: <Kbd>General,Profile,Security</Kbd></Step>
              <Step n={3}>Drop components inside — each tab&apos;s content is managed separately.</Step>
            </div>
          </div>
        ),
      }

    // ─── TOOLTIP ──────────────────────────────────────────────────────────────
    case 'tooltip':
      return {
        title: '💬 Tooltip',
        summary: 'Shows a hint on hover — for extra info or guidance.',
        content: (
          <div className="space-y-2.5">
            <Step n={1}>Drag <strong>Tooltip</strong> onto the canvas.</Step>
            <Step n={2}>Drop a component inside it (e.g. an icon or button).</Step>
            <Step n={3}>Set the <strong>content</strong> — the text shown on hover.</Step>
          </div>
        ),
      }

    // ─── MODAL ────────────────────────────────────────────────────────────────
    case 'modal':
      return {
        title: '🪟 Modal',
        summary: 'A popup overlay — for confirmations, forms, details.',
        content: (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Step n={1}>Create a <em>boolean</em> state variable (e.g. <Kbd>showModal</Kbd>, initial: <Kbd>false</Kbd>).</Step>
              <Step n={2}>Drag <strong>Modal</strong> onto the canvas and set its <strong>Show when</strong> to <Kbd>{'{{state.showModal}}'}</Kbd>.</Step>
              <Step n={3}>Drop content inside the modal.</Step>
              <Step n={4}>Add a button that <strong>Set state</strong> → <Kbd>showModal</Kbd> = <Kbd>true</Kbd> to open it.</Step>
              <Step n={5}>Inside the modal, add a close button that sets <Kbd>showModal</Kbd> = <Kbd>false</Kbd>.</Step>
            </div>

            <FlowDiagram>
              <FlowBox icon="👆" label='Click "Open" button' accent="blue" />
              <Arrow />
              <FlowBox icon="💾" label="showModal = true" accent="amber" />
              <Arrow />
              <FlowBox icon="🪟" label="Modal appears!" accent="green" />
            </FlowDiagram>
          </div>
        ),
      }

    // ─── CARD ─────────────────────────────────────────────────────────────────
    case 'card':
      return {
        title: '🃏 Card',
        summary: 'A styled container with optional shadow — for product cards, profiles, info boxes.',
        content: (
          <div className="space-y-2.5">
            <Step n={1}>Drag <strong>Card</strong> onto the canvas.</Step>
            <Step n={2}>Drop components inside (image, text, button, etc.).</Step>
            <Step n={3}>Style with padding, border radius, and shadow in the <em>Style</em> tab.</Step>
          </div>
        ),
      }

    // ─── DEFAULT ──────────────────────────────────────────────────────────────
    default:
      return null
  }
}

/* ── The modal ─────────────────────────────────────────────────────────────── */

export function ComponentHelpModal({ open, componentType, onClose }: Props) {
  const help = getHelp(componentType)

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onKeyDown])

  if (!open || !help) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md max-h-[80vh] bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-xl shadow-2xl flex flex-col overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-[#30363d]">
          <div>
            <h2 className="text-sm font-semibold text-black dark:text-white">{help.title}</h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{help.summary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#21262d] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {help.content}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117]">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-3 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-80 transition-opacity"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
