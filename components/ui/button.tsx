import { ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'


type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
variant?: 'primary' | 'secondary' | 'outline'
size?: 'sm' | 'md' | 'lg'
}


export default function Button({ variant = 'primary', size = 'md', className, ...props }: Props) {
const sizeCls = size === 'sm' ? 'h-9 px-3 text-sm' : size === 'lg' ? 'h-12 px-5 text-base' : 'h-10 px-4'
const variantCls = variant === 'secondary' ? 'btn-secondary' : variant === 'outline' ? 'btn-outline' : 'btn-primary'
return <button className={clsx('btn', sizeCls, variantCls, className)} {...props} />
}