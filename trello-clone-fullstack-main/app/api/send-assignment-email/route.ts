import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { email, title, description, reminder } = await req.json();

    if (reminder === "none") {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"Trello Clone" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Task Assigned: ${title}`,
        html: `<h3>${title}</h3><p>${description}</p>`,
      });

      return NextResponse.json({ message: "Email sent successfully" });
    } else {
      // Logic for handling scheduled reminders would go here.
      // For now, we will log a message to the console.
      console.log(`Reminder for task "${title}" is scheduled for assignee "${email}" with an interval of "${reminder}".`);
      return NextResponse.json({ message: "Reminder scheduled successfully" });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error sending email" }, { status: 500 });
  }
}
