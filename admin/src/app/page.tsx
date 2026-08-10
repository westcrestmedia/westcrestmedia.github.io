import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth'

export default async function RootPage() {
  const user = await getCurrentSession()
  redirect(user && user.role === 'admin' ? '/admin' : '/login')
}