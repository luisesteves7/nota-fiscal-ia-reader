/**
 * Tipos do schema do Supabase.
 *
 * TEMPORÁRIO: escrito à mão para bater com supabase/migrations/0001_init.sql
 * e 0002_rate_limiting.sql. Depois que o projeto Supabase estiver criado,
 * gere o arquivo definitivo com:
 *
 *   npx supabase gen types typescript --project-id SEU_PROJECT_ID > src/types/database.ts
 *
 * e substitua este arquivo.
 */
export interface Database {
  public: {
    Tables: {
      invoices: {
        Row: {
          id: string;
          user_id: string;
          supplier_name: string | null;
          supplier_cnpj: string | null;
          issue_date: string | null;
          invoice_number: string | null;
          total_amount: number | null;
          category: string | null;
          raw_file_url: string;
          status: "processing" | "done" | "error";
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          supplier_name?: string | null;
          supplier_cnpj?: string | null;
          issue_date?: string | null;
          invoice_number?: string | null;
          total_amount?: number | null;
          category?: string | null;
          raw_file_url: string;
          status?: "processing" | "done" | "error";
          error_message?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
        Relationships: [];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          total_price: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["invoice_items"]["Insert"]
        >;
        Relationships: [];
      };
      extraction_attempts: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["extraction_attempts"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}