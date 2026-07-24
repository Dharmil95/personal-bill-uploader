"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/bill-uploader/AppShell";
import { BottomNav } from "@/components/bill-uploader/BottomNav";
import { ConfirmDialog } from "@/components/bill-uploader/ConfirmDialog";
import { BillDetailSheet } from "@/components/bill-uploader/dashboard/BillDetailSheet";
import { DashboardTab } from "@/components/bill-uploader/dashboard/DashboardTab";
import type { DashboardView } from "@/components/bill-uploader/dashboard/DashboardViewToggle";
import { Header } from "@/components/bill-uploader/Header";
import { RecentTab } from "@/components/bill-uploader/recent/RecentTab";
import { Toast } from "@/components/bill-uploader/Toast";
import { UploadOverlay } from "@/components/bill-uploader/UploadOverlay";
import { UploadTab } from "@/components/bill-uploader/upload/UploadTab";
import { useToast } from "@/hooks/useToast";
import type { DashboardDayDetail, DashboardSummary } from "@/lib/dashboard/types";
import { formatInrAmount } from "@/lib/dashboard/format";
import {
  DEFAULT_EXPENSE_OWNER,
  DEFAULT_RECENT_OWNER_FILTER,
  MAX_UPLOAD_BYTES,
  SEED_CATEGORIES,
} from "@/lib/bill-uploader/constants";
import { uploadFilesToDrive } from "@/lib/bill-uploader/driveUpload";
import { uploadSmsToDrive } from "@/lib/bill-uploader/smsUpload";
import type {
  ExpenseOwner,
  RecentItem,
  RecentOwnerFilter,
  SelectedFile,
  Tab,
  UploadMode,
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
  todayISO,
} from "@/lib/bill-uploader/utils";
import { buildSmsTextFromShare, consumeSharePayload } from "@/lib/bill-uploader/sharePayload";

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
  const [uploadMode, setUploadMode] = useState<UploadMode>("photo");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [smsText, setSmsText] = useState("");
  const [smsDate, setSmsDate] = useState(() => todayISO());
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
  const [dashboardView, setDashboardView] = useState<DashboardView>("overview");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<DashboardDayDetail | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<RecentItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  const loadDayDetail = useCallback(
    async (date: string, owner: RecentOwnerFilter = dashboardFilterOwner) => {
      setDayLoading(true);
      try {
        const response = await fetch(`/api/dashboard/day?date=${date}&owner=${owner}`);
        const data = (await response.json()) as DashboardDayDetail & { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load day expenses");
        }

        setDayDetail(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load day expenses";
        showToast(message);
        setDayDetail(null);
      } finally {
        setDayLoading(false);
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
    if (tab !== "dashboard" || dashboardView !== "calendar" || !selectedCalendarDate) {
      return;
    }

    void loadDayDetail(selectedCalendarDate, dashboardFilterOwner);
  }, [tab, dashboardView, selectedCalendarDate, dashboardFilterOwner, loadDayDetail]);

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

  const addUploadFiles = useCallback(
    (list: File[]) => {
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
    },
    [createId, showToast],
  );

  const onFilesChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files ?? []);
    addUploadFiles(list);
    event.target.value = "";
  };

  useEffect(() => {
    void (async () => {
      const payload = await consumeSharePayload();
      if (!payload) {
        return;
      }

      setTab("upload");

      if (payload.files.length > 0) {
        setUploadMode("photo");
        addUploadFiles(
          payload.files.map(
            (file) => new File([file.blob], file.name, { type: file.type || "application/octet-stream" }),
          ),
        );
        showToast(
          `Shared ${payload.files.length} file${payload.files.length === 1 ? "" : "s"} ready to upload`,
        );
        return;
      }

      const sharedText = buildSmsTextFromShare(payload);
      if (sharedText) {
        setUploadMode("sms");
        setSmsText(sharedText);
        showToast("Shared text ready for SMS expense");
      }
    })();
  }, [addUploadFiles, showToast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("shareError") === "too-large") {
      showToast("Shared file exceeds the 25 MB upload limit");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [showToast]);

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

  const submitSms = async () => {
    const text = smsText.trim();
    if (uploading || !text || !selectedCategory || !smsDate) {
      return;
    }

    const category = selectedCategory;
    const owner = selectedOwner;

    uploadAbortRef.current?.abort();
    const abortController = new AbortController();
    uploadAbortRef.current = abortController;

    setUploading(true);
    setUploadProgress(50);

    try {
      const result = await uploadSmsToDrive({
        text,
        billDate: smsDate,
        category,
        owner,
        signal: abortController.signal,
      });

      const mimeType = result.mimeType ?? "text/plain";
      const itemOwner =
        result.appProperties?.owner && isValidExpenseOwner(result.appProperties.owner)
          ? result.appProperties.owner
          : owner;

      const newItem: RecentItem = {
        id: result.id || createId(),
        filename: result.name ?? `sms_${smsDate}_${category}.txt`,
        category: result.appProperties?.category ?? category,
        owner: itemOwner,
        fileType: getFileTypeFromMime(mimeType),
        thumb: null,
        uploadedAt: "Just now",
        webViewLink: result.webViewLink ?? null,
      };

      setSmsText("");
      setSmsDate(todayISO());
      setSelectedCategory(null);
      setRecent((currentRecent) => [newItem, ...currentRecent]);
      setUploadProgress(100);
      showToast("Saved to Drive — run processor to add to Dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
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

  const deleteBillByDriveId = async (driveFileId: string) => {
    const response = await fetch(`/api/bills/${driveFileId}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to delete bill");
    }
  };

  const confirmDeleteRecentItem = async () => {
    if (!pendingDeleteItem) {
      return;
    }

    setDeleteBusy(true);
    try {
      await deleteBillByDriveId(pendingDeleteItem.id);
      setRecent((current) => current.filter((item) => item.id !== pendingDeleteItem.id));
      if (tab === "dashboard") {
        void loadDashboard(dashboardFilterOwner);
      }
      showToast("Bill deleted");
      setPendingDeleteItem(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete bill";
      showToast(message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleBillUpdated = () => {
    void loadDashboard(dashboardFilterOwner);
    if (selectedCalendarDate) {
      void loadDayDetail(selectedCalendarDate, dashboardFilterOwner);
    }
    showToast("Bill updated");
  };

  const handleBillDeleted = (driveFileId: string) => {
    setSelectedExpenseId(null);
    setRecent((current) => current.filter((item) => item.id !== driveFileId));
    void loadDashboard(dashboardFilterOwner);
    if (selectedCalendarDate) {
      void loadDayDetail(selectedCalendarDate, dashboardFilterOwner);
    }
    showToast("Bill deleted");
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
    setSelectedCalendarDate(null);
    setDayDetail(null);
  };

  const handleDashboardViewChange = (view: DashboardView) => {
    setDashboardView(view);
    if (view === "overview") {
      setSelectedCalendarDate(null);
      setDayDetail(null);
    }
  };

  const handleCalendarMonthChange = () => {
    setSelectedCalendarDate(null);
    setDayDetail(null);
  };

  const handleTabChange = (nextTab: Tab) => {
    setTab(nextTab);
    if (nextTab !== "dashboard") {
      setSelectedExpenseId(null);
      setSelectedCalendarDate(null);
      setDayDetail(null);
    }
  };

  const visibleRecent =
    filterCategory === "All"
      ? recent
      : recent.filter((item) => item.category === filterCategory);

  const hasFiles = files.length > 0;
  const hasSmsInput = smsText.trim().length > 0;
  const isSmsMode = uploadMode === "sms";
  const canSubmitPhoto = !isSmsMode && hasFiles && !!selectedCategory && !uploading;
  const canSubmitSms =
    isSmsMode && hasSmsInput && !!selectedCategory && !!smsDate && !uploading;
  const canSubmit = isSmsMode ? canSubmitSms : canSubmitPhoto;
  const isUploadTab = tab === "upload";
  const isRecentTab = tab === "recent";
  const isDashboardTab = tab === "dashboard";
  const isBillDetailOpen = isDashboardTab && !!selectedExpenseId;

  const headerTitle = isUploadTab
    ? isSmsMode
      ? "Save SMS expense"
      : "Upload a bill"
    : isRecentTab
      ? "Recent uploads"
      : isBillDetailOpen
        ? "Bill detail"
        : "Dashboard";

  const headerSubtitle = isUploadTab
    ? isSmsMode
      ? `Saved to Google Drive · ${getOwnerLabel(selectedOwner)}`
      : `Saved to Google Drive · ${getOwnerLabel(selectedOwner)}`
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
    ? isSmsMode
      ? "Saving…"
      : "Uploading…"
    : isSmsMode
      ? !hasSmsInput
        ? "Paste SMS text"
        : !selectedCategory
          ? "Choose a category"
          : "Save to Drive"
      : hasFiles && !selectedCategory
        ? "Choose a category"
        : "Upload";

  return (
    <AppShell>
      <Header title={headerTitle} subtitle={headerSubtitle} onLogout={() => void logout()} />
      {toast.visible ? <Toast message={toast.message} /> : null}
      {isUploadTab ? (
        <UploadTab
          uploadMode={uploadMode}
          files={files}
          smsText={smsText}
          smsDate={smsDate}
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
          onUploadModeChange={setUploadMode}
          onSmsTextChange={setSmsText}
          onSmsDateChange={setSmsDate}
          onFilesChosen={onFilesChosen}
          onTriggerCamera={triggerCamera}
          onTriggerFile={triggerFile}
          onRemoveFile={removeFile}
          onSelectOwner={selectOwner}
          onSelectCategory={selectCategory}
          onToggleCustomMode={toggleCustomMode}
          onCustomTextChange={setCustomText}
          onConfirmCustomCategory={confirmCustomCategory}
          onSubmit={() => void (isSmsMode ? submitSms() : submit())}
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
          onDeleteItem={setPendingDeleteItem}
        />
      ) : isBillDetailOpen && selectedExpenseId ? (
        <BillDetailSheet
          expenseId={selectedExpenseId}
          onBack={() => setSelectedExpenseId(null)}
          onError={showToast}
          onBillUpdated={handleBillUpdated}
          onBillDeleted={handleBillDeleted}
        />
      ) : (
        <DashboardTab
          summary={dashboardSummary}
          loading={dashboardLoading}
          filterOwner={dashboardFilterOwner}
          dashboardView={dashboardView}
          selectedDate={selectedCalendarDate}
          dayDetail={dayDetail}
          dayLoading={dayLoading}
          onOwnerFilterChange={handleDashboardOwnerFilterChange}
          onDashboardViewChange={handleDashboardViewChange}
          onSelectDate={setSelectedCalendarDate}
          onCalendarMonthChange={handleCalendarMonthChange}
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
            selectedCategory
              ? buildDriveDestinationPath(selectedOwner, selectedCategory)
              : isSmsMode
                ? "Google Drive"
                : ""
          }
        />
      ) : null}
      {pendingDeleteItem ? (
        <ConfirmDialog
          open
          title="Delete bill?"
          message="This removes the file from Google Drive and the dashboard. This cannot be undone."
          confirmLabel="Delete"
          destructive
          busy={deleteBusy}
          onConfirm={() => void confirmDeleteRecentItem()}
          onCancel={() => {
            if (!deleteBusy) {
              setPendingDeleteItem(null);
            }
          }}
        />
      ) : null}
    </AppShell>
  );
}
