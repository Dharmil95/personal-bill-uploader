export type Tab = "upload" | "recent" | "dashboard";

export type ExpenseOwner = "me" | "parents";

export type RecentOwnerFilter = ExpenseOwner | "everyone";

export type SelectedFile = {
  id: string;
  name: string;
  isPdf: boolean;
  previewUrl: string | null;
  file: File;
};

export type RecentItem = {
  id: string;
  filename: string;
  category: string;
  owner: ExpenseOwner;
  fileType: "image" | "pdf" | "txt";
  thumb: string | null;
  uploadedAt: string;
  webViewLink?: string | null;
};

export type UploadMode = "photo" | "sms";

export type ToastState = {
  visible: boolean;
  message: string;
};
