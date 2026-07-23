export type Tab = "upload" | "recent";

export type SelectedFile = {
  id: string;
  name: string;
  isPdf: boolean;
  previewUrl: string | null;
};

export type RecentItem = {
  id: string;
  filename: string;
  category: string;
  fileType: "image" | "pdf";
  thumb: string | null;
  uploadedAt: string;
};

export type ToastState = {
  visible: boolean;
  message: string;
};
