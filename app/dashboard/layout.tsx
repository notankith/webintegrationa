import type React from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

/**
 * Dashboard Layout
 * 
 * Includes server-side auth check to ensure protected access
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/login?callbackUrl=/dashboard")
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
