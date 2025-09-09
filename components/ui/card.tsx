import { PropsWithChildren } from 'react'
import clsx from 'clsx'


type Props = PropsWithChildren<{ className?: string; hover?: boolean }>
export function Card({ className, hover, children }: Props) {
return <div className={clsx('card', hover && 'card-hover', className)}>{children}</div>
}


export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
return (
<div className="p-5 border-b">
<h3 className="text-lg font-semibold tracking-tight">{title}</h3>
{subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
</div>
)
}


export function CardContent({ children }: PropsWithChildren) {
return <div className="p-5">{children}</div>
}