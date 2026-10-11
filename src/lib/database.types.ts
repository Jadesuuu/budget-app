
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "accounts": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"currency": string,"id": string,"institution_id": string,"last4": string | null,"name": string,"opening_balance_centavos": number,"type": Database["public"]['Enums']["account_type"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"institution_id": string,"last4"?: string | null,"name": string,"opening_balance_centavos"?: number,"type": Database["public"]['Enums']["account_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"institution_id"?: string,"last4"?: string | null,"name"?: string,"opening_balance_centavos"?: number,"type"?: Database["public"]['Enums']["account_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"icon": string | null,"id": string,"kind": Database["public"]['Enums']["category_kind"],"name": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"icon"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["category_kind"],"name": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"icon"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["category_kind"],"name"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"institutions": {
                  Row: {
                    "created_at": string,"email_domains": (string)[],"id": string,"kind": Database["public"]['Enums']["institution_kind"],"name": string,"slug": string | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email_domains"?: (string)[],"id"?: string,"kind"?: Database["public"]['Enums']["institution_kind"],"name": string,"slug"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email_domains"?: (string)[],"id"?: string,"kind"?: Database["public"]['Enums']["institution_kind"],"name"?: string,"slug"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"gmail_forward_code": string | null,"gmail_forward_code_at": string | null,"inbound_alias": string,"mode": string,"theme": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"gmail_forward_code"?: string | null,"gmail_forward_code_at"?: string | null,"inbound_alias": string,"mode"?: string,"theme"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"gmail_forward_code"?: string | null,"gmail_forward_code_at"?: string | null,"inbound_alias"?: string,"mode"?: string,"theme"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"raw_emails": {
                  Row: {
                    "created_at": string,"error": string | null,"from_address": string,"from_domain": string,"id": string,"inbound_alias": string,"message_id": string | null,"parsed_at": string | null,"parser": string | null,"parser_version": number | null,"raw_mime": string,"received_at": string,"sender_allowed": boolean,"status": Database["public"]['Enums']["raw_email_status"],"subject": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"from_address": string,"from_domain": string,"id"?: string,"inbound_alias": string,"message_id"?: string | null,"parsed_at"?: string | null,"parser"?: string | null,"parser_version"?: number | null,"raw_mime": string,"received_at"?: string,"sender_allowed"?: boolean,"status"?: Database["public"]['Enums']["raw_email_status"],"subject"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"from_address"?: string,"from_domain"?: string,"id"?: string,"inbound_alias"?: string,"message_id"?: string | null,"parsed_at"?: string | null,"parser"?: string | null,"parser_version"?: number | null,"raw_mime"?: string,"received_at"?: string,"sender_allowed"?: boolean,"status"?: Database["public"]['Enums']["raw_email_status"],"subject"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string,"amount_centavos": number,"category_id": string | null,"confirmed_at": string | null,"created_at": string,"duplicate_of": string | null,"id": string,"merchant": string | null,"note": string | null,"occurred_at": string,"raw_email_id": string | null,"source": Database["public"]['Enums']["txn_source"],"status": Database["public"]['Enums']["txn_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount_centavos": number,"category_id"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"duplicate_of"?: string | null,"id"?: string,"merchant"?: string | null,"note"?: string | null,"occurred_at": string,"raw_email_id"?: string | null,"source"?: Database["public"]['Enums']["txn_source"],"status"?: Database["public"]['Enums']["txn_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"amount_centavos"?: number,"category_id"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"duplicate_of"?: string | null,"id"?: string,"merchant"?: string | null,"note"?: string | null,"occurred_at"?: string,"raw_email_id"?: string | null,"source"?: Database["public"]['Enums']["txn_source"],"status"?: Database["public"]['Enums']["txn_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_duplicate_of_user_id_fkey"
      columns: ["duplicate_of","user_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_raw_email_id_user_id_fkey"
      columns: ["raw_email_id","user_id"]
isOneToOne: false
      referencedRelation: "raw_emails"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "confirm_transaction":
{ Args: { "p_id": string }; Returns: {
              "account_id": string,
"amount_centavos": number,
"category_id": string | null,
"confirmed_at": string | null,
"created_at": string,
"duplicate_of": string | null,
"id": string,
"merchant": string | null,
"note": string | null,
"occurred_at": string,
"raw_email_id": string | null,
"source": Database["public"]['Enums']["txn_source"],
"status": Database["public"]['Enums']["txn_status"],
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } },
"generate_inbound_alias":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"ignore_transaction":
{ Args: { "p_id": string }; Returns: {
              "account_id": string,
"amount_centavos": number,
"category_id": string | null,
"confirmed_at": string | null,
"created_at": string,
"duplicate_of": string | null,
"id": string,
"merchant": string | null,
"note": string | null,
"occurred_at": string,
"raw_email_id": string | null,
"source": Database["public"]['Enums']["txn_source"],
"status": Database["public"]['Enums']["txn_status"],
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } },
"mark_not_duplicate":
{ Args: { "p_id": string }; Returns: {
              "account_id": string,
"amount_centavos": number,
"category_id": string | null,
"confirmed_at": string | null,
"created_at": string,
"duplicate_of": string | null,
"id": string,
"merchant": string | null,
"note": string | null,
"occurred_at": string,
"raw_email_id": string | null,
"source": Database["public"]['Enums']["txn_source"],
"status": Database["public"]['Enums']["txn_status"],
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "account_type": "ewallet"|"savings"|"debit"|"credit"|"bnpl"|"loan","category_kind": "expense"|"income"|"transfer","institution_kind": "bank"|"ewallet"|"bnpl"|"other","raw_email_status": "pending"|"parsed"|"failed"|"flagged","txn_source": "manual"|"email"|"sms"|"recurring"|"statement","txn_status": "pending"|"confirmed"|"ignored"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_type": ["ewallet", "savings", "debit", "credit", "bnpl", "loan"],"category_kind": ["expense", "income", "transfer"],"institution_kind": ["bank", "ewallet", "bnpl", "other"],"raw_email_status": ["pending", "parsed", "failed", "flagged"],"txn_source": ["manual", "email", "sms", "recurring", "statement"],"txn_status": ["pending", "confirmed", "ignored"]
          }
        }
} as const
