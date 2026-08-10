// Generated-style TypeScript types matching the Supabase schema in supabase/schema.sql.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Role = 'user' | 'moderator' | 'admin'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          role: Role
          is_banned: boolean
          created_at: string
          last_sign_in_at: string | null
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          role?: Role
          is_banned?: boolean
          created_at?: string
          last_sign_in_at?: string | null
        }
        Update: Partial<{
          email: string | null
          full_name: string | null
          avatar_url: string | null
          role: Role
          is_banned: boolean
          last_sign_in_at: string | null
        }>
        Relationships: []
      }
      reviews: {
        Row: {
          id: string
          tool_slug: string
          tool_name: string | null
          rating: number
          review_text: string | null
          user_id: string
          user_name: string | null
          user_avatar: string | null
          is_approved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tool_slug: string
          tool_name?: string | null
          rating: number
          review_text?: string | null
          user_id: string
          user_name?: string | null
          user_avatar?: string | null
          is_approved?: boolean
          created_at?: string
        }
        Update: Partial<{
          tool_slug: string
          tool_name: string | null
          rating: number
          review_text: string | null
          user_id: string
          user_name: string | null
          user_avatar: string | null
          is_approved: boolean
          created_at: string
        }>
        Relationships: []
      }
      bookmarks: {
        Row: {
          id: string
          user_id: string
          tool_slug: string
          tool_name: string | null
          tool_url: string | null
          tool_emoji: string | null
          created_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      downloads: {
        Row: {
          id: string
          user_id: string
          tool_slug: string
          tool_name: string | null
          file_name: string | null
          file_type: string | null
          downloaded_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          actor_email: string | null
          action: string
          target_type: string | null
          target_id: string | null
          metadata: Json | null
          ip: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          actor_email?: string | null
          action: string
          target_type?: string | null
          target_id?: string | null
          metadata?: Json | null
          ip?: string | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      content: {
        Row: {
          id: number
          type: string
          slug: string
          title: string
          body: string | null
          description: string | null
          image: string | null
          published: boolean
          author_id: string | null
          meta_title: string | null
          meta_description: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: number
          type: string
          slug: string
          title: string
          body?: string | null
          description?: string | null
          image?: string | null
          published?: boolean
          author_id?: string | null
          meta_title?: string | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<{
          id: number
          type: string
          slug: string
          title: string
          body: string | null
          description: string | null
          image: string | null
          published: boolean
          author_id: string | null
          meta_title: string | null
          meta_description: string | null
          updated_at: string
          created_at: string
        }>
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          value: string | null
          value_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value?: string | null
          value_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: Partial<{
          key: string
          value: string | null
          value_type: string
          updated_at: string
          updated_by: string | null
        }>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: { role: Role }
    CompositeTypes: Record<string, never>
  }
}