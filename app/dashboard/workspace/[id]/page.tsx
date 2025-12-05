import { redirect } from "next/navigation"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { PostUploadWorkspace } from "@/components/editor/post-upload-workspace"
import { getCurrentUser } from "@/lib/auth"

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  
  const user = await getCurrentUser()
  const userId = user?.userId || "default-user"

  const db = await getDb()
  
  const upload = await db.collection("uploads").findOne({
    _id: new ObjectId(resolvedParams.id),
    user_id: userId
  })

  if (!upload) {
    console.log(`[Workspace] Upload not found. ID: ${resolvedParams.id}, User: ${userId}`)
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-card to-background px-4 py-10 md:px-10">
      <PostUploadWorkspace uploadId={upload._id.toString()} />
    </div>
  )
}
