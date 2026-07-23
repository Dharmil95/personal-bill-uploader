"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { AppShell } from "@/components/bill-uploader/AppShell";
import { BottomNav } from "@/components/bill-uploader/BottomNav";
import { Header } from "@/components/bill-uploader/Header";
import { RecentTab } from "@/components/bill-uploader/recent/RecentTab";
import { Toast } from "@/components/bill-uploader/Toast";
import { UploadOverlay } from "@/components/bill-uploader/UploadOverlay";
import { UploadTab } from "@/components/bill-uploader/upload/UploadTab";
import { useToast } from "@/hooks/useToast";
import { SEED_CATEGORIES, SEED_RECENT } from "@/lib/bill-uploader/constants";
import { startMockUpload } from "@/lib/bill-uploader/mockUpload";
import type { RecentItem, SelectedFile, Tab } from "@/lib/bill-uploader/types";
import {
  buildUploadFilename,
  formatRecentTotal,
  isPdfFile,
} from "@/lib/bill-uploader/utils";

export function BillUploaderApp() {
  const idPrefix = useId().replace(/:/g, "");
  const nextIdRef = useRef(3);

  const [tab, setTab] = useState<Tab>("upload");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [categories, setCategories] = useState<string[]>(() => [...SEED_CATEGORIES]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filterCategory, setFilterCategory] = useState("All");
  const [recent, setRecent] = useState<RecentItem[]>(() => [...SEED_RECENT]);

  const { toast, showToast } = useToast();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelUploadRef = useRef<(() => void) | null>(null);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());

  const createId = useCallback(() => {
    const id = `${idPrefix}-${nextIdRef.current}`;
    nextIdRef.current += 1;
    return id;
  }, [idPrefix]);

  const revokePreviewUrl = useCallback((id: string) => {
    const url = previewUrlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      cancelUploadRef.current?.();
    };
  }, []);

  const triggerCamera = () => cameraInputRef.current?.click();
  const triggerFile = () => fileInputRef.current?.click();

  const onFilesChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files ?? []);
    if (!list.length) {
      return;
    }

    list.forEach((file) => {
      const id = createId();
      const isPdf = isPdfFile(file);
      const previewUrl = isPdf ? null : URL.createObjectURL(file);

      if (previewUrl) {
        previewUrlsRef.current.set(id, previewUrl);
      }

      setFiles((current) => [
        ...current,
        {
          id,
          name: file.name,
          isPdf,
          previewUrl,
        },
      ]);
    });

    event.target.value = "";
  };

  const removeFile = (id: string) => {
    revokePreviewUrl(id);
    setFiles((current) => current.filter((file) => file.id !== id));
  };

  const selectCategory = (name: string) => {
    setSelectedCategory(name);
    setCustomMode(false);
  };

  const toggleCustomMode = () => {
    setCustomMode((current) => !current);
    setCustomText("");
  };

  const confirmCustomCategory = () => {
    const name = customText.trim();
    if (!name) {
      return;
    }

    setCategories((current) => (current.includes(name) ? current : [...current, name]));
    setSelectedCategory(name);
    setCustomMode(false);
    setCustomText("");
  };

  const finishUpload = useCallback(
    (category: string) => {
      setFiles((currentFiles) => {
        const newItems: RecentItem[] = currentFiles.map((file) => {
          previewUrlsRef.current.delete(file.id);
          return {
            id: createId(),
            filename: buildUploadFilename(category, file.name),
            category,
            fileType: file.isPdf ? "pdf" : "image",
            thumb: file.previewUrl,
            uploadedAt: "Just now",
          };
        });

        setRecent((currentRecent) => [...newItems, ...currentRecent]);
        setSelectedCategory(null);
        setUploading(false);
        setUploadProgress(0);
        showToast(
          `Demo upload complete — ${newItems.length} file${newItems.length === 1 ? "" : "s"} queued for Bills/${category}`,
        );

        return [];
      });
    },
    [createId, showToast],
  );

  const submit = () => {
    if (uploading || files.length === 0 || !selectedCategory) {
      return;
    }

    const category = selectedCategory;

    setUploading(true);
    setUploadProgress(0);
    cancelUploadRef.current?.();
    cancelUploadRef.current = startMockUpload({
      onProgress: setUploadProgress,
      onComplete: () => finishUpload(category),
    });
  };

  const openItem = (item: RecentItem) => {
    showToast(`Drive preview coming soon — Bills/${item.category}/${item.filename}`);
  };

  const visibleRecent =
    filterCategory === "All"
      ? recent
      : recent.filter((item) => item.category === filterCategory);

  const hasFiles = files.length > 0;
  const canSubmit = hasFiles && !!selectedCategory && !uploading;
  const isUploadTab = tab === "upload";

  const headerTitle = isUploadTab ? "Upload a bill" : "Recent uploads";
  const headerSubtitle = isUploadTab
    ? "Google Drive integration coming soon"
    : formatRecentTotal(recent.length);

  const submitLabel = uploading
    ? "Uploading…"
    : hasFiles && !selectedCategory
      ? "Choose a category"
      : "Upload";

  return (
    <AppShell>
      <Header title={headerTitle} subtitle={headerSubtitle} />
      {toast.visible ? <Toast message={toast.message} /> : null}
      {isUploadTab ? (
        <UploadTab
          files={files}
          categories={categories}
          selectedCategory={selectedCategory}
          customMode={customMode}
          customText={customText}
          uploading={uploading}
          canSubmit={canSubmit}
          submitLabel={submitLabel}
          cameraInputRef={cameraInputRef}
          fileInputRef={fileInputRef}
          onFilesChosen={onFilesChosen}
          onTriggerCamera={triggerCamera}
          onTriggerFile={triggerFile}
          onRemoveFile={removeFile}
          onSelectCategory={selectCategory}
          onToggleCustomMode={toggleCustomMode}
          onCustomTextChange={setCustomText}
          onConfirmCustomCategory={confirmCustomCategory}
          onSubmit={submit}
        />
      ) : (
        <RecentTab
          categories={categories}
          filterCategory={filterCategory}
          items={visibleRecent}
          onFilterChange={setFilterCategory}
          onOpenItem={openItem}
        />
      )}
      <BottomNav activeTab={tab} onUpload={() => setTab("upload")} onRecent={() => setTab("recent")} />
      {uploading ? (
        <UploadOverlay
          progress={Math.round(uploadProgress)}
          destinationLabel={selectedCategory ? `Bills/${selectedCategory}/` : ""}
        />
      ) : null}
    </AppShell>
  );
}
