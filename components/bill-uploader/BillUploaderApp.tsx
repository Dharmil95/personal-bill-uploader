"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/bill-uploader/AppShell";
import { BottomNav } from "@/components/bill-uploader/BottomNav";
import { BillDetailSheet } from "@/components/bill-uploader/dashboard/BillDetailSheet";
import { DashboardTab } from "@/components/bill-uploader/dashboard/DashboardTab";
import { Header } from "@/components/bill-uploader/Header";
import { RecentTab } from "@/components/bill-uploader/recent/RecentTab";
import { Toast } from "@/components/bill-uploader/Toast";
import { UploadOverlay } from "@/components/bill-uploader/UploadOverlay";
import { UploadTab } from "@/components/bill-uploader/upload/UploadTab";
import { useToast } from "@/hooks/useToast";
import type { DashboardSummary } from "@/lib/dashboard/types";
import { formatInrAmount } from "@/lib/dashboard/format";
import {
  DEFAULT_EXPENSE_OWNER,
  DEFAULT_RECENT_OWNER_FILTER,
  MAX_UPLOAD_BYTES,
  SEED_CATEGORIES,
} from "@/lib/bill-uploader/constants";
import { uploadFilesToDrive } from "@/lib/bill-uploader/driveUpload";
import type {
  ExpenseOwner,
  RecentItem,
  RecentOwnerFilter,
  SelectedFile,
  Tab,
} from "@/lib/bill-uploader/types";
import {
  buildDriveDestinationPath,
  buildUploadFilename,
  formatBytes,
  formatRecentTotal,
  getFileTypeFromMime,
  getOwnerLabel,
  isAllowedUploadFile,
  isPdfFile,
  isValidExpenseOwner,
  resolveUploadMimeType,
} from "@/lib/bill-uploader/utils";

function buildRecentQuery(owner: RecentOwnerFilter, category: string): string {
  const params = new URLSearchParams();
  params.set("owner", owner);
  if (category !== "All") {
    params.set("category", category);
  }
  return `?${params.toString()}`;
}

function buildCategoriesQuery(owner: RecentOwnerFilter): string {
  return `?owner=${owner}`;
}

