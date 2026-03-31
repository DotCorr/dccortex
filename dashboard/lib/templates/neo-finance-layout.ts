/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

// NeoFinance example app layout — embedded template
export const NEO_FINANCE_LAYOUT = {
  stateDefinitions: [
    { id: 'sd-tab', name: 'tab', initialValue: 'overview', type: 'string' },
    { id: 'sd-period', name: 'period', initialValue: 'Monthly', type: 'string' },
  ],
  dataSources: [],
  namedScripts: {},
  theme: {
    primary: '#6366f1',
    background: '#f1f5f9',
    text: '#0f172a',
    surface: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: '10px',
    borderRadiusSm: '6px',
    borderRadiusLg: '16px',
  },
  root: {
    id: 'r0', type: 'container',
    props: { flexDirection: 'row', width: '100%', height: '100%', padding: 0, gap: 0, margin: 0, minHeight: 0, overflow: 'hidden' },
    children: [
      {
        id: 'sb', type: 'aside',
        props: { width: '240px', height: '100%', flexDirection: 'column', padding: 0, gap: 0, margin: 0, minHeight: 0, backgroundColor: '#0f172a', overflow: 'hidden', collapsible: true },
        children: [
          {
            id: 'sb-logo', type: 'container',
            props: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, margin: 0, minHeight: 0, borderBottom: '1px solid #1e293b' },
            children: [
              { id: 'sb-logo-icon', type: 'icon', props: { icon: 'mdi:chart-arc-outline', size: 28, color: '#6366f1' }, children: [] },
              { id: 'sb-logo-text', type: 'text', props: { content: 'NeoFinance', variant: 'h3', color: '#f1f5f9', fontWeight: '700', fontSize: '18px' }, children: [] },
            ],
          },
          {
            id: 'sb-nav', type: 'container',
            props: { flexDirection: 'column', flex: '1', padding: 14, gap: 2, margin: 0, minHeight: 0, overflowY: 'auto' },
            children: [
              { id: 'sb-nav-lbl', type: 'text', props: { content: 'MAIN MENU', variant: 'caption', color: '#334155', fontSize: '10px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase' }, children: [] },
              { id: 'sb-sp0', type: 'spacer', props: { height: 10, width: '100%' }, children: [] },
              { id: 'nav-ov', type: 'container', props: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, margin: 0, minHeight: 0, borderRadius: '8px', cursor: 'pointer', backgroundColor: "{{state.tab}} === 'overview' ? 'rgba(99,102,241,0.18)' : 'transparent'", onClick: '{"action":"setState","stateKey":"tab","value":"overview"}' }, children: [
                { id: 'nav-ov-i', type: 'icon', props: { icon: 'mdi:view-dashboard-outline', size: 18, color: "{{state.tab}} === 'overview' ? '#a5b4fc' : '#475569'" }, children: [] },
                { id: 'nav-ov-t', type: 'text', props: { content: 'Overview', variant: 'body', fontSize: '14px', fontWeight: "{{state.tab}} === 'overview' ? '600' : '400'", color: "{{state.tab}} === 'overview' ? '#c7d2fe' : '#64748b'" }, children: [] },
              ]},
              { id: 'nav-an', type: 'container', props: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, margin: 0, minHeight: 0, borderRadius: '8px', cursor: 'pointer', backgroundColor: "{{state.tab}} === 'analytics' ? 'rgba(99,102,241,0.18)' : 'transparent'", onClick: '{"action":"setState","stateKey":"tab","value":"analytics"}' }, children: [
                { id: 'nav-an-i', type: 'icon', props: { icon: 'mdi:chart-line', size: 18, color: "{{state.tab}} === 'analytics' ? '#a5b4fc' : '#475569'" }, children: [] },
                { id: 'nav-an-t', type: 'text', props: { content: 'Analytics', variant: 'body', fontSize: '14px', fontWeight: "{{state.tab}} === 'analytics' ? '600' : '400'", color: "{{state.tab}} === 'analytics' ? '#c7d2fe' : '#64748b'" }, children: [] },
              ]},
              { id: 'nav-rp', type: 'container', props: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, margin: 0, minHeight: 0, borderRadius: '8px', cursor: 'pointer', backgroundColor: "{{state.tab}} === 'reports' ? 'rgba(99,102,241,0.18)' : 'transparent'", onClick: '{"action":"setState","stateKey":"tab","value":"reports"}' }, children: [
                { id: 'nav-rp-i', type: 'icon', props: { icon: 'mdi:file-chart-outline', size: 18, color: "{{state.tab}} === 'reports' ? '#a5b4fc' : '#475569'" }, children: [] },
                { id: 'nav-rp-t', type: 'text', props: { content: 'Reports', variant: 'body', fontSize: '14px', fontWeight: "{{state.tab}} === 'reports' ? '600' : '400'", color: "{{state.tab}} === 'reports' ? '#c7d2fe' : '#64748b'" }, children: [] },
              ]},
              { id: 'nav-st', type: 'container', props: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, margin: 0, minHeight: 0, borderRadius: '8px', cursor: 'pointer', backgroundColor: "{{state.tab}} === 'settings' ? 'rgba(99,102,241,0.18)' : 'transparent'", onClick: '{"action":"setState","stateKey":"tab","value":"settings"}' }, children: [
                { id: 'nav-st-i', type: 'icon', props: { icon: 'mdi:cog-outline', size: 18, color: "{{state.tab}} === 'settings' ? '#a5b4fc' : '#475569'" }, children: [] },
                { id: 'nav-st-t', type: 'text', props: { content: 'Settings', variant: 'body', fontSize: '14px', fontWeight: "{{state.tab}} === 'settings' ? '600' : '400'", color: "{{state.tab}} === 'settings' ? '#c7d2fe' : '#64748b'" }, children: [] },
              ]},
            ],
          },
          {
            id: 'sb-foot', type: 'container',
            props: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, margin: 0, minHeight: 0, borderTop: '1px solid #1e293b' },
            children: [
              { id: 'sb-foot-av', type: 'icon', props: { icon: 'mdi:account-circle', size: 34, color: '#6366f1' }, children: [] },
              { id: 'sb-foot-info', type: 'container', props: { flexDirection: 'column', flex: '1', gap: 1, padding: 0, margin: 0, minHeight: 0 }, children: [
                { id: 'sb-foot-nm', type: 'text', props: { content: 'Alex Johnson', variant: 'body', fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }, children: [] },
                { id: 'sb-foot-rl', type: 'text', props: { content: 'Administrator', variant: 'caption', fontSize: '11px', color: '#64748b' }, children: [] },
              ]},
              { id: 'sb-foot-out', type: 'icon', props: { icon: 'mdi:logout-variant', size: 16, color: '#475569' }, children: [] },
            ],
          },
        ],
      },
      {
        id: 'mn', type: 'container',
        props: { flex: '1', flexDirection: 'column', padding: 0, gap: 0, margin: 0, minHeight: 0, backgroundColor: '#f1f5f9', overflow: 'hidden' },
        children: [
          {
            id: 'mn-topbar', type: 'header',
            props: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 0, gap: 0, margin: 0, minHeight: 0, width: '100%', height: '60px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
            children: [
              { id: 'mn-tb-left', type: 'container', props: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 0, paddingLeft: 24, margin: 0, minHeight: 0 }, children: [
                { id: 'mn-tb-t-ov', type: 'text', props: { content: 'Dashboard Overview', variant: 'h3', fontSize: '17px', fontWeight: '600', color: '#0f172a', visibleWhen: "{{state.tab}} === 'overview'" }, children: [] },
                { id: 'mn-tb-t-an', type: 'text', props: { content: 'Analytics', variant: 'h3', fontSize: '17px', fontWeight: '600', color: '#0f172a', visibleWhen: "{{state.tab}} === 'analytics'" }, children: [] },
                { id: 'mn-tb-t-rp', type: 'text', props: { content: 'Reports', variant: 'h3', fontSize: '17px', fontWeight: '600', color: '#0f172a', visibleWhen: "{{state.tab}} === 'reports'" }, children: [] },
                { id: 'mn-tb-t-st', type: 'text', props: { content: 'Settings', variant: 'h3', fontSize: '17px', fontWeight: '600', color: '#0f172a', visibleWhen: "{{state.tab}} === 'settings'" }, children: [] },
              ]},
              { id: 'mn-tb-right', type: 'container', props: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 0, paddingRight: 24, margin: 0, minHeight: 0 }, children: [
                { id: 'mn-tb-period', type: 'dropdown', props: { label: '', options: 'Monthly,Quarterly,Yearly', value: '{{state.period}}', onChange: '{"action":"setState","stateKey":"period","value":"{{event.value}}"}' }, children: [] },
                { id: 'mn-tb-btn', type: 'button', props: { label: '+ New Report', variant: 'primary' }, children: [] },
              ]},
            ],
          },
          {
            id: 'mn-scroll', type: 'main',
            props: { flex: '1', flexDirection: 'column', padding: 24, gap: 24, margin: 0, minHeight: 0, overflowY: 'auto', width: '100%' },
            children: [
              {
                id: 'tab-ov', type: 'container',
                props: { flexDirection: 'column', gap: 20, padding: 0, margin: 0, minHeight: 0, visibleWhen: "{{state.tab}} === 'overview'" },
                children: [
                  { id: 'kpi-row', type: 'container', props: { flexDirection: 'row', gap: 16, padding: 0, margin: 0, minHeight: 0, flexWrap: 'wrap' }, children: [
                    { id: 'kpi-rev', type: 'container', props: { flexDirection: 'column', flex: '1', gap: 12, padding: 20, margin: 0, minHeight: 0, minWidth: '180px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                      { id: 'kpi-rev-top', type: 'container', props: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 0, gap: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'kpi-rev-lbl', type: 'text', props: { content: 'Total Revenue', variant: 'body', fontSize: '13px', color: '#64748b', fontWeight: '500' }, children: [] },
                        { id: 'kpi-rev-iw', type: 'container', props: { padding: 8, borderRadius: '8px', backgroundColor: 'rgba(99,102,241,0.1)', margin: 0, gap: 0, minHeight: 0 }, children: [{ id: 'kpi-rev-ic', type: 'icon', props: { icon: 'mdi:cash-multiple', size: 18, color: '#6366f1' }, children: [] }]},
                      ]},
                      { id: 'kpi-rev-val', type: 'text', props: { content: '$124,500', variant: 'h2', fontSize: '26px', fontWeight: '700', color: '#0f172a' }, children: [] },
                      { id: 'kpi-rev-trend', type: 'container', props: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'kpi-rev-ti', type: 'icon', props: { icon: 'mdi:trending-up', size: 14, color: '#10b981' }, children: [] },
                        { id: 'kpi-rev-tt', type: 'text', props: { content: '+12.4% vs last month', variant: 'caption', fontSize: '12px', color: '#10b981' }, children: [] },
                      ]},
                    ]},
                    { id: 'kpi-usr', type: 'container', props: { flexDirection: 'column', flex: '1', gap: 12, padding: 20, margin: 0, minHeight: 0, minWidth: '180px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                      { id: 'kpi-usr-top', type: 'container', props: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 0, gap: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'kpi-usr-lbl', type: 'text', props: { content: 'Active Users', variant: 'body', fontSize: '13px', color: '#64748b', fontWeight: '500' }, children: [] },
                        { id: 'kpi-usr-iw', type: 'container', props: { padding: 8, borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.1)', margin: 0, gap: 0, minHeight: 0 }, children: [{ id: 'kpi-usr-ic', type: 'icon', props: { icon: 'mdi:account-group-outline', size: 18, color: '#10b981' }, children: [] }]},
                      ]},
                      { id: 'kpi-usr-val', type: 'text', props: { content: '8,432', variant: 'h2', fontSize: '26px', fontWeight: '700', color: '#0f172a' }, children: [] },
                      { id: 'kpi-usr-trend', type: 'container', props: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'kpi-usr-ti', type: 'icon', props: { icon: 'mdi:trending-up', size: 14, color: '#10b981' }, children: [] },
                        { id: 'kpi-usr-tt', type: 'text', props: { content: '+8.1% vs last month', variant: 'caption', fontSize: '12px', color: '#10b981' }, children: [] },
                      ]},
                    ]},
                    { id: 'kpi-ord', type: 'container', props: { flexDirection: 'column', flex: '1', gap: 12, padding: 20, margin: 0, minHeight: 0, minWidth: '180px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                      { id: 'kpi-ord-top', type: 'container', props: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 0, gap: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'kpi-ord-lbl', type: 'text', props: { content: 'Total Orders', variant: 'body', fontSize: '13px', color: '#64748b', fontWeight: '500' }, children: [] },
                        { id: 'kpi-ord-iw', type: 'container', props: { padding: 8, borderRadius: '8px', backgroundColor: 'rgba(245,158,11,0.1)', margin: 0, gap: 0, minHeight: 0 }, children: [{ id: 'kpi-ord-ic', type: 'icon', props: { icon: 'mdi:shopping-outline', size: 18, color: '#f59e0b' }, children: [] }]},
                      ]},
                      { id: 'kpi-ord-val', type: 'text', props: { content: '1,840', variant: 'h2', fontSize: '26px', fontWeight: '700', color: '#0f172a' }, children: [] },
                      { id: 'kpi-ord-trend', type: 'container', props: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'kpi-ord-ti', type: 'icon', props: { icon: 'mdi:trending-down', size: 14, color: '#ef4444' }, children: [] },
                        { id: 'kpi-ord-tt', type: 'text', props: { content: '-3.2% vs last month', variant: 'caption', fontSize: '12px', color: '#ef4444' }, children: [] },
                      ]},
                    ]},
                    { id: 'kpi-cvr', type: 'container', props: { flexDirection: 'column', flex: '1', gap: 12, padding: 20, margin: 0, minHeight: 0, minWidth: '180px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                      { id: 'kpi-cvr-top', type: 'container', props: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 0, gap: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'kpi-cvr-lbl', type: 'text', props: { content: 'Conversion Rate', variant: 'body', fontSize: '13px', color: '#64748b', fontWeight: '500' }, children: [] },
                        { id: 'kpi-cvr-iw', type: 'container', props: { padding: 8, borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)', margin: 0, gap: 0, minHeight: 0 }, children: [{ id: 'kpi-cvr-ic', type: 'icon', props: { icon: 'mdi:percent-outline', size: 18, color: '#ef4444' }, children: [] }]},
                      ]},
                      { id: 'kpi-cvr-val', type: 'text', props: { content: '4.2%', variant: 'h2', fontSize: '26px', fontWeight: '700', color: '#0f172a' }, children: [] },
                      { id: 'kpi-cvr-trend', type: 'container', props: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'kpi-cvr-ti', type: 'icon', props: { icon: 'mdi:trending-up', size: 14, color: '#10b981' }, children: [] },
                        { id: 'kpi-cvr-tt', type: 'text', props: { content: '+0.6pp vs last month', variant: 'caption', fontSize: '12px', color: '#10b981' }, children: [] },
                      ]},
                    ]},
                  ]},
                  { id: 'ov-charts', type: 'container', props: { flexDirection: 'row', gap: 16, padding: 0, margin: 0, minHeight: 0, alignItems: 'stretch', flexWrap: 'wrap' }, children: [
                    { id: 'ov-line-card', type: 'container', props: { flexDirection: 'column', flex: '2', gap: 16, padding: 20, margin: 0, minHeight: 0, minWidth: '280px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                      { id: 'ov-line-hdr', type: 'container', props: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 0, gap: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'ov-line-tw', type: 'container', props: { flexDirection: 'column', gap: 4, padding: 0, margin: 0, minHeight: 0 }, children: [
                          { id: 'ov-line-ttl', type: 'text', props: { content: 'Revenue Trend', variant: 'h3', fontSize: '15px', fontWeight: '600', color: '#0f172a' }, children: [] },
                          { id: 'ov-line-sub', type: 'text', props: { content: 'Jan – Dec 2025', variant: 'caption', fontSize: '12px', color: '#94a3b8' }, children: [] },
                        ]},
                        { id: 'ov-line-badge', type: 'container', props: { padding: 6, paddingLeft: 10, paddingRight: 10, borderRadius: '20px', backgroundColor: 'rgba(16,185,129,0.1)', margin: 0, gap: 0, minHeight: 0 }, children: [
                          { id: 'ov-line-bt', type: 'text', props: { content: '↑ 18.4%', variant: 'caption', fontSize: '12px', color: '#10b981', fontWeight: '600' }, children: [] },
                        ]},
                      ]},
                      { id: 'ov-line-chart', type: 'lineChart', props: { data: '42000,55000,48000,65000,72000,68000,80000,75000,88000,92000,85000,98000', width: 400, height: 200, color: '#6366f1', showDots: true }, children: [] },
                    ]},
                    { id: 'ov-bar-card', type: 'container', props: { flexDirection: 'column', flex: '1', gap: 16, padding: 20, margin: 0, minHeight: 0, minWidth: '220px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                      { id: 'ov-bar-tw', type: 'container', props: { flexDirection: 'column', gap: 4, padding: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'ov-bar-ttl', type: 'text', props: { content: 'Monthly Traffic', variant: 'h3', fontSize: '15px', fontWeight: '600', color: '#0f172a' }, children: [] },
                        { id: 'ov-bar-sub', type: 'text', props: { content: 'Unique visitors', variant: 'caption', fontSize: '12px', color: '#94a3b8' }, children: [] },
                      ]},
                      { id: 'ov-bar-chart', type: 'barChart', props: { data: '45000,62000,58000,71000,80000,92000', width: 280, height: 200, color: '#10b981' }, children: [] },
                    ]},
                  ]},
                  { id: 'ov-tbl-card', type: 'container', props: { flexDirection: 'column', gap: 16, padding: 20, margin: 0, minHeight: 0, backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                    { id: 'ov-tbl-hdr', type: 'container', props: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 0, gap: 0, margin: 0, minHeight: 0 }, children: [
                      { id: 'ov-tbl-tw', type: 'container', props: { flexDirection: 'column', gap: 4, padding: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'ov-tbl-ttl', type: 'text', props: { content: 'Recent Transactions', variant: 'h3', fontSize: '15px', fontWeight: '600', color: '#0f172a' }, children: [] },
                        { id: 'ov-tbl-sub', type: 'text', props: { content: 'Last 10 transactions across all accounts', variant: 'caption', fontSize: '12px', color: '#94a3b8' }, children: [] },
                      ]},
                      { id: 'ov-tbl-vb', type: 'button', props: { label: 'View all', variant: 'ghost' }, children: [] },
                    ]},
                    { id: 'ov-tbl', type: 'table', props: { columns: 'Date,Description,Category,Amount,Status', rows: 'Mar 01 2026,Stripe payment received,Revenue,$4200,Completed\nMar 01 2026,AWS infrastructure,Infrastructure,-$1840,Completed\nFeb 28 2026,Google Ads campaign,Marketing,-$620,Completed\nFeb 28 2026,SaaS subscription renewals,Revenue,$8750,Completed\nFeb 27 2026,Contractor payout,Operations,-$3200,Pending\nFeb 27 2026,Shopify store sales,Revenue,$2340,Completed\nFeb 26 2026,Office supplies,Operations,-$280,Completed\nFeb 26 2026,Enterprise deal closed,Revenue,$18500,Completed\nFeb 25 2026,Software licenses,Tools,-$960,Completed\nFeb 25 2026,Referral commission,Revenue,$1120,Completed' }, children: [] },
                  ]},
                ],
              },
              {
                id: 'tab-an', type: 'container',
                props: { flexDirection: 'column', gap: 20, padding: 0, margin: 0, minHeight: 0, visibleWhen: "{{state.tab}} === 'analytics'" },
                children: [
                  { id: 'an-top-row', type: 'container', props: { flexDirection: 'row', gap: 16, padding: 0, margin: 0, minHeight: 0, flexWrap: 'wrap' }, children: [
                    { id: 'an-area-card', type: 'container', props: { flexDirection: 'column', flex: '2', gap: 16, padding: 20, margin: 0, minHeight: 0, minWidth: '280px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                      { id: 'an-area-ttl', type: 'text', props: { content: 'User Growth (Cumulative)', variant: 'h3', fontSize: '15px', fontWeight: '600', color: '#0f172a' }, children: [] },
                      { id: 'an-area-sub', type: 'text', props: { content: 'Total registered users over the last 12 months', variant: 'caption', fontSize: '12px', color: '#94a3b8' }, children: [] },
                      { id: 'an-area-chart', type: 'areaChart', props: { data: '1200,2100,3400,4800,5900,7200,8400,9100,10300,11800,13200,14800', width: 400, height: 200, color: '#6366f1' }, children: [] },
                    ]},
                    { id: 'an-pie-card', type: 'container', props: { flexDirection: 'column', flex: '1', gap: 16, padding: 20, margin: 0, minHeight: 0, minWidth: '220px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                      { id: 'an-pie-ttl', type: 'text', props: { content: 'Revenue by Category', variant: 'h3', fontSize: '15px', fontWeight: '600', color: '#0f172a' }, children: [] },
                      { id: 'an-pie-sub', type: 'text', props: { content: 'SaaS · Commerce · Consulting · Other', variant: 'caption', fontSize: '12px', color: '#94a3b8' }, children: [] },
                      { id: 'an-pie-chart', type: 'pieChart', props: { data: '42,28,18,12', width: 220, height: 200 }, children: [] },
                    ]},
                  ]},
                  { id: 'an-bot-row', type: 'container', props: { flexDirection: 'row', gap: 16, padding: 0, margin: 0, minHeight: 0, flexWrap: 'wrap' }, children: [
                    { id: 'an-dnt-card', type: 'container', props: { flexDirection: 'column', flex: '1', gap: 16, padding: 20, margin: 0, minHeight: 0, minWidth: '200px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                      { id: 'an-dnt-ttl', type: 'text', props: { content: 'Traffic Sources', variant: 'h3', fontSize: '15px', fontWeight: '600', color: '#0f172a' }, children: [] },
                      { id: 'an-dnt-sub', type: 'text', props: { content: 'Organic · Paid · Referral · Direct · Social', variant: 'caption', fontSize: '12px', color: '#94a3b8' }, children: [] },
                      { id: 'an-dnt-chart', type: 'doughnutChart', props: { data: '38,24,18,12,8', width: 220, height: 200, innerRadiusPercent: 55 }, children: [] },
                    ]},
                    { id: 'an-rdr-card', type: 'container', props: { flexDirection: 'column', flex: '1', gap: 16, padding: 20, margin: 0, minHeight: 0, minWidth: '200px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                      { id: 'an-rdr-ttl', type: 'text', props: { content: 'Performance Score', variant: 'h3', fontSize: '15px', fontWeight: '600', color: '#0f172a' }, children: [] },
                      { id: 'an-rdr-sub', type: 'text', props: { content: 'Speed · UX · SEO · Reliability · Security', variant: 'caption', fontSize: '12px', color: '#94a3b8' }, children: [] },
                      { id: 'an-rdr-chart', type: 'radarChart', props: { data: '88,76,92,84,79', width: 220, height: 220 }, children: [] },
                    ]},
                    { id: 'an-gge-card', type: 'container', props: { flexDirection: 'column', flex: '1', gap: 16, padding: 20, margin: 0, minHeight: 0, minWidth: '200px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                      { id: 'an-gge-ttl', type: 'text', props: { content: 'Monthly Goal Attainment', variant: 'h3', fontSize: '15px', fontWeight: '600', color: '#0f172a' }, children: [] },
                      { id: 'an-gge-sub', type: 'text', props: { content: '78 / 100 target achieved', variant: 'caption', fontSize: '12px', color: '#94a3b8' }, children: [] },
                      { id: 'an-gge-chart', type: 'gaugeChart', props: { value: 78, min: 0, max: 100, width: 200, height: 130, color: '#6366f1' }, children: [] },
                      { id: 'an-gge-row', type: 'container', props: { flexDirection: 'row', justifyContent: 'space-between', padding: 0, gap: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'an-gge-r1', type: 'text', props: { content: 'On track', variant: 'caption', fontSize: '12px', fontWeight: '600', color: '#10b981' }, children: [] },
                        { id: 'an-gge-r2', type: 'text', props: { content: '22% remaining', variant: 'caption', fontSize: '12px', color: '#94a3b8' }, children: [] },
                      ]},
                    ]},
                  ]},
                ],
              },
              {
                id: 'tab-rp', type: 'container',
                props: { flexDirection: 'column', gap: 20, padding: 0, margin: 0, minHeight: 0, visibleWhen: "{{state.tab}} === 'reports'" },
                children: [
                  { id: 'rp-filters', type: 'container', props: { flexDirection: 'row', gap: 12, padding: 16, margin: 0, minHeight: 0, backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', alignItems: 'center', flexWrap: 'wrap' }, children: [
                    { id: 'rp-flt-lbl', type: 'text', props: { content: 'Filter by:', variant: 'body', fontSize: '13px', color: '#64748b', fontWeight: '500' }, children: [] },
                    { id: 'rp-flt-period', type: 'dropdown', props: { label: '', options: 'All time,This month,Last quarter,This year' }, children: [] },
                    { id: 'rp-flt-type', type: 'dropdown', props: { label: '', options: 'All types,Revenue,Expenses,Refunds' }, children: [] },
                    { id: 'rp-flt-status', type: 'dropdown', props: { label: '', options: 'All statuses,Completed,Pending,Failed' }, children: [] },
                    { id: 'rp-flt-search', type: 'textInput', props: { label: '', placeholder: 'Search transactions...' }, children: [] },
                    { id: 'rp-flt-btn', type: 'button', props: { label: 'Export CSV', variant: 'outline' }, children: [] },
                  ]},
                  { id: 'rp-tbl-card', type: 'container', props: { flexDirection: 'column', gap: 16, padding: 20, margin: 0, minHeight: 0, backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                    { id: 'rp-tbl-hdr', type: 'container', props: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 0, gap: 0, margin: 0, minHeight: 0 }, children: [
                      { id: 'rp-tbl-ttl', type: 'text', props: { content: 'Full Transaction Report', variant: 'h3', fontSize: '15px', fontWeight: '600', color: '#0f172a' }, children: [] },
                      { id: 'rp-tbl-cnt', type: 'text', props: { content: '24 records', variant: 'caption', fontSize: '12px', color: '#94a3b8' }, children: [] },
                    ]},
                    { id: 'rp-tbl', type: 'table', props: { columns: 'ID,Date,Account,Description,Category,Amount,Currency,Status,Reference', rows: 'TXN-001,Mar 01 2026,Main Account,Stripe payment received,Revenue,$4200,USD,Completed,STR-44821\nTXN-002,Mar 01 2026,Infra Account,AWS infrastructure,Infrastructure,-$1840,USD,Completed,AWS-20310\nTXN-003,Feb 28 2026,Marketing,Google Ads campaign,Marketing,-$620,USD,Completed,GAD-88102\nTXN-004,Feb 28 2026,Main Account,SaaS subscription renewals,Revenue,$8750,USD,Completed,SUB-44433\nTXN-005,Feb 27 2026,Payroll,Contractor payout,Operations,-$3200,USD,Pending,PAY-91021\nTXN-006,Feb 27 2026,Main Account,Shopify store sales,Revenue,$2340,USD,Completed,SHP-33201\nTXN-007,Feb 26 2026,Ops,Office supplies,Operations,-$280,USD,Completed,INV-10021\nTXN-008,Feb 26 2026,Main Account,Enterprise deal closed,Revenue,$18500,USD,Completed,ENT-00821\nTXN-009,Feb 25 2026,Tools,Software licenses,Tools,-$960,USD,Completed,LIC-20210\nTXN-010,Feb 25 2026,Main Account,Referral commission,Revenue,$1120,USD,Completed,REF-40021' }, children: [] },
                  ]},
                ],
              },
              {
                id: 'tab-st', type: 'container',
                props: { flexDirection: 'column', gap: 20, padding: 0, margin: 0, minHeight: 0, visibleWhen: "{{state.tab}} === 'settings'" },
                children: [
                  { id: 'st-profile', type: 'container', props: { flexDirection: 'column', gap: 20, padding: 24, margin: 0, minHeight: 0, backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }, children: [
                    { id: 'st-prf-hdr', type: 'container', props: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 0, margin: 0, minHeight: 0, borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }, children: [
                      { id: 'st-prf-icon', type: 'icon', props: { icon: 'mdi:account-cog-outline', size: 22, color: '#6366f1' }, children: [] },
                      { id: 'st-prf-ttls', type: 'container', props: { flexDirection: 'column', gap: 2, padding: 0, margin: 0, minHeight: 0 }, children: [
                        { id: 'st-prf-ttl', type: 'text', props: { content: 'Profile Settings', variant: 'h3', fontSize: '15px', fontWeight: '600', color: '#0f172a' }, children: [] },
                        { id: 'st-prf-sub', type: 'text', props: { content: 'Manage your personal information and preferences', variant: 'caption', fontSize: '12px', color: '#94a3b8' }, children: [] },
                      ]},
                    ]},
                    { id: 'st-form-row1', type: 'container', props: { flexDirection: 'row', gap: 16, padding: 0, margin: 0, minHeight: 0 }, children: [
                      { id: 'st-fn', type: 'textInput', props: { label: 'First name', placeholder: 'Alex', value: 'Alex' }, children: [] },
                      { id: 'st-ln', type: 'textInput', props: { label: 'Last name', placeholder: 'Johnson', value: 'Johnson' }, children: [] },
                    ]},
                    { id: 'st-em', type: 'textInput', props: { label: 'Email address', placeholder: 'alex@example.com', value: 'alex@neofinance.io' }, children: [] },
                    { id: 'st-tz', type: 'dropdown', props: { label: 'Timezone', options: 'UTC,UTC+1,UTC+2,UTC−5 (EST),UTC−8 (PST)' }, children: [] },
                    { id: 'st-lang', type: 'dropdown', props: { label: 'Language', options: 'English,French,Spanish,German,Japanese' }, children: [] },
                    { id: 'st-notif', type: 'container', props: { flexDirection: 'column', gap: 10, padding: 0, margin: 0, minHeight: 0 }, children: [
                      { id: 'st-notif-lbl', type: 'text', props: { content: 'Notifications', variant: 'body', fontSize: '13px', fontWeight: '600', color: '#475569' }, children: [] },
                      { id: 'st-chk1', type: 'checkbox', props: { label: 'Email me on new transactions', checked: true }, children: [] },
                      { id: 'st-chk2', type: 'checkbox', props: { label: 'Weekly performance digest', checked: true }, children: [] },
                      { id: 'st-chk3', type: 'checkbox', props: { label: 'Alert on unusual activity', checked: true }, children: [] },
                      { id: 'st-chk4', type: 'checkbox', props: { label: 'Marketing & product updates', checked: false }, children: [] },
                    ]},
                    { id: 'st-actions', type: 'container', props: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', padding: 0, margin: 0, minHeight: 0 }, children: [
                      { id: 'st-cancel', type: 'button', props: { label: 'Cancel', variant: 'outline' }, children: [] },
                      { id: 'st-save', type: 'button', props: { label: 'Save changes', variant: 'primary' }, children: [] },
                    ]},
                  ]},
                ],
              },
            ],
          },
        ],
      },
    ],
  },
}
