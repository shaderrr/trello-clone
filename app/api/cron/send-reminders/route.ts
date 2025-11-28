import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to calculate the next reminder time from now
function getNextReminderTime(reminderInterval: string): Date {
  const nextTime = new Date();
  switch (reminderInterval) {
    case "15 min":
      nextTime.setMinutes(nextTime.getMinutes() + 15);
      break;
    case "1 hour":
      nextTime.setHours(nextTime.getHours() + 1);
      break;
    case "3 hour":
      nextTime.setHours(nextTime.getHours() + 3);
      break;
  }
  return nextTime;
}

export async function GET() {
  try {
    const now = new Date();

    // 1. Find all active tasks whose next reminder time is in the past
    const { data: columns } = await supabase.from("columns").select("id").in("title", ["To Do", "In Progress"]);
    if (!columns) return NextResponse.json({ message: "No active columns found." });
    const activeColumnIds = columns.map(c => c.id);

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .in("column_id", activeColumnIds)
      .not("reminder", "eq", "none")
      .lte("next_reminder_at", now.toISOString());

    if (tasksError) throw tasksError;

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ message: "No reminders to send at this time." });
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    let remindersSentCount = 0;

    for (const task of tasks) {
      if (!task.assignee) continue;

      const dueDate = task.due_date ? new Date(task.due_date) : null;
      const isOverdue = dueDate && now > dueDate;

      // 2. Customize email content based on whether the task is overdue
      const subject = isOverdue ? `🔥 OVERDUE: ${task.title}` : `⏰ Reminder: ${task.title}`;
      const body = isOverdue
        ? `<p>This is a reminder that your task "<strong>${task.title}</strong>" is PAST its due date of ${dueDate?.toLocaleString()}. Please update its status.</p>`
        : `<p>This is your recurring reminder for the task: "<strong>${task.title}</strong>".</p>`;

      await transporter.sendMail({
        from: `"Trello Clone" <${process.env.EMAIL_USER}>`,
        to: task.assignee,
        subject: subject,
        html: `
          <div style="font-family: Poppins, sans-serif; padding: 20px;">
            <h2>Task Reminder</h2>
            ${body}
            <p><strong>Description:</strong> ${task.description || "No description provided"}</p>
          </div>
        `,
      });

      // 3. Reschedule the NEXT reminder
      const nextReminderTime = getNextReminderTime(task.reminder);
      await supabase
        .from("tasks")
        .update({ next_reminder_at: nextReminderTime.toISOString() })
        .eq("id", task.id);

      console.log(`Sent reminder for task: ${task.title}. Next is at ${nextReminderTime.toLocaleTimeString()}`);
      remindersSentCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${remindersSentCount} reminders.`,
    });
  } catch (error: any) {
    console.error("Cron job failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
