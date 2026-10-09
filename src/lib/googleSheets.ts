import "server-only";

import { google } from "googleapis";

export const registrationHeaders = [
  "Team Name",
  "M1 Name", "M1 Email", "M1 Phone", "M1 USN",
  "M2 Name", "M2 Email", "M2 Phone", "M2 USN",
  "M3 Name", "M3 Email", "M3 Phone", "M3 USN",
  "M4 Name", "M4 Email", "M4 Phone", "M4 USN",
  "M5 Name", "M5 Email", "M5 Phone", "M5 USN",
  "M6 Name", "M6 Email", "M6 Phone", "M6 USN",
  "Registered At",
  "Record ID",
];

export const submissionHeaders = [
  "Team Name",
  "GitHub URL",
  "Live Demo URL",
  "Video Pitch URL",
  "Submission Notes",
  "Submitted At",
  "Record ID",
];

function getGoogleClients() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (rawKey) {
    // Strip leading/trailing double or single quotes added by .env parsers
    rawKey = rawKey.replace(/^["']|["']$/g, '');
    // Replace literal '\n' sequences with real newlines
    rawKey = rawKey.replace(/\\n/g, '\n');
  }

  const key = rawKey;

  if (!email || !key) {
    throw new Error("Missing Google service account credentials.");
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  return {
    drive: google.drive({ version: "v3", auth }),
    sheets: google.sheets({ version: "v4", auth }),
  };
}

export async function createEventSpreadsheet(eventTitle: string) {
  const folderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  if (!folderId) throw new Error("Missing GOOGLE_DRIVE_PARENT_FOLDER_ID.");

  const { drive, sheets } = getGoogleClients();
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `${eventTitle} - Data` },
      sheets: [
        { properties: { title: "Registrations" } },
        { properties: { title: "Submissions" } },
      ],
    },
    fields: "spreadsheetId,sheets.properties.sheetId,sheets.properties.title",
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Google did not return a spreadsheet ID.");

  try {
    const file = await drive.files.get({ fileId: spreadsheetId, fields: "parents" });
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      removeParents: file.data.parents?.join(",") || undefined,
      fields: "id,parents",
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: "Registrations!A1:AA1", values: [registrationHeaders] },
          { range: "Submissions!A1:G1", values: [submissionHeaders] },
        ],
      },
    });
  } catch (error) {
    await deleteEventSpreadsheet(spreadsheetId).catch(() => undefined);
    throw error;
  }

  return spreadsheetId;
}

export async function deleteEventSpreadsheet(spreadsheetId: string) {
  const { drive } = getGoogleClients();
  await drive.files.delete({ fileId: spreadsheetId });
}

export async function appendSheetRecordOnce({
  spreadsheetId,
  tabName,
  recordIdRange,
  recordId,
  row,
}: {
  spreadsheetId: string;
  tabName: "Registrations" | "Submissions";
  recordIdRange: string;
  recordId: string;
  row: (string | number | null)[];
}) {
  const { sheets } = getGoogleClients();
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: recordIdRange,
  });

  if (existing.data.values?.some(([value]) => value === recordId)) return false;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: tabName === "Registrations" ? "Registrations!A:AA" : "Submissions!A:G",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  return true;
}