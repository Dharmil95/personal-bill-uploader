import { queryPostgres } from "@/lib/db/postgres";
import type { ReviewStatus } from "@/lib/supabase/types";
import { createSupabaseServerClient, hasSupabaseServiceRoleConfig } from "@/lib/supabase/server";

export async function deleteBillFromDatabase(driveFileId: string): Promise<boolean> {
  if (hasSupabaseServiceRoleConfig()) {
    const supabase = createSupabaseServerClient();
    const result = await supabase
      .from("drive_files")
      .delete()
      .eq("drive_file_id", driveFileId)
      .select("drive_file_id")
      .maybeSingle();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return !!result.data;
  }

  const rows = await queryPostgres<{ drive_file_id: string }>(
    `
      delete from public.drive_files
      where drive_file_id = $1
      returning drive_file_id
    `,
    [driveFileId],
  );

  return rows.length > 0;
}

export async function updateBillReviewStatus(
  driveFileId: string,
  reviewStatus: ReviewStatus,
): Promise<ReviewStatus> {
  if (hasSupabaseServiceRoleConfig()) {
    const supabase = createSupabaseServerClient();
    const result = await supabase
      .from("drive_files")
      .update({ review_status: reviewStatus })
      .eq("drive_file_id", driveFileId)
      .select("review_status")
      .maybeSingle();

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (!result.data) {
      throw new Error("Bill not found");
    }

    return result.data.review_status;
  }

  const rows = await queryPostgres<{ review_status: ReviewStatus }>(
    `
      update public.drive_files
      set review_status = $2,
          updated_at = timezone('utc', now())
      where drive_file_id = $1
      returning review_status
    `,
    [driveFileId, reviewStatus],
  );

  if (rows.length === 0) {
    throw new Error("Bill not found");
  }

  return rows[0].review_status;
}