export function BillUploaderApp() {
  const router = useRouter();
  const idPrefix = useId().replace(/:/g, "");
  const nextIdRef = useRef(3);

  const [tab, setTab] = useState<Tab>("upload");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [categories, setCategories] = useState<string[]>(() => [...SEED_CATEGORIES]);
  const [selectedOwner, setSelectedOwner] = useState<ExpenseOwner>(DEFAULT_EXPENSE_OWNER);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filterOwner, setFilterOwner] = useState<RecentOwnerFilter>(DEFAULT_RECENT_OWNER_FILTER);
  const [filterCategory, setFilterCategory] = useState("All");
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [dashboardFilterOwner, setDashboardFilterOwner] = useState<RecentOwnerFilter>("everyone");
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

  const { toast, showToast } = useToast();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
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

  const loadCategories = useCallback(async (owner: RecentOwnerFilter) => {
    try {
      const response = await fetch(`/api/drive/categories${buildCategoriesQuery(owner)}`);
      const data = (await response.json()) as { categories?: string[] };
      if (response.ok && data.categories?.length) {
        setCategories(data.categories);
      }
    } catch {
      // Keep seeded categories when Drive is unavailable.
    }
  }, []);

  const loadRecent = useCallback(
    async (owner: RecentOwnerFilter = filterOwner, category: string = filterCategory) => {
      setRecentLoading(true);
      try {
        const response = await fetch(`/api/drive/recent${buildRecentQuery(owner, category)}`);
        const data = (await response.json()) as { items?: RecentItem[]; error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load recent uploads");
        }

        const items = data.items ?? [];
        const nextThumbs = new Set(
          items.map((item) => item.thumb).filter((thumb): thumb is string => !!thumb),
        );

        previewUrlsRef.current.forEach((url, id) => {
          if (url.startsWith("blob:") && !nextThumbs.has(url)) {
            URL.revokeObjectURL(url);
            previewUrlsRef.current.delete(id);
          }
        });

        setRecent(items);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load recent uploads";
        showToast(message);
      } finally {
        setRecentLoading(false);
      }
    },
    [filterCategory, filterOwner, showToast],
  );

  const loadDashboard = useCallback(
    async (owner: RecentOwnerFilter = dashboardFilterOwner) => {
      setDashboardLoading(true);
      try {
        const response = await fetch(`/api/dashboard/summary?owner=${owner}`);
        const data = (await response.json()) as DashboardSummary & { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load dashboard");
        }

        setDashboardSummary(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load dashboard";
        showToast(message);
        setDashboardSummary(null);
      } finally {
        setDashboardLoading(false);
      }
    },
    [dashboardFilterOwner, showToast],
  );

  useEffect(() => {
    if (tab === "upload") {
      void loadCategories(selectedOwner);
    }
  }, [tab, selectedOwner, loadCategories]);

  useEffect(() => {
    if (tab === "recent") {
      void loadCategories(filterOwner);
      void loadRecent(filterOwner, filterCategory);
    }
  }, [tab, filterOwner, filterCategory, loadCategories, loadRecent]);

  useEffect(() => {
    if (tab === "dashboard" && !selectedExpenseId) {
      void loadDashboard(dashboardFilterOwner);
    }
  }, [tab, dashboardFilterOwner, selectedExpenseId, loadDashboard]);

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      uploadAbortRef.current?.abort();
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
      if (!isAllowedUploadFile(file)) {
        showToast(`${file.name} is not a supported image or PDF`);
        return;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        showToast(`${file.name} exceeds the ${formatBytes(MAX_UPLOAD_BYTES)} limit`);
        return;
      }

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
          file,
        },
      ]);
    });

    event.target.value = "";
  };

  const removeFile = (id: string) => {
    revokePreviewUrl(id);
    setFiles((current) => current.filter((file) => file.id !== id));
  };

  const selectOwner = (owner: ExpenseOwner) => {
    setSelectedOwner(owner);
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

  const submit = async () => {
    if (uploading || files.length === 0 || !selectedCategory) {
      return;
    }

    const category = selectedCategory;
    const owner = selectedOwner;
    const uploadFiles = files.map((selected) => ({
      file: selected.file,
      filename: buildUploadFilename(category, selected.name),
    }));

    uploadAbortRef.current?.abort();
    const abortController = new AbortController();
    uploadAbortRef.current = abortController;

    setUploading(true);
    setUploadProgress(0);

    try {
      const results = await uploadFilesToDrive(
        uploadFiles,
        category,
        owner,
        setUploadProgress,
        abortController.signal,
      );

      const newItems: RecentItem[] = results.map((result, index) => {
        const selected = files[index];
        const mimeType =
          result.mimeType ?? resolveUploadMimeType(selected.name, selected.file.type);
        const itemOwner =
          result.appProperties?.owner && isValidExpenseOwner(result.appProperties.owner)
            ? result.appProperties.owner
            : owner;

        return {
          id: result.id || createId(),
          filename: result.name ?? uploadFiles[index].filename,
          category: result.appProperties?.category ?? category,
          owner: itemOwner,
          fileType: getFileTypeFromMime(mimeType),
          thumb: selected.previewUrl,
          uploadedAt: "Just now",
          webViewLink: result.webViewLink ?? null,
        };
      });

      setFiles([]);
      setSelectedCategory(null);
      setRecent((currentRecent) => [...newItems, ...currentRecent]);
      showToast(
        `Uploaded ${newItems.length} file${newItems.length === 1 ? "" : "s"} to ${buildDriveDestinationPath(owner, category)}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      if (message !== "Upload cancelled") {
        showToast(message);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      uploadAbortRef.current = null;
    }
  };

  const openItem = (item: RecentItem) => {
    if (item.webViewLink) {
      window.open(item.webViewLink, "_blank", "noopener,noreferrer");
      return;
    }

    showToast(buildDriveDestinationPath(item.owner, item.category) + item.filename);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  const handleOwnerFilterChange = (owner: RecentOwnerFilter) => {
    setFilterOwner(owner);
    setFilterCategory("All");
  };

  const handleDashboardOwnerFilterChange = (owner: RecentOwnerFilter) => {
    setDashboardFilterOwner(owner);
  };

  const handleTabChange = (nextTab: Tab) => {
    setTab(nextTab);
    if (nextTab !== "dashboard") {
      setSelectedExpenseId(null);
    }
  };

  const visibleRecent =
    filterCategory === "All"
      ? recent
      : recent.filter((item) => item.category === filterCategory);

  const hasFiles = files.length > 0;
  const canSubmit = hasFiles && !!selectedCategory && !uploading;
  const isUploadTab = tab === "upload";
  const isRecentTab = tab === "recent";
  const isDashboardTab = tab === "dashboard";
  const isBillDetailOpen = isDashboardTab && !!selectedExpenseId;

  const headerTitle = isUploadTab
    ? "Upload a bill"
    : isRecentTab
      ? "Recent uploads"
      : isBillDetailOpen
        ? "Bill detail"
        : "Dashboard";

  const headerSubtitle = isUploadTab
    ? `Saved to Google Drive · ${getOwnerLabel(selectedOwner)}`
    : isRecentTab
      ? recentLoading
        ? "Loading from Google Drive…"
        : formatRecentTotal(recent.length)
      : isBillDetailOpen
        ? "Line items and totals"
        : dashboardLoading
          ? "Loading from Supabase…"
          : dashboardSummary
            ? `${dashboardSummary.billCount} bill${dashboardSummary.billCount === 1 ? "" : "s"} · ${formatInrAmount(dashboardSummary.totalSpend, dashboardSummary.currency)} total`
            : "Spend at a glance";

  const submitLabel = uploading
    ? "Uploading…"
    : hasFiles && !selectedCategory
      ? "Choose a category"
      : "Upload";

  return (
    <AppShell>
      <Header title={headerTitle} subtitle={headerSubtitle} onLogout={() => void logout()} />
      {toast.visible ? <Toast message={toast.message} /> : null}
      {isUploadTab ? (
        <UploadTab
          files={files}
          categories={categories}
          selectedOwner={selectedOwner}
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
          onSelectOwner={selectOwner}
          onSelectCategory={selectCategory}
          onToggleCustomMode={toggleCustomMode}
          onCustomTextChange={setCustomText}
          onConfirmCustomCategory={confirmCustomCategory}
          onSubmit={() => void submit()}
        />
      ) : isRecentTab ? (
        <RecentTab
          categories={categories}
          filterOwner={filterOwner}
          filterCategory={filterCategory}
          items={visibleRecent}
          onOwnerFilterChange={handleOwnerFilterChange}
          onFilterChange={setFilterCategory}
          onOpenItem={openItem}
        />
      ) : isBillDetailOpen && selectedExpenseId ? (
        <BillDetailSheet
          expenseId={selectedExpenseId}
          onBack={() => setSelectedExpenseId(null)}
          onError={showToast}
        />
      ) : (
        <DashboardTab
          summary={dashboardSummary}
          loading={dashboardLoading}
          filterOwner={dashboardFilterOwner}
          onOwnerFilterChange={handleDashboardOwnerFilterChange}
          onSelectBill={setSelectedExpenseId}
        />
      )}
      <BottomNav
        activeTab={tab}
        onUpload={() => handleTabChange("upload")}
        onRecent={() => handleTabChange("recent")}
        onDashboard={() => handleTabChange("dashboard")}
      />
      {uploading ? (
        <UploadOverlay
          progress={Math.round(uploadProgress)}
          destinationLabel={
            selectedCategory ? buildDriveDestinationPath(selectedOwner, selectedCategory) : ""
          }
        />
      ) : null}
    </AppShell>
  );
}
