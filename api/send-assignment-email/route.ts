import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * POST /api/send-assignment-email
 * This API sends a ONE-TIME assignment notification when a new task is created.
 * ALL recurring reminders are handled by the separate cron job.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, title, description, dueDate } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Recipient email is required" },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const formattedDueDate = dueDate
      ? new Date(dueDate).toLocaleDateString()
      : "No due date";

    const assignmentMailOptions = {
      from: `"Trello Clone" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `✅ New Task Assigned: ${title}`,
      html: `
        <div style="font-family: Poppins, sans-serif; padding: 20px;">
          <h2 style="color: #007BFF;">You've been assigned a new task!</h2>
          <p><strong>Task:</strong> ${title}</p>
          <p><strong>Description:</strong> ${description || "No description provided"}</p>
          <p><strong>Due Date:</strong> ${formattedDueDate}</p>
        </div>
      `,
    };

    await transporter.sendMail(assignmentMailOptions);

    return NextResponse.json({
      success: true,
      message: "Assignment email sent successfully.",
    });

  } catch (error: any) {
    console.error("Error sending assignment email:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send assignment email" },
      { status: 500 }
    );
  }
}
