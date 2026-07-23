export type ProcessStatus = "pending" | "processing" | "done" | "failed" | "skipped";

export type ExpenseOwner = "me" | "parents";

export type DriveFileRow = {
  drive_file_id: string;
  filename: string;
  owner: ExpenseOwner;
  category: string;
  mime_type: string | null;
  web_view_link: string | null;
  drive_created_at: string | null;
  process_status: ProcessStatus;
  processed_at: string | null;
  error: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseRow = {
  id: string;
  drive_file_id: string;
  owner: ExpenseOwner;
  category: string;
  vendor: string | null;
  amount: number | null;
  currency: string;
  bill_date: string | null;
  confidence: number | null;
  raw_llm_json: Record<string, unknown> | null;
  invoice_number: string | null;
  subtotal: number | null;
  discount: number | null;
  delivery_fee: number | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseLineItemRow = {
  id: string;
  expense_id: string;
  drive_file_id: string;
  line_no: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  amount: number | null;
  created_at: string;
  updated_at: string;
};

export type DriveFileInsert = Omit<DriveFileRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export type ExpenseInsert = Omit<ExpenseRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ExpenseLineItemInsert = Omit<
  ExpenseLineItemRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      drive_files: {
        Row: DriveFileRow;
        Insert: DriveFileInsert;
        Update: Partial<DriveFileInsert>;
        Relationships: [];
      };
      expenses: {
        Row: ExpenseRow;
        Insert: ExpenseInsert;
        Update: Partial<ExpenseInsert>;
        Relationships: [];
      };
      expense_line_items: {
        Row: ExpenseLineItemRow;
        Insert: ExpenseLineItemInsert;
        Update: Partial<ExpenseLineItemInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
