import { DRIVE_APP_SOURCE, ensureOwnerCategoryFolder, type DriveFileRecord } from "@/lib/google-drive/client";
import type { ExpenseOwner } from "@/lib/bill-uploader/types";

const MULTIPART_BOUNDARY = "bill_uploader_sms_boundary";

export async function uploadTextFile(params: {
  text: string;
  filename: string;
  owner: ExpenseOwner;
  category: string;
  billDate: string;
}): Promise<DriveFileRecord> {
  const { folderId, accessToken } = await ensureOwnerCategoryFolder(params.owner, params.category);

  const metadata = {
    name: params.filename,
    parents: [folderId],
    mimeType: "text/plain",
    appProperties: {
      source: DRIVE_APP_SOURCE,
      owner: params.owner,
      category: params.category,
      entryType: "sms",
      billDate: params.billDate,
    },
  };

  const delimiter = `\r\n--${MULTIPART_BOUNDARY}\r\n`;
  const closeDelimiter = `\r\n--${MULTIPART_BOUNDARY}--\r\n`;
  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const mediaPart = `${delimiter}Content-Type: text/plain; charset=UTF-8\r\n\r\n${params.text}`;
  const body = metadataPart + mediaPart + closeDelimiter;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType,createdTime,appProperties",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
      },
      body,
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to upload SMS text to Google Drive: ${details}`);
  }

  return (await response.json()) as DriveFileRecord;
}
