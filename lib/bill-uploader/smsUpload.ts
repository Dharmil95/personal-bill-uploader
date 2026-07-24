import type { ExpenseOwner } from "@/lib/bill-uploader/types";

type SmsUploadResult = {
  id: string;
  name?: string;
  webViewLink?: string | null;
  mimeType?: string;
  createdTime?: string | null;
  appProperties?: Record<string, string>;
};

export async function uploadSmsToDrive(params: {
  text: string;
  billDate: string;
  category: string;
  owner: ExpenseOwner;
  signal?: AbortSignal;
}): Promise<SmsUploadResult> {
  const response = await fetch("/api/drive/upload-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: params.text,
      billDate: params.billDate,
      category: params.category,
      owner: params.owner,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Unable to save SMS to Google Drive");
  }

  return (await response.json()) as SmsUploadResult;
}
