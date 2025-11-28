import { NextResponse } from "next/server";
import * as msal from "@azure/msal-node";
import { auth, clerkClient } from "@clerk/nextjs/server"; // Import Clerk server helpers
import type { ClerkClient } from "@clerk/backend"; // Import ClerkClient type
import type { User, EmailAddress } from "@clerk/backend"; // Import specific types

// MSAL Configuration (remains the same)
const config = {
  auth: {
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
  },
};
const cca = new msal.ConfidentialClientApplication(config);

// Helper function to create an event (remains the same)
async function createGraphEvent(accessToken: string, userEmail: string, eventData: any) {
  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventData),
  });
  return response;
}

export async function POST(req: Request) {
  // Get the Clerk user session first and extract userId
  const session = await auth();
  const creatorUserId = session.userId; // Access userId directly

  if (!creatorUserId) {
      return NextResponse.json({ error: "Unauthorized - Clerk user not found." }, { status: 401 });
  }

  const { title, description, dueDate, assigneeEmail } = await req.json();

  if (!title || !dueDate || !assigneeEmail) {
    return NextResponse.json({ error: "Title, due date, and assignee email are required" }, { status: 400 });
  }

  try {
     // Get the Clerk client instance
     const client: ClerkClient = await clerkClient();
     // Get the creator's user details
     const creatorUser: User = await client.users.getUser(creatorUserId);
     // Find the primary email with explicit type for the parameter
     const creatorEmail = creatorUser?.emailAddresses?.find(
       (email: EmailAddress) => email.id === creatorUser.primaryEmailAddressId
     )?.emailAddress;

     if (!creatorEmail) {
        return NextResponse.json({ error: "Could not retrieve creator's email address." }, { status: 500 });
     }

    // Get an application-level access token for Microsoft Graph
    const tokenRequest = {
      scopes: ["https://graph.microsoft.com/.default"],
    };
    const tokenResponse = await cca.acquireTokenByClientCredential(tokenRequest);

    if (!tokenResponse || !tokenResponse.accessToken) {
      return NextResponse.json({ error: "Could not acquire access token" }, { status: 500 });
    }
    const accessToken = tokenResponse.accessToken;

    // --- Create Event for Assignee ---
    const assigneeEvent = {
      subject: title,
      body: { contentType: "HTML", content: description || `Task "${title}" assigned to you.` },
      start: { dateTime: `${dueDate}T09:00:00`, timeZone: "UTC" },
      end: { dateTime: `${dueDate}T10:00:00`, timeZone: "UTC" },
    };

    const assigneeResponse = await createGraphEvent(accessToken, assigneeEmail, assigneeEvent);

    if (!assigneeResponse.ok) {
      const errorData = await assigneeResponse.json();
      console.error("Graph API Error (Assignee):", errorData);
      // It's often better to still try creating the creator's event even if the assignee fails
      // return NextResponse.json({ error: `Failed to create event for assignee: ${assigneeEmail}` }, { status: assigneeResponse.status });
    }

    // --- Create Event for Creator ---
    const creatorEvent = {
      subject: `Task Assigned: ${title} (to ${assigneeEmail})`,
      body: { contentType: "HTML", content: description || `You assigned task "${title}" to ${assigneeEmail}.` },
      start: { dateTime: `${dueDate}T09:00:00`, timeZone: "UTC" },
      end: { dateTime: `${dueDate}T10:00:00`, timeZone: "UTC" },
      showAs: "Free", // Mark as free time for the creator
      isReminderOn: false // Don't remind the creator by default
    };

    const creatorResponse = await createGraphEvent(accessToken, creatorEmail, creatorEvent);

     if (!creatorResponse.ok) {
      const errorData = await creatorResponse.json();
      console.error("Graph API Error (Creator):", errorData);
       // Check if assignee event also failed
       if (!assigneeResponse.ok) {
         return NextResponse.json({ error: `Failed to create events for both assignee and creator.` }, { status: 500 });
       }
      return NextResponse.json({ message: `Event created for assignee, but failed for creator: ${creatorEmail}` }, { status: 207 }); // 207 Multi-Status
    }

     if (!assigneeResponse.ok) {
        return NextResponse.json({ message: `Event created for creator, but failed for assignee: ${assigneeEmail}` }, { status: 207 }); // 207 Multi-Status
     }

    return NextResponse.json({ message: "Events created successfully in both calendars" });

  } catch (error) {
    console.error("API Route Error:", error);
    if (error instanceof Error) {
       return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

