import { Breadcrumb } from '@/components/ui/breadcrumb'

export function PageHeader({ title, breadcrumb, actions }: { title: string, breadcrumb: React.ReactNode, actions: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {breadcrumb}
      </div>
      <div>
        {actions}
      </div>
    </div>
  )
}
