import { Card, CardContent } from '../ui/card'
import { Skeleton } from '../ui/skeleton'


export default function HotelCardSkeleton() {
return (
<Card className="overflow-hidden">
<div className="grid grid-cols-1 sm:grid-cols-[220px_1fr]">
<Skeleton className="aspect-[4/3] sm:h-full" />
<CardContent>
<div className="space-y-3">
<Skeleton className="h-5 w-2/3" />
<Skeleton className="h-4 w-1/3" />
<Skeleton className="h-4 w-40" />
<div className="flex gap-2">
<Skeleton className="h-6 w-16" />
<Skeleton className="h-6 w-20" />
<Skeleton className="h-6 w-14" />
</div>
<div className="flex items-center justify-between">
<Skeleton className="h-4 w-24" />
<Skeleton className="h-9 w-28" />
</div>
</div>
</CardContent>
</div>
</Card>
)
}