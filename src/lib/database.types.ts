
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
                    "archived_at": string | null,"created_at": string,"currency": string,"id": string,"institution_id": string,"last4": string | null,"name": string,"opening_balance_at": string,"opening_balance_centavos": number,"type": Database["public"]['Enums']["account_type"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"institution_id": string,"last4"?: string | null,"name": string,"opening_balance_at"?: string,"opening_balance_centavos"?: number,"type": Database["public"]['Enums']["account_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"institution_id"?: string,"last4"?: string | null,"name"?: string,"opening_balance_at"?: string,"opening_balance_centavos"?: number,"type"?: Database["public"]['Enums']["account_type"],"updated_at"?: string,"user_id"?: string
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
                },"balance_checkpoints": {
                  Row: {
                    "account_id": string,"as_of": string,"balance_centavos": number,"created_at": string,"id": string,"raw_email_id": string | null,"raw_message_id": string | null,"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"as_of": string,"balance_centavos": number,"created_at"?: string,"id"?: string,"raw_email_id"?: string | null,"raw_message_id"?: string | null,"source": string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"as_of"?: string,"balance_centavos"?: number,"created_at"?: string,"id"?: string,"raw_email_id"?: string | null,"raw_message_id"?: string | null,"source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "balance_checkpoints_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "balance_checkpoints_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "balance_checkpoints_raw_email_id_user_id_fkey"
      columns: ["raw_email_id","user_id"]
isOneToOne: false
      referencedRelation: "raw_emails"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "balance_checkpoints_raw_message_id_user_id_fkey"
      columns: ["raw_message_id","user_id"]
isOneToOne: false
      referencedRelation: "raw_messages"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"capture_links": {
                  Row: {
                    "created_at": string,"id": string,"label": string,"last_used_at": string | null,"revoked_at": string | null,"token_hash": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"label": string,"last_used_at"?: string | null,"revoked_at"?: string | null,"token_hash": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"label"?: string,"last_used_at"?: string | null,"revoked_at"?: string | null,"token_hash"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
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
                },"credit_cards": {
                  Row: {
                    "account_id": string,"created_at": string,"credit_limit_centavos": number | null,"due_day": number,"min_payment_bps": number,"min_payment_floor_centavos": number,"monthly_interest_bps": number,"statement_day": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at"?: string,"credit_limit_centavos"?: number | null,"due_day": number,"min_payment_bps": number,"min_payment_floor_centavos"?: number,"monthly_interest_bps": number,"statement_day": number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"credit_limit_centavos"?: number | null,"due_day"?: number,"min_payment_bps"?: number,"min_payment_floor_centavos"?: number,"monthly_interest_bps"?: number,"statement_day"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_cards_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: true
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "credit_cards_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: true
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"forwarding_sources": {
                  Row: {
                    "added_by": string,"confirmation_code": string | null,"confirmation_received_at": string | null,"created_at": string,"email": string,"id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string,"confirmation_code"?: string | null,"confirmation_received_at"?: string | null,"created_at"?: string,"email": string,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "added_by"?: string,"confirmation_code"?: string | null,"confirmation_received_at"?: string | null,"created_at"?: string,"email"?: string,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"imports": {
                  Row: {
                    "account_id": string,"created_at": string,"file_name": string | null,"format": string,"id": string,"period_end": string | null,"period_start": string | null,"rows_added": number,"rows_matched": number,"rows_total": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at"?: string,"file_name"?: string | null,"format": string,"id"?: string,"period_end"?: string | null,"period_start"?: string | null,"rows_added"?: number,"rows_matched"?: number,"rows_total"?: number,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"file_name"?: string | null,"format"?: string,"id"?: string,"period_end"?: string | null,"period_start"?: string | null,"rows_added"?: number,"rows_matched"?: number,"rows_total"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "imports_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "imports_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"income_sources": {
                  Row: {
                    "account_id": string | null,"active": boolean,"amount_centavos": number,"created_at": string,"frequency": Database["public"]['Enums']["pay_frequency"],"id": string,"name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"active"?: boolean,"amount_centavos": number,"created_at"?: string,"frequency": Database["public"]['Enums']["pay_frequency"],"id"?: string,"name": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string | null,"active"?: boolean,"amount_centavos"?: number,"created_at"?: string,"frequency"?: Database["public"]['Enums']["pay_frequency"],"id"?: string,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "income_sources_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "income_sources_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"installment_payments": {
                  Row: {
                    "amount_centavos": number,"created_at": string,"due_date": string,"id": string,"paid_at": string | null,"plan_id": string,"seq": number,"transaction_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_centavos": number,"created_at"?: string,"due_date": string,"id"?: string,"paid_at"?: string | null,"plan_id": string,"seq": number,"transaction_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_centavos"?: number,"created_at"?: string,"due_date"?: string,"id"?: string,"paid_at"?: string | null,"plan_id"?: string,"seq"?: number,"transaction_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "installment_payments_plan_id_user_id_fkey"
      columns: ["plan_id","user_id"]
isOneToOne: false
      referencedRelation: "installment_plans"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "installment_payments_transaction_id_user_id_fkey"
      columns: ["transaction_id","user_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"installment_plans": {
                  Row: {
                    "account_id": string,"created_at": string,"description": string,"first_due_date": string,"frequency": Database["public"]['Enums']["installment_frequency"],"id": string,"installments": number,"total_centavos": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at"?: string,"description": string,"first_due_date": string,"frequency"?: Database["public"]['Enums']["installment_frequency"],"id"?: string,"installments": number,"total_centavos": number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"description"?: string,"first_due_date"?: string,"frequency"?: Database["public"]['Enums']["installment_frequency"],"id"?: string,"installments"?: number,"total_centavos"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "installment_plans_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "installment_plans_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"institutions": {
                  Row: {
                    "app_packages": (string)[],"created_at": string,"email_domains": (string)[],"id": string,"kind": Database["public"]['Enums']["institution_kind"],"name": string,"slug": string | null,"sms_senders": (string)[],"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "app_packages"?: (string)[],"created_at"?: string,"email_domains"?: (string)[],"id"?: string,"kind"?: Database["public"]['Enums']["institution_kind"],"name": string,"slug"?: string | null,"sms_senders"?: (string)[],"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "app_packages"?: (string)[],"created_at"?: string,"email_domains"?: (string)[],"id"?: string,"kind"?: Database["public"]['Enums']["institution_kind"],"name"?: string,"slug"?: string | null,"sms_senders"?: (string)[],"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"loan_payments": {
                  Row: {
                    "amount_centavos": number | null,"created_at": string,"due_date": string,"id": string,"interest_centavos": number,"loan_id": string,"paid_at": string | null,"principal_centavos": number,"seq": number,"transaction_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_centavos"?: never,"created_at"?: string,"due_date": string,"id"?: string,"interest_centavos": number,"loan_id": string,"paid_at"?: string | null,"principal_centavos": number,"seq": number,"transaction_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_centavos"?: never,"created_at"?: string,"due_date"?: string,"id"?: string,"interest_centavos"?: number,"loan_id"?: string,"paid_at"?: string | null,"principal_centavos"?: number,"seq"?: number,"transaction_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loan_payments_loan_id_user_id_fkey"
      columns: ["loan_id","user_id"]
isOneToOne: false
      referencedRelation: "loans"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "loan_payments_transaction_id_user_id_fkey"
      columns: ["transaction_id","user_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"loans": {
                  Row: {
                    "account_id": string,"created_at": string,"first_due_date": string,"id": string,"interest_method": Database["public"]['Enums']["interest_method"],"monthly_rate_bps": number,"payment_centavos": number | null,"principal_centavos": number,"start_date": string,"term_months": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at"?: string,"first_due_date": string,"id"?: string,"interest_method"?: Database["public"]['Enums']["interest_method"],"monthly_rate_bps": number,"payment_centavos"?: number | null,"principal_centavos": number,"start_date": string,"term_months": number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"first_due_date"?: string,"id"?: string,"interest_method"?: Database["public"]['Enums']["interest_method"],"monthly_rate_bps"?: number,"payment_centavos"?: number | null,"principal_centavos"?: number,"start_date"?: string,"term_months"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loans_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "loans_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    }
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
                    "created_at": string,"envelope_to": string | null,"error": string | null,"forwarded_by": string | null,"from_address": string,"from_domain": string,"id": string,"inbound_alias": string,"kind": string | null,"message_id": string | null,"note": string | null,"original_from": string | null,"parsed_at": string | null,"parser": string | null,"parser_version": number | null,"raw_mime": string,"received_at": string,"sender_allowed": boolean,"status": Database["public"]['Enums']["raw_email_status"],"subject": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"envelope_to"?: string | null,"error"?: string | null,"forwarded_by"?: string | null,"from_address": string,"from_domain": string,"id"?: string,"inbound_alias": string,"kind"?: string | null,"message_id"?: string | null,"note"?: string | null,"original_from"?: string | null,"parsed_at"?: string | null,"parser"?: string | null,"parser_version"?: number | null,"raw_mime": string,"received_at"?: string,"sender_allowed"?: boolean,"status"?: Database["public"]['Enums']["raw_email_status"],"subject"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"envelope_to"?: string | null,"error"?: string | null,"forwarded_by"?: string | null,"from_address"?: string,"from_domain"?: string,"id"?: string,"inbound_alias"?: string,"kind"?: string | null,"message_id"?: string | null,"note"?: string | null,"original_from"?: string | null,"parsed_at"?: string | null,"parser"?: string | null,"parser_version"?: number | null,"raw_mime"?: string,"received_at"?: string,"sender_allowed"?: boolean,"status"?: Database["public"]['Enums']["raw_email_status"],"subject"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"raw_messages": {
                  Row: {
                    "body": string | null,"capture_link_id": string | null,"channel": string,"created_at": string,"dedupe_key": string,"id": string,"note": string | null,"parsed_at": string | null,"parser": string | null,"parser_version": number | null,"received_at": string,"sender": string,"status": Database["public"]['Enums']["raw_email_status"],"title": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"capture_link_id"?: string | null,"channel": string,"created_at"?: string,"dedupe_key": string,"id"?: string,"note"?: string | null,"parsed_at"?: string | null,"parser"?: string | null,"parser_version"?: number | null,"received_at": string,"sender": string,"status"?: Database["public"]['Enums']["raw_email_status"],"title"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"capture_link_id"?: string | null,"channel"?: string,"created_at"?: string,"dedupe_key"?: string,"id"?: string,"note"?: string | null,"parsed_at"?: string | null,"parser"?: string | null,"parser_version"?: number | null,"received_at"?: string,"sender"?: string,"status"?: Database["public"]['Enums']["raw_email_status"],"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "raw_messages_capture_link_id_user_id_fkey"
      columns: ["capture_link_id","user_id"]
isOneToOne: false
      referencedRelation: "capture_links"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"recurring_rules": {
                  Row: {
                    "account_id": string,"active": boolean,"amount_centavos": number,"category_id": string | null,"created_at": string,"day_of_month": number | null,"ends_on": string | null,"frequency": Database["public"]['Enums']["pay_frequency"],"id": string,"income_source_id": string | null,"name": string,"next_due_on": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"active"?: boolean,"amount_centavos": number,"category_id"?: string | null,"created_at"?: string,"day_of_month"?: number | null,"ends_on"?: string | null,"frequency": Database["public"]['Enums']["pay_frequency"],"id"?: string,"income_source_id"?: string | null,"name": string,"next_due_on": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"active"?: boolean,"amount_centavos"?: number,"category_id"?: string | null,"created_at"?: string,"day_of_month"?: number | null,"ends_on"?: string | null,"frequency"?: Database["public"]['Enums']["pay_frequency"],"id"?: string,"income_source_id"?: string | null,"name"?: string,"next_due_on"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_rules_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "recurring_rules_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "recurring_rules_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_rules_income_source_id_user_id_fkey"
      columns: ["income_source_id","user_id"]
isOneToOne: false
      referencedRelation: "income_sources"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"statements": {
                  Row: {
                    "account_id": string,"amount_paid_centavos": number,"created_at": string,"due_date": string,"id": string,"minimum_due_centavos": number,"period_end": string,"period_start": string | null,"source": string,"statement_balance_centavos": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount_paid_centavos"?: number,"created_at"?: string,"due_date": string,"id"?: string,"minimum_due_centavos"?: number,"period_end": string,"period_start"?: string | null,"source"?: string,"statement_balance_centavos": number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"amount_paid_centavos"?: number,"created_at"?: string,"due_date"?: string,"id"?: string,"minimum_due_centavos"?: number,"period_end"?: string,"period_start"?: string | null,"source"?: string,"statement_balance_centavos"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "statements_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "statements_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string,"amount_centavos": number,"category_id": string | null,"confirmed_at": string | null,"created_at": string,"duplicate_of": string | null,"id": string,"import_id": string | null,"merchant": string | null,"note": string | null,"occurred_at": string,"raw_email_id": string | null,"raw_message_id": string | null,"recurring_rule_id": string | null,"source": Database["public"]['Enums']["txn_source"],"status": Database["public"]['Enums']["txn_status"],"transfer_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount_centavos": number,"category_id"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"duplicate_of"?: string | null,"id"?: string,"import_id"?: string | null,"merchant"?: string | null,"note"?: string | null,"occurred_at": string,"raw_email_id"?: string | null,"raw_message_id"?: string | null,"recurring_rule_id"?: string | null,"source"?: Database["public"]['Enums']["txn_source"],"status"?: Database["public"]['Enums']["txn_status"],"transfer_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"amount_centavos"?: number,"category_id"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"duplicate_of"?: string | null,"id"?: string,"import_id"?: string | null,"merchant"?: string | null,"note"?: string | null,"occurred_at"?: string,"raw_email_id"?: string | null,"raw_message_id"?: string | null,"recurring_rule_id"?: string | null,"source"?: Database["public"]['Enums']["txn_source"],"status"?: Database["public"]['Enums']["txn_status"],"transfer_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
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
      foreignKeyName: "transactions_import_id_user_id_fkey"
      columns: ["import_id","user_id"]
isOneToOne: false
      referencedRelation: "imports"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_raw_email_id_user_id_fkey"
      columns: ["raw_email_id","user_id"]
isOneToOne: false
      referencedRelation: "raw_emails"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_raw_message_id_user_id_fkey"
      columns: ["raw_message_id","user_id"]
isOneToOne: false
      referencedRelation: "raw_messages"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_recurring_rule_id_user_id_fkey"
      columns: ["recurring_rule_id","user_id"]
isOneToOne: false
      referencedRelation: "recurring_rules"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            "account_balances": {
                  Row: {
                    "account_id": string | null,"balance_centavos": number | null,"pending_count": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"account_reconciliation": {
                  Row: {
                    "account_id": string | null,"as_of": string | null,"checkpoint_id": string | null,"confirmed_centavos": number | null,"pending_centavos": number | null,"reported_centavos": number | null,"source": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "balance_checkpoints_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "balance_checkpoints_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Functions: {
            "capture_message":
{ Args: { "p_body": string,"p_channel": string,"p_dedupe_key": string,"p_flag_note"?: string,"p_received_at": string,"p_sender": string,"p_title": string,"p_token_hash": string }; Returns: {
              "result": string,"user_id": string
            }[]
                           },
"confirm_as_transfer":
{ Args: { "p_in_id": string,"p_out_id": string }; Returns: string
                           },
"confirm_one_sided_transfer":
{ Args: { "p_id": string,"p_other_account": string }; Returns: string
                           },
"confirm_transaction":
{ Args: { "p_category_id"?: string,"p_id": string }; Returns: {
              "account_id": string,
"amount_centavos": number,
"category_id": string | null,
"confirmed_at": string | null,
"created_at": string,
"duplicate_of": string | null,
"id": string,
"import_id": string | null,
"merchant": string | null,
"note": string | null,
"occurred_at": string,
"raw_email_id": string | null,
"raw_message_id": string | null,
"recurring_rule_id": string | null,
"source": Database["public"]['Enums']["txn_source"],
"status": Database["public"]['Enums']["txn_status"],
"transfer_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_transfer":
{ Args: { "p_amount_centavos": number,"p_fee_centavos"?: number,"p_from_account": string,"p_note"?: string,"p_occurred_at": string,"p_to_account": string }; Returns: string
                           },
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
"import_id": string | null,
"merchant": string | null,
"note": string | null,
"occurred_at": string,
"raw_email_id": string | null,
"raw_message_id": string | null,
"recurring_rule_id": string | null,
"source": Database["public"]['Enums']["txn_source"],
"status": Database["public"]['Enums']["txn_status"],
"transfer_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } },
"ingest_raw_email":
{ Args: { "p_alias": string,"p_envelope_from": string,"p_envelope_to": string,"p_message_id": string,"p_raw_mime": string,"p_subject": string }; Returns: string
                           },
"mark_not_duplicate":
{ Args: { "p_id": string }; Returns: {
              "account_id": string,
"amount_centavos": number,
"category_id": string | null,
"confirmed_at": string | null,
"created_at": string,
"duplicate_of": string | null,
"id": string,
"import_id": string | null,
"merchant": string | null,
"note": string | null,
"occurred_at": string,
"raw_email_id": string | null,
"raw_message_id": string | null,
"recurring_rule_id": string | null,
"source": Database["public"]['Enums']["txn_source"],
"status": Database["public"]['Enums']["txn_status"],
"transfer_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } },
"reopen_transaction":
{ Args: { "p_id": string }; Returns: {
              "account_id": string,
"amount_centavos": number,
"category_id": string | null,
"confirmed_at": string | null,
"created_at": string,
"duplicate_of": string | null,
"id": string,
"import_id": string | null,
"merchant": string | null,
"note": string | null,
"occurred_at": string,
"raw_email_id": string | null,
"raw_message_id": string | null,
"recurring_rule_id": string | null,
"source": Database["public"]['Enums']["txn_source"],
"status": Database["public"]['Enums']["txn_status"],
"transfer_id": string | null,
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
            "account_type": "ewallet"|"savings"|"debit"|"credit"|"bnpl"|"loan","category_kind": "expense"|"income"|"transfer","installment_frequency": "monthly"|"biweekly","institution_kind": "bank"|"ewallet"|"bnpl"|"other","interest_method": "diminishing"|"add_on","pay_frequency": "weekly"|"biweekly"|"semi_monthly"|"monthly"|"quarterly"|"yearly","raw_email_status": "pending"|"parsed"|"failed"|"flagged","txn_source": "manual"|"email"|"sms"|"recurring"|"statement","txn_status": "pending"|"confirmed"|"ignored"
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
            "account_type": ["ewallet", "savings", "debit", "credit", "bnpl", "loan"],"category_kind": ["expense", "income", "transfer"],"installment_frequency": ["monthly", "biweekly"],"institution_kind": ["bank", "ewallet", "bnpl", "other"],"interest_method": ["diminishing", "add_on"],"pay_frequency": ["weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly"],"raw_email_status": ["pending", "parsed", "failed", "flagged"],"txn_source": ["manual", "email", "sms", "recurring", "statement"],"txn_status": ["pending", "confirmed", "ignored"]
          }
        }
} as const
