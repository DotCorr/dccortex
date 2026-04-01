import Link from 'next/link'
import { Shield, Landmark, Lock, FileCheck2, Check, AlertTriangle, ArrowLeft } from 'lucide-react'

const claimSections = [
  {
    id: 'soc2-ready',
    icon: FileCheck2,
    title: 'SOC2-Adjacent Controls',
    summary: 'Controls aligned to SOC2 trust criteria, with evidence automation and release-gate validation in place.',
    implemented: [
      'OIDC SSO and RBAC enforcement are implemented across core API routes.',
      'Immutable audit log flow with retention automation is implemented.',
      'Backup, restore, and restore-drill scripts exist and are documented.',
      'Incident response runbook and evidence-pack generation are implemented.',
      'Release tag CI gate validates evidence pack structure automatically.',
    ],
    codePaths: [
      'dashboard/lib/audit.ts',
      'dashboard/lib/prisma.ts',
      'dashboard/app/api/projects/[id]/sync/route.ts',
      'dashboard/app/api/organizations/[id]/reusables/route.js',
      '.github/workflows/validate-evidence-pack.yml',
    ],
    evidencePaths: [
      'docs/enterprise/COMPLIANCE_CONTROL_MATRIX.md',
      'docs/enterprise/INCIDENT_RESPONSE_RUNBOOK.md',
      'docs/enterprise/CI_GATE_EVIDENCE_VALIDATION.md',
      'docs/enterprise/evidence/<release-tag>/',
    ],
    gaps: [
      'Formal third-party SOC2 audit is not completed yet.',
      'Supply-chain controls (SBOM + image signing + vuln gates) are still planned.',
      'Some control rows remain planned rather than verified for a release candidate.',
    ],
  },
  {
    id: 'fedramp-ready',
    icon: Landmark,
    title: 'FedRAMP-Ready Path',
    summary: 'Documentation and operational scaffolding are prepared for ATO-style implementation and security review workflows.',
    implemented: [
      'Structured enterprise policy set is in place under enterprise docs.',
      'Incident response and operational runbooks exist with clear role ownership.',
      'Evidence-pack folder standards support traceable release artifact collection.',
      'Compliance matrix maps controls and ownership for phased closure.',
    ],
    codePaths: [
      'docs/enterprise/policies/ACCESS_CONTROL_POLICY.md',
      'docs/enterprise/policies/INCIDENT_RESPONSE_POLICY.md',
      'docs/enterprise/policies/BACKUP_RECOVERY_POLICY.md',
      'scripts/ops/generate-enterprise-evidence-pack.sh',
    ],
    evidencePaths: [
      'docs/enterprise/RELEASE_ENTERPRISE_SELF_HOST_1_0.md',
      'docs/enterprise/OPERATOR_GUIDE.md',
      'docs/enterprise/evidence/<release-tag>/release/gate-status-template.md',
    ],
    gaps: [
      'FedRAMP authorization itself is not in place.',
      'ATO requires additional federal-specific controls, SSP, and assessor workflow.',
      'Continuous monitoring and POA&M processes need formal operational cadence.',
    ],
  },
  {
    id: 'nist-aligned',
    icon: Lock,
    title: 'NIST-Aligned',
    summary: 'Current controls are mapped to NIST SP 800-53 style domains in your matrix and release process.',
    implemented: [
      'Control matrix includes access, audit, incident response, contingency, and system integrity domains.',
      'Each control row includes owner, evidence type, and implementation status.',
      'Release-gate artifacts are organized to support repeatable domain verification.',
    ],
    codePaths: [
      'docs/enterprise/COMPLIANCE_CONTROL_MATRIX.md',
      'docs/enterprise/README.md',
      'docs/enterprise/RELEASE_ENTERPRISE_SELF_HOST_1_0.md',
    ],
    evidencePaths: [
      'docs/enterprise/evidence/<release-tag>/security/',
      'docs/enterprise/evidence/<release-tag>/iam/',
      'docs/enterprise/evidence/<release-tag>/ops/',
      'docs/enterprise/evidence/<release-tag>/release/',
    ],
    gaps: [
      'Not all mapped controls are marked implemented yet.',
      'A release-by-release verified status process is needed for full maturity.',
      'External assessor validation is not yet performed.',
    ],
  },
  {
    id: 'enterprise-controls',
    icon: Shield,
    title: 'Enterprise Controls',
    summary: 'Core enterprise controls are in code today: OIDC, RBAC, audit logging, backup/restore, incident operations.',
    implemented: [
      'OIDC and permission-based RBAC checks are active in protected routes.',
      'Audit events capture actor/action/status/target with immutable storage behavior.',
      'Backup and restore scripts include safety checks and validation drill workflow.',
      'Security headers are configured in Next.js edge configuration.',
      'Evidence gate runs on release tags to block incomplete evidence packages.',
    ],
    codePaths: [
      'dashboard/lib/auth.ts',
      'dashboard/lib/permissions.ts',
      'dashboard/lib/audit.ts',
      'dashboard/lib/prisma.ts',
      'dashboard/next.config.js',
      'scripts/ops/backup-postgres.sh',
      'scripts/ops/restore-postgres.sh',
      'scripts/ops/backup-restore-drill.sh',
      '.github/workflows/validate-evidence-pack.yml',
    ],
    evidencePaths: [
      'scripts/README.md',
      'docs/enterprise/INCIDENT_RESPONSE_RUNBOOK.md',
      'docs/enterprise/CI_GATE_EVIDENCE_VALIDATION.md',
    ],
    gaps: [
      'SBOM generation and image-signing enforcement are still pending.',
      'Formal encryption-at-rest evidence package is pending.',
      'Air-gapped release gate validation still needs final verification run.',
    ],
  },
]

