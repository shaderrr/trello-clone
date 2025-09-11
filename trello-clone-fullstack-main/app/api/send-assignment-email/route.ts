import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    // Parse incoming JSON data
    const { email, title, description } = await req.json();

    // Configure Nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail", // Or another email service/SMTP
      auth: {
        user: process.env.EMAIL_USER, // your email
        pass: process.env.EMAIL_PASS, // app password
      },
    });

    // Send email
    await transporter.sendMail({
      from: `"Trello Clone" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Task Assigned: ${title}`,
      html: `<h3>${title}</h3><p>${description}</p>`,
    });

    return NextResponse.json({ message: "Email sent successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error sending email" }, { status: 500 });
  }
}
