import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { taskService } from "@/lib/services";

// Initialize Supabase client securely on the server
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This function handles PATCH requests to update a task
export async function PATCH(
  req: Request,
  { params }: { params: { taskId: string } }
) {
  try {
    const { userId } = await auth(); // Corrected: Added 'await' here
    const user = await currentUser();

    // 1. Check for authentication
    if (!userId || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Check if the user is an admin
    const isAdmin = user.publicMetadata?.role === 'admin';
    if (!isAdmin) {
      return new NextResponse("Forbidden: You do not have permission to edit tasks.", { status: 403 });
    }
    
    // 3. If user is an admin, proceed with the update
    const { taskId } = params;
    const updates = await req.json();

    const updatedTask = await taskService.updateTask(supabase, taskId, updates);

    return NextResponse.json(updatedTask);

  } catch (error) {
    console.error("[TASK_UPDATE_API]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

