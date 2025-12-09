export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      asset_prices: {
        Row: {
          asset: string
          current_price: number
          last_updated: string | null
        }
        Insert: {
          asset: string
          current_price: number
          last_updated?: string | null
        }
        Update: {
          asset?: string
          current_price?: number
          last_updated?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          user_id: string
          wallet: string | null
        }
        Insert: {
          address?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          user_id: string
          wallet?: string | null
        }
        Update: {
          address?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          user_id?: string
          wallet?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          tax_id: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          tax_id?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          tax_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crypto_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          gas_fee: number | null
          id: string
          invoice_id: string | null
          payment_status: string | null
          recipient_address: string
          transaction_hash: string | null
          updated_at: string
          usd_amount: number | null
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          description?: string | null
          gas_fee?: number | null
          id?: string
          invoice_id?: string | null
          payment_status?: string | null
          recipient_address: string
          transaction_hash?: string | null
          updated_at?: string
          usd_amount?: number | null
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          gas_fee?: number | null
          id?: string
          invoice_id?: string | null
          payment_status?: string | null
          recipient_address?: string
          transaction_hash?: string | null
          updated_at?: string
          usd_amount?: number | null
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_exchange_rates: {
        Row: {
          created_at: string
          date: string
          rate: number
          source_currency: string
          target_currency: string
        }
        Insert: {
          created_at?: string
          date: string
          rate: number
          source_currency: string
          target_currency: string
        }
        Update: {
          created_at?: string
          date?: string
          rate?: number
          source_currency?: string
          target_currency?: string
        }
        Relationships: []
      }
      exchange_accounts: {
        Row: {
          account_uid: string
          connection_id: number | null
          id: number
          type: string | null
        }
        Insert: {
          account_uid: string
          connection_id?: number | null
          id?: never
          type?: string | null
        }
        Update: {
          account_uid?: string
          connection_id?: number | null
          id?: never
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "exchange_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_api_credentials: {
        Row: {
          created_at: string
          enc_blob: string
          exchange: string
          external_user_id: string | null
          id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enc_blob: string
          exchange: string
          external_user_id?: string | null
          id?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enc_blob?: string
          exchange?: string
          external_user_id?: string | null
          id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exchange_balances: {
        Row: {
          account_id: number | null
          asset: string
          at: string
          free: number | null
          id: number
          locked: number | null
          total: number | null
        }
        Insert: {
          account_id?: number | null
          asset: string
          at: string
          free?: number | null
          id?: never
          locked?: number | null
          total?: number | null
        }
        Update: {
          account_id?: number | null
          asset?: string
          at?: string
          free?: number | null
          id?: never
          locked?: number | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "exchange_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_connections: {
        Row: {
          api_key: string | null
          api_secret: string | null
          connection_name: string
          created_at: string | null
          encrypted_blob: string | null
          exchange: string
          external_user_id: string | null
          id: number
          label: string | null
          oauth_access_token: string | null
          oauth_provider: string | null
          oauth_refresh_token: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          connection_name: string
          created_at?: string | null
          encrypted_blob?: string | null
          exchange: string
          external_user_id?: string | null
          id?: never
          label?: string | null
          oauth_access_token?: string | null
          oauth_provider?: string | null
          oauth_refresh_token?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          connection_name?: string
          created_at?: string | null
          encrypted_blob?: string | null
          exchange?: string
          external_user_id?: string | null
          id?: never
          label?: string | null
          oauth_access_token?: string | null
          oauth_provider?: string | null
          oauth_refresh_token?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exchange_trade_values: {
        Row: {
          asset: string | null
          base_amount: number | null
          created_at: string | null
          exchange_trade_id: string
          fee: number | null
          fee_asset: string | null
          fiat_value_usd: number | null
          price_usd: number | null
          symbol: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asset?: string | null
          base_amount?: number | null
          created_at?: string | null
          exchange_trade_id: string
          fee?: number | null
          fee_asset?: string | null
          fiat_value_usd?: number | null
          price_usd?: number | null
          symbol?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asset?: string | null
          base_amount?: number | null
          created_at?: string | null
          exchange_trade_id?: string
          fee?: number | null
          fee_asset?: string | null
          fiat_value_usd?: number | null
          price_usd?: number | null
          symbol?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exchange_trades: {
        Row: {
          amount: number
          created_at: string | null
          exchange: string
          exchange_connection_id: number | null
          external_id: string | null
          fee: number | null
          fee_asset: string | null
          fee_currency: string | null
          id: string
          note: string | null
          price: number
          raw_data: Json | null
          side: string
          symbol: string
          trade_id: string
          ts: string
          updated_at: string | null
          usage: string | null
          user_id: string
          value_usd: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          exchange: string
          exchange_connection_id?: number | null
          external_id?: string | null
          fee?: number | null
          fee_asset?: string | null
          fee_currency?: string | null
          id?: string
          note?: string | null
          price: number
          raw_data?: Json | null
          side: string
          symbol: string
          trade_id: string
          ts: string
          updated_at?: string | null
          usage?: string | null
          user_id: string
          value_usd?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          exchange?: string
          exchange_connection_id?: number | null
          external_id?: string | null
          fee?: number | null
          fee_asset?: string | null
          fee_currency?: string | null
          id?: string
          note?: string | null
          price?: number
          raw_data?: Json | null
          side?: string
          symbol?: string
          trade_id?: string
          ts?: string
          updated_at?: string | null
          usage?: string | null
          user_id?: string
          value_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_exchange_connections"
            columns: ["exchange_connection_id"]
            isOneToOne: false
            referencedRelation: "exchange_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_transfers: {
        Row: {
          account_id: number | null
          amount: number
          asset: string
          direction: string | null
          id: number
          network: string | null
          occurred_at: string
          raw: Json | null
          txid: string | null
        }
        Insert: {
          account_id?: number | null
          amount: number
          asset: string
          direction?: string | null
          id?: never
          network?: string | null
          occurred_at: string
          raw?: Json | null
          txid?: string | null
        }
        Update: {
          account_id?: number | null
          amount?: number
          asset?: string
          direction?: string | null
          id?: never
          network?: string | null
          occurred_at?: string
          raw?: Json | null
          txid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_transfers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "exchange_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_transfer_links: {
        Row: {
          created_at: string
          id: number
          in_tx_id: number
          out_tx_id: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: number
          in_tx_id: number
          out_tx_id: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: number
          in_tx_id?: number
          out_tx_id?: number
          reason?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          billing_address: string | null
          client_id: string | null
          company_address: string | null
          company_id: string | null
          company_wallet_address: string | null
          created_at: string
          currency: string
          customer_id: string | null
          customer_name: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string | null
          items: Json | null
          memo: string | null
          notes: string | null
          number: string | null
          status: string
          subtotal: number | null
          tax: number | null
          tax_rate: number | null
          total: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_address?: string | null
          client_id?: string | null
          company_address?: string | null
          company_id?: string | null
          company_wallet_address?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string | null
          items?: Json | null
          memo?: string | null
          notes?: string | null
          number?: string | null
          status?: string
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          total?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_address?: string | null
          client_id?: string | null
          company_address?: string | null
          company_id?: string | null
          company_wallet_address?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string | null
          items?: Json | null
          memo?: string | null
          notes?: string | null
          number?: string | null
          status?: string
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          total?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          account: string
          amount: number
          currency: string
          dc: string
          entry_date: string
          id: number
          memo: string | null
          tx_id: number | null
          user_id: string
        }
        Insert: {
          account: string
          amount: number
          currency?: string
          dc: string
          entry_date: string
          id?: number
          memo?: string | null
          tx_id?: number | null
          user_id: string
        }
        Update: {
          account?: string
          amount?: number
          currency?: string
          dc?: string
          entry_date?: string
          id?: number
          memo?: string | null
          tx_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: false
            referencedRelation: "internal_transfer_candidates"
            referencedColumns: ["in_tx_id"]
          },
          {
            foreignKeyName: "journal_entries_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: false
            referencedRelation: "internal_transfer_candidates"
            referencedColumns: ["out_tx_id"]
          },
          {
            foreignKeyName: "journal_entries_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: false
            referencedRelation: "wallet_transaction"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: false
            referencedRelation: "wallet_tx_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: false
            referencedRelation: "wallet_tx_with_flags"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_code: string
          created_at: string | null
          credit: number
          debit: number
          entry_id: number
          id: number
          meta: Json | null
        }
        Insert: {
          account_code: string
          created_at?: string | null
          credit?: number
          debit?: number
          entry_id: number
          id?: number
          meta?: Json | null
        }
        Update: {
          account_code?: string
          created_at?: string | null
          credit?: number
          debit?: number
          entry_id?: number
          id?: number
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_events: {
        Row: {
          amount: number | null
          cost: number
          created_at: string
          currency: string | null
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          cost: number
          created_at?: string
          currency?: string | null
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          cost?: number
          created_at?: string
          currency?: string | null
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          status: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_merchants: {
        Row: {
          allowed_networks: string[] | null
          created_at: string
          default_currency: string | null
          id: string
          store_name: string | null
          updated_at: string
          user_id: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          allowed_networks?: string[] | null
          created_at?: string
          default_currency?: string | null
          id?: string
          store_name?: string | null
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          allowed_networks?: string[] | null
          created_at?: string
          default_currency?: string | null
          id?: string
          store_name?: string | null
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      payment_vault_addresses: {
        Row: {
          address: string
          asset: string
          created_at: string | null
          id: number
          network: string
          user_id: string
        }
        Insert: {
          address: string
          asset: string
          created_at?: string | null
          id?: number
          network: string
          user_id: string
        }
        Update: {
          address?: string
          asset?: string
          created_at?: string | null
          id?: number
          network?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          entity_type: string | null
          gateway_enabled: boolean | null
          id: string
          income_bracket: string | null
          plan_type: string | null
          primary_wallet: string | null
          region: string | null
          seats_limit: number | null
          state_of_incorporation: string | null
          tax_country: string | null
          updated_at: string
          us_entity_type: string | null
          us_state_of_incorporation: string | null
          user_id: string
          verify_nonce: string | null
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          entity_type?: string | null
          gateway_enabled?: boolean | null
          id?: string
          income_bracket?: string | null
          plan_type?: string | null
          primary_wallet?: string | null
          region?: string | null
          seats_limit?: number | null
          state_of_incorporation?: string | null
          tax_country?: string | null
          updated_at?: string
          us_entity_type?: string | null
          us_state_of_incorporation?: string | null
          user_id: string
          verify_nonce?: string | null
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          entity_type?: string | null
          gateway_enabled?: boolean | null
          id?: string
          income_bracket?: string | null
          plan_type?: string | null
          primary_wallet?: string | null
          region?: string | null
          seats_limit?: number | null
          state_of_incorporation?: string | null
          tax_country?: string | null
          updated_at?: string
          us_entity_type?: string | null
          us_state_of_incorporation?: string | null
          user_id?: string
          verify_nonce?: string | null
        }
        Relationships: []
      }
      transaction_purposes: {
        Row: {
          purpose: string
          source: string
          source_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          purpose: string
          source: string
          source_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          purpose?: string
          source?: string
          source_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_usage_labels: {
        Row: {
          confidence: number | null
          ctx_id: string | null
          id: number
          tx_id: number | null
          updated_at: string | null
          usage_key: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          ctx_id?: string | null
          id?: number
          tx_id?: number | null
          updated_at?: string | null
          usage_key?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          ctx_id?: string | null
          id?: number
          tx_id?: number | null
          updated_at?: string | null
          usage_key?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transaction_usages: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          source_id: string
          source_type: string | null
          updated_at: string | null
          usage_manual: string | null
          usage_predicted: string | null
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          source_id: string
          source_type?: string | null
          updated_at?: string | null
          usage_manual?: string | null
          usage_predicted?: string | null
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          source_id?: string
          source_type?: string | null
          updated_at?: string | null
          usage_manual?: string | null
          usage_predicted?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          asset_contract: string | null
          asset_decimals: number | null
          asset_symbol: string | null
          block_number: number | null
          blockchain_network: string
          chain_id: number | null
          created_at: string
          currency: string
          direction: string | null
          fee_native: number | null
          from_address: string | null
          gas_fee: number | null
          gas_fee_usd: number | null
          id: string
          inserted_at: string | null
          log_index: number | null
          network: string | null
          price_source: string | null
          to_address: string | null
          transaction_date: string
          transaction_hash: string
          transaction_status: string | null
          transaction_type: string
          type: string | null
          updated_at: string
          usd_fee_at_tx: number | null
          usd_value: number | null
          usd_value_at_tx: number | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          asset_contract?: string | null
          asset_decimals?: number | null
          asset_symbol?: string | null
          block_number?: number | null
          blockchain_network: string
          chain_id?: number | null
          created_at?: string
          currency: string
          direction?: string | null
          fee_native?: number | null
          from_address?: string | null
          gas_fee?: number | null
          gas_fee_usd?: number | null
          id?: string
          inserted_at?: string | null
          log_index?: number | null
          network?: string | null
          price_source?: string | null
          to_address?: string | null
          transaction_date: string
          transaction_hash: string
          transaction_status?: string | null
          transaction_type: string
          type?: string | null
          updated_at?: string
          usd_fee_at_tx?: number | null
          usd_value?: number | null
          usd_value_at_tx?: number | null
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          asset_contract?: string | null
          asset_decimals?: number | null
          asset_symbol?: string | null
          block_number?: number | null
          blockchain_network?: string
          chain_id?: number | null
          created_at?: string
          currency?: string
          direction?: string | null
          fee_native?: number | null
          from_address?: string | null
          gas_fee?: number | null
          gas_fee_usd?: number | null
          id?: string
          inserted_at?: string | null
          log_index?: number | null
          network?: string | null
          price_source?: string | null
          to_address?: string | null
          transaction_date?: string
          transaction_hash?: string
          transaction_status?: string | null
          transaction_type?: string
          type?: string | null
          updated_at?: string
          usd_fee_at_tx?: number | null
          usd_value?: number | null
          usd_value_at_tx?: number | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      transfer_links: {
        Row: {
          confidence: number
          created_at: string | null
          exchange_transfer_id: number
          id: number
          user_id: string
          wallet_tx_id: number
        }
        Insert: {
          confidence: number
          created_at?: string | null
          exchange_transfer_id: number
          id?: never
          user_id: string
          wallet_tx_id: number
        }
        Update: {
          confidence?: number
          created_at?: string | null
          exchange_transfer_id?: number
          id?: never
          user_id?: string
          wallet_tx_id?: number
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string | null
          currency: string | null
          id: string
          invoice_id: string | null
          status: string | null
          user_id: string | null
          wallet_address: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_id?: string | null
          status?: string | null
          user_id?: string | null
          wallet_address: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_id?: string | null
          status?: string | null
          user_id?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_categories: {
        Row: {
          description: string | null
          ifrs_standard: string | null
          key: string
        }
        Insert: {
          description?: string | null
          ifrs_standard?: string | null
          key: string
        }
        Update: {
          description?: string | null
          ifrs_standard?: string | null
          key?: string
        }
        Relationships: []
      }
      user_monthly_counters: {
        Row: {
          bundles_used: number | null
          created_at: string
          event_count: number | null
          id: string
          month_year: string
          total_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bundles_used?: number | null
          created_at?: string
          event_count?: number | null
          id?: string
          month_year: string
          total_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bundles_used?: number | null
          created_at?: string
          event_count?: number | null
          id?: string
          month_year?: string
          total_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          device_fingerprint: string | null
          first_seen: string
          id: string
          ip_address: unknown
          last_seen: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          device_fingerprint?: string | null
          first_seen?: string
          id?: string
          ip_address?: unknown
          last_seen?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          device_fingerprint?: string | null
          first_seen?: string
          id?: string
          ip_address?: unknown
          last_seen?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallet_connections: {
        Row: {
          balance_usd: number | null
          chain: string | null
          chain_last_synced_at: Json | null
          created_at: string
          id: string
          is_primary: boolean | null
          last_sync_at: string | null
          updated_at: string
          user_id: string
          verification_signature: string | null
          verification_status: string | null
          verified_at: string | null
          wallet_address: string
          wallet_name: string | null
          wallet_type: string
        }
        Insert: {
          balance_usd?: number | null
          chain?: string | null
          chain_last_synced_at?: Json | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          last_sync_at?: string | null
          updated_at?: string
          user_id: string
          verification_signature?: string | null
          verification_status?: string | null
          verified_at?: string | null
          wallet_address: string
          wallet_name?: string | null
          wallet_type: string
        }
        Update: {
          balance_usd?: number | null
          chain?: string | null
          chain_last_synced_at?: Json | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          last_sync_at?: string | null
          updated_at?: string
          user_id?: string
          verification_signature?: string | null
          verification_status?: string | null
          verified_at?: string | null
          wallet_address?: string
          wallet_name?: string | null
          wallet_type?: string
        }
        Relationships: []
      }
      wallet_nonces: {
        Row: {
          created_at: string
          expires_at: string
          nonce: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          nonce: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          nonce?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_sync_state: {
        Row: {
          chain_id: number
          last_block: number
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          chain_id?: number
          last_block?: number
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          chain_id?: number
          last_block?: number
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          asset_decimals: number | null
          asset_symbol: string | null
          block_number: number | null
          chain_id: number
          created_at: string
          direction: string
          fiat_value_usd: number | null
          from_address: string | null
          id: number
          note: string | null
          occurred_at: string | null
          price_usd: number | null
          raw: Json
          timestamp: string | null
          to_address: string | null
          tx_hash: string
          usage: string | null
          usd_value_at_tx: number | null
          user_id: string
          value_usd: number | null
          value_wei: number | null
          wallet_address: string
        }
        Insert: {
          asset_decimals?: number | null
          asset_symbol?: string | null
          block_number?: number | null
          chain_id?: number
          created_at?: string
          direction: string
          fiat_value_usd?: number | null
          from_address?: string | null
          id?: number
          note?: string | null
          occurred_at?: string | null
          price_usd?: number | null
          raw?: Json
          timestamp?: string | null
          to_address?: string | null
          tx_hash: string
          usage?: string | null
          usd_value_at_tx?: number | null
          user_id: string
          value_usd?: number | null
          value_wei?: number | null
          wallet_address: string
        }
        Update: {
          asset_decimals?: number | null
          asset_symbol?: string | null
          block_number?: number | null
          chain_id?: number
          created_at?: string
          direction?: string
          fiat_value_usd?: number | null
          from_address?: string | null
          id?: number
          note?: string | null
          occurred_at?: string | null
          price_usd?: number | null
          raw?: Json
          timestamp?: string | null
          to_address?: string | null
          tx_hash?: string
          usage?: string | null
          usd_value_at_tx?: number | null
          user_id?: string
          value_usd?: number | null
          value_wei?: number | null
          wallet_address?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          address: string
          created_at: string | null
          id: string
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          address: string
          created_at?: string | null
          id?: string
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          address?: string
          created_at?: string | null
          id?: string
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      all_transactions: {
        Row: {
          account_identifier: string | null
          acquisition_price_total: number | null
          amount: number | null
          asset: string | null
          chain: string | null
          date: string | null
          description: string | null
          id: string | null
          note: string | null
          price: number | null
          reference_id: string | null
          source: string | null
          type: string | null
          usage: string | null
          user_id: string | null
          value_in_usd: number | null
        }
        Relationships: []
      }
      internal_transfer_candidates: {
        Row: {
          amount_delta: number | null
          amount_delta_rate: number | null
          chain_id: number | null
          diff_seconds: number | null
          in_tx_id: number | null
          out_tx_id: number | null
          reason: string | null
          user_id: string | null
        }
        Relationships: []
      }
      internal_transfer_pairs: {
        Row: {
          deposit_id: string | null
          user_id: string | null
          withdrawal_id: string | null
        }
        Relationships: []
      }
      v_all_transactions: {
        Row: {
          acquisition_price_total: number | null
          amount: number | null
          asset: string | null
          chain: string | null
          date: string | null
          description: string | null
          id: string | null
          price: number | null
          quote_asset: string | null
          reference_id: string | null
          source: string | null
          type: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_balance_sheet: {
        Row: {
          cash: number | null
          intangible_assets: number | null
          inventory: number | null
          retained_earnings: number | null
          total_assets: number | null
          total_liabilities_and_equity: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_cash_flow_statement: {
        Row: {
          cash_in_from_financing: number | null
          cash_in_from_intangibles: number | null
          cash_in_from_inventory_sales: number | null
          cash_in_from_revenue: number | null
          cash_out_for_gas_fees: number | null
          cash_out_for_intangibles: number | null
          cash_out_for_inventory: number | null
          cash_out_to_owners: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_holdings: {
        Row: {
          asset: string | null
          average_buy_price: number | null
          capital_gain: number | null
          current_amount: number | null
          current_price: number | null
          current_value_usd: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_profit_loss_statement: {
        Row: {
          cost_of_sales: number | null
          crypto_losses: number | null
          gas_fees: number | null
          impairment_losses: number | null
          net_income: number | null
          other_revenue: number | null
          realized_gains_on_sale: number | null
          sales_revenue: number | null
          staking_and_mining_rewards: number | null
          user_id: string | null
        }
        Relationships: []
      }
      wallet_transaction: {
        Row: {
          asset_decimals: number | null
          asset_symbol: string | null
          block_number: number | null
          chain_id: number | null
          created_at: string | null
          direction: string | null
          fiat_value_usd: number | null
          from_address: string | null
          id: number | null
          occurred_at: string | null
          price_usd: number | null
          raw: Json | null
          timestamp: string | null
          to_address: string | null
          tx_hash: string | null
          user_id: string | null
          value_wei: number | null
          wallet_address: string | null
        }
        Insert: {
          asset_decimals?: number | null
          asset_symbol?: string | null
          block_number?: number | null
          chain_id?: number | null
          created_at?: string | null
          direction?: string | null
          fiat_value_usd?: number | null
          from_address?: string | null
          id?: number | null
          occurred_at?: string | null
          price_usd?: number | null
          raw?: Json | null
          timestamp?: string | null
          to_address?: string | null
          tx_hash?: string | null
          user_id?: string | null
          value_wei?: number | null
          wallet_address?: string | null
        }
        Update: {
          asset_decimals?: number | null
          asset_symbol?: string | null
          block_number?: number | null
          chain_id?: number | null
          created_at?: string | null
          direction?: string | null
          fiat_value_usd?: number | null
          from_address?: string | null
          id?: number | null
          occurred_at?: string | null
          price_usd?: number | null
          raw?: Json | null
          timestamp?: string | null
          to_address?: string | null
          tx_hash?: string | null
          user_id?: string | null
          value_wei?: number | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      wallet_tx_norm: {
        Row: {
          amount: number | null
          chain_id: number | null
          counterparty_address: string | null
          direction: string | null
          id: number | null
          occurred_at: string | null
          tx_hash: string | null
          user_id: string | null
          wallet_address: string | null
        }
        Insert: {
          amount?: never
          chain_id?: never
          counterparty_address?: never
          direction?: never
          id?: number | null
          occurred_at?: never
          tx_hash?: never
          user_id?: string | null
          wallet_address?: never
        }
        Update: {
          amount?: never
          chain_id?: never
          counterparty_address?: never
          direction?: never
          id?: number | null
          occurred_at?: never
          tx_hash?: never
          user_id?: string | null
          wallet_address?: never
        }
        Relationships: []
      }
      wallet_tx_with_flags: {
        Row: {
          asset_decimals: number | null
          asset_symbol: string | null
          block_number: number | null
          chain_id: number | null
          created_at: string | null
          direction: string | null
          fiat_value_usd: number | null
          from_address: string | null
          id: number | null
          is_internal_transfer: boolean | null
          occurred_at: string | null
          price_usd: number | null
          raw: Json | null
          timestamp: string | null
          to_address: string | null
          tx_hash: string | null
          user_id: string | null
          value_wei: number | null
          wallet_address: string | null
        }
        Insert: {
          asset_decimals?: number | null
          asset_symbol?: string | null
          block_number?: number | null
          chain_id?: number | null
          created_at?: string | null
          direction?: string | null
          fiat_value_usd?: number | null
          from_address?: string | null
          id?: number | null
          is_internal_transfer?: never
          occurred_at?: string | null
          price_usd?: number | null
          raw?: Json | null
          timestamp?: string | null
          to_address?: string | null
          tx_hash?: string | null
          user_id?: string | null
          value_wei?: number | null
          wallet_address?: string | null
        }
        Update: {
          asset_decimals?: number | null
          asset_symbol?: string | null
          block_number?: number | null
          chain_id?: number | null
          created_at?: string | null
          direction?: string | null
          fiat_value_usd?: number | null
          from_address?: string | null
          id?: number | null
          is_internal_transfer?: never
          occurred_at?: string | null
          price_usd?: number | null
          raw?: Json | null
          timestamp?: string | null
          to_address?: string | null
          tx_hash?: string | null
          user_id?: string | null
          value_wei?: number | null
          wallet_address?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      decrypt_secret: {
        Args: { enc_input: string; key_input: string }
        Returns: string
      }
      encrypt_secret: {
        Args: { key_input: string; plain_input: string }
        Returns: string
      }
      get_decrypted_connection: {
        Args: { p_exchange: string; p_user_id: string }
        Returns: {
          api_key: string
          api_secret: string
        }[]
      }
    }
    Enums: {
      us_entity_type_enum:
        | "C Corporation"
        | "S Corporation"
        | "LLC"
        | "Partnership"
        | "PC/PA"
        | "PBC"
      us_state_of_incorporation_enum:
        | "Alabama"
        | "Alaska"
        | "Arizona"
        | "Wyoming"
        | "District of Columbia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      us_entity_type_enum: [
        "C Corporation",
        "S Corporation",
        "LLC",
        "Partnership",
        "PC/PA",
        "PBC",
      ],
      us_state_of_incorporation_enum: [
        "Alabama",
        "Alaska",
        "Arizona",
        "Wyoming",
        "District of Columbia",
      ],
    },
  },
} as const
