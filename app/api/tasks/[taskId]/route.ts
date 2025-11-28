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
  // Fix: Type 'params' as a Promise
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { userId } = await auth(); 
    const user = await currentUser();

    // 1. Check for authentication
    if (!userId || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Check if the user is an admin OR superadmin
    const userRole = user.publicMetadata?.role;
    const isAuthorized = userRole === 'admin' || userRole === 'superadmin';

    if (!isAuthorized) {
      return new NextResponse("Forbidden: You do not have permission to edit tasks.", { status: 403 });
    }
    
    // 3. If user is authorized, proceed with the update
    // Fix: Await the params before using properties
    const { taskId } = await params;
    const updates = await req.json();

    const updatedTask = await taskService.updateTask(supabase, taskId, updates);

    return NextResponse.json(updatedTask);

  } catch (error) {
    console.error("[TASK_UPDATE_API]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}