export default function TrustPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-4 h-4" />
            Back to Landing
          </Link>
          <h1 className="mt-6 text-4xl font-black tracking-tight">Trust and Compliance Detail</h1>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            This page gives a transparent, implementation-first view of security controls, code coverage, and operational evidence.
            It is designed to help buyers, security reviewers, and procurement teams evaluate risk with clarity and confidence.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href="#soc2-ready" className="px-3 py-2 border border-border text-xs font-semibold uppercase tracking-wide hover:bg-muted">SOC2-Ready</a>
            <a href="#fedramp-ready" className="px-3 py-2 border border-border text-xs font-semibold uppercase tracking-wide hover:bg-muted">FedRAMP Path</a>
            <a href="#nist-aligned" className="px-3 py-2 border border-border text-xs font-semibold uppercase tracking-wide hover:bg-muted">NIST Aligned</a>
            <a href="#enterprise-controls" className="px-3 py-2 border border-border text-xs font-semibold uppercase tracking-wide hover:bg-muted">Enterprise Controls</a>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 border border-border bg-card">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Control Matrix</p>
            <p className="mt-2 text-3xl font-black">7 / 16</p>
            <p className="mt-1 text-sm text-muted-foreground">Implemented controls currently tracked</p>
          </div>
          <div className="p-4 border border-border bg-card">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Automation</p>
            <p className="mt-2 text-3xl font-black">5 / 5</p>
            <p className="mt-1 text-sm text-muted-foreground">Audit to release-evidence automation chain implemented</p>
          </div>
          <div className="p-4 border border-border bg-card">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Assurance</p>
            <p className="mt-2 text-3xl font-black">Transparent</p>
            <p className="mt-1 text-sm text-muted-foreground">Implemented controls and known gaps are disclosed in one place</p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20 space-y-8">
        {claimSections.map((section) => {
          const Icon = section.icon
          return (
            <article key={section.id} id={section.id} className="border border-border bg-card p-6">
              <div className="flex items-start gap-3">
                <Icon className="w-6 h-6 text-foreground mt-0.5" />
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground max-w-4xl">{section.summary}</p>
                </div>
              </div>

              <div className="mt-6 grid lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide">Implemented Today</h3>
                  <ul className="mt-3 space-y-2">
                    {section.implemented.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide">Known Gaps (Honest Status)</h3>
                  <ul className="mt-3 space-y-2">
                    {section.gaps.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6 grid lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide">Code Structure References</h3>
                  <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    {section.codePaths.map((path) => (
                      <li key={path} className="font-mono text-xs border border-border bg-muted px-2 py-1.5">{path}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide">Evidence and Policy References</h3>
                  <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    {section.evidencePaths.map((path) => (
                      <li key={path} className="font-mono text-xs border border-border bg-muted px-2 py-1.5">{path}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section className="border-t border-border bg-black text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold">Assurance Roadmap</h2>
          <p className="mt-3 text-sm text-neutral-300 max-w-4xl">
            Stage 1: maintain evidence-backed controls on every release. Stage 2: close remaining planned controls and enforce supply-chain gates in CI.
            Stage 3: continue quarterly drills and strengthen enterprise assurance for larger procurement requirements.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://github.com/DotCorr/dccortex/tree/feature/oidc-sso-slice/docs/enterprise"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-white text-xs font-semibold uppercase tracking-wide hover:bg-white hover:text-black transition-colors"
            >
              Open Enterprise Docs
            </a>
            <Link href="/" className="px-4 py-2 border border-white text-xs font-semibold uppercase tracking-wide hover:bg-white hover:text-black transition-colors">
              Return to Landing
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
