import { MAX_UPLOAD_BYTES, OWNER_FOLDER_NAMES } from "@/lib/bill-uploader/constants";
import type { ExpenseOwner, RecentOwnerFilter } from "@/lib/bill-uploader/types";
import { getOwnerFolderName, isValidExpenseOwner } from "@/lib/bill-uploader/utils";

export const DRIVE_ROOT_FOLDER = "Bills";
export const DRIVE_APP_SOURCE = "bill-uploader";

export { MAX_UPLOAD_BYTES };

export type DriveFileRecord = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
  createdTime?: string;
  appProperties?: Record<string, string>;
};

type GoogleTokenResponse = {
  access_token: string;
};

type GoogleFilesResponse = {
  files?: DriveFileRecord[];
};

type GoogleFileResponse = DriveFileRecord;

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Drive credentials are not configured");
  }

  return { clientId, clientSecret, refreshToken };
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function refreshAccessToken(): Promise<string> {
  const { clientId, clientSecret, refreshToken } = getGoogleConfig();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to refresh Google access token: ${details}`);
  }

  const data = (await response.json()) as GoogleTokenResponse;
  return data.access_token;
}

async function driveRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Drive request failed: ${details}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

async function findFolderByName(
  accessToken: string,
  name: string,
  parentId: string | null,
): Promise<string | null> {
  const escapedName = escapeDriveQueryValue(name);
  const parentClause = parentId
    ? `'${parentId}' in parents`
    : "'root' in parents";

  const query = [
    `name='${escapedName}'`,
    "mimeType='application/vnd.google-apps.folder'",
    parentClause,
    `appProperties has { key='source' and value='${DRIVE_APP_SOURCE}' }`,
    "trashed=false",
  ].join(" and ");

  const data = await driveRequest<GoogleFilesResponse>(
    `files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive&pageSize=1`,
    accessToken,
  );

  return data.files?.[0]?.id ?? null;
}

async function createFolder(
  accessToken: string,
  name: string,
  parentId: string | null,
): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    appProperties: { source: DRIVE_APP_SOURCE },
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const data = await driveRequest<GoogleFileResponse>("files", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  if (!data.id) {
    throw new Error("Google Drive did not return a folder id");
  }

  return data.id;
}

async function ensureFolderPath(
  accessToken: string,
  folderNames: string[],
): Promise<string> {
  let parentId: string | null = null;

  for (const name of folderNames) {
    let folderId = await findFolderByName(accessToken, name, parentId);
    if (!folderId) {
      folderId = await createFolder(accessToken, name, parentId);
    }
    parentId = folderId;
  }

  if (!parentId) {
    throw new Error("Failed to resolve Google Drive folder path");
  }

  return parentId;
}

export async function ensureOwnerCategoryFolder(
  owner: ExpenseOwner,
  category: string,
): Promise<{
  folderId: string;
  accessToken: string;
}> {
  const accessToken = await refreshAccessToken();
  const folderId = await ensureFolderPath(accessToken, [
    DRIVE_ROOT_FOLDER,
    getOwnerFolderName(owner),
    category,
  ]);

  return { folderId, accessToken };
}

export async function createResumableUploadSession(params: {
  filename: string;
  mimeType: string;
  fileSize: number;
  category: string;
  owner: ExpenseOwner;
  folderId: string;
  accessToken: string;
  origin: string;
}): Promise<string> {
  const metadata = {
    name: params.filename,
    parents: [params.folderId],
    appProperties: {
      source: DRIVE_APP_SOURCE,
      category: params.category,
      owner: params.owner,
    },
  };

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,mimeType,createdTime,appProperties",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": params.mimeType,
        "X-Upload-Content-Length": String(params.fileSize),
        Origin: params.origin,
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to create Google Drive upload session: ${details}`);
  }

  const sessionUri = response.headers.get("Location");
  if (!sessionUri) {
    throw new Error("Google Drive did not return a resumable upload URI");
  }

  return sessionUri;
}

export async function listRecentFiles(params?: {
  owner?: ExpenseOwner;
  category?: string;
}): Promise<DriveFileRecord[]> {
  const accessToken = await refreshAccessToken();
  const owner = params?.owner;
  const category = params?.category;

  const queryParts = [
    `appProperties has { key='source' and value='${DRIVE_APP_SOURCE}' }`,
    "mimeType != 'application/vnd.google-apps.folder'",
    "trashed=false",
  ];

  if (owner) {
    queryParts.push(
      `appProperties has { key='owner' and value='${escapeDriveQueryValue(owner)}' }`,
    );
  }

  if (category) {
    queryParts.push(
      `appProperties has { key='category' and value='${escapeDriveQueryValue(category)}' }`,
    );
  }

  const query = queryParts.join(" and ");
  const data = await driveRequest<GoogleFilesResponse>(
    `files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&pageSize=50&fields=files(id,name,mimeType,webViewLink,thumbnailLink,createdTime,appProperties)`,
    accessToken,
  );

  return data.files ?? [];
}

async function listCategoriesUnderOwnerFolder(
  accessToken: string,
  owner: ExpenseOwner,
): Promise<string[]> {
  const rootFolderId = await findFolderByName(accessToken, DRIVE_ROOT_FOLDER, null);
  if (!rootFolderId) {
    return [];
  }

  const ownerFolderId = await findFolderByName(
    accessToken,
    getOwnerFolderName(owner),
    rootFolderId,
  );
  if (!ownerFolderId) {
    return [];
  }

  const query = [
    `'${ownerFolderId}' in parents`,
    "mimeType='application/vnd.google-apps.folder'",
    `appProperties has { key='source' and value='${DRIVE_APP_SOURCE}' }`,
    "trashed=false",
  ].join(" and ");

  const data = await driveRequest<GoogleFilesResponse>(
    `files?q=${encodeURIComponent(query)}&orderBy=name&pageSize=100&fields=files(name)`,
    accessToken,
  );

  return (data.files ?? []).map((folder) => folder.name).filter(Boolean);
}

export async function listCategoryFolders(
  ownerFilter: RecentOwnerFilter = "me",
): Promise<string[]> {
  const accessToken = await refreshAccessToken();

  if (ownerFilter === "everyone") {
    const [meCategories, parentsCategories] = await Promise.all([
      listCategoriesUnderOwnerFolder(accessToken, "me"),
      listCategoriesUnderOwnerFolder(accessToken, "parents"),
    ]);
    return Array.from(new Set([...meCategories, ...parentsCategories]));
  }

  if (isValidExpenseOwner(ownerFilter)) {
    return listCategoriesUnderOwnerFolder(accessToken, ownerFilter);
  }

  return listCategoriesUnderOwnerFolder(accessToken, "me");
}

export function parseDriveFileOwner(appProperties?: Record<string, string>): ExpenseOwner {
  const owner = appProperties?.owner;
  if (owner && isValidExpenseOwner(owner)) {
    return owner;
  }

  return "me";
}

export async function trashDriveFile(driveFileId: string): Promise<void> {
  const accessToken = await refreshAccessToken();

  try {
    await driveRequest<Record<string, never>>(
      `files/${encodeURIComponent(driveFileId)}`,
      accessToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("404") && !message.includes("notFound")) {
      throw error;
    }
  }
}

export { OWNER_FOLDER_NAMES };
