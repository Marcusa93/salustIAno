export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      ai_logs: {
        Row: {
          actor_user_id: string | null;
          agent: string;
          child_id: string | null;
          completion_tokens: number | null;
          created_at: string;
          error: string | null;
          family_group_id: string | null;
          id: string;
          latency_ms: number | null;
          model: string;
          prompt_tokens: number | null;
          prompt_version: string | null;
          total_tokens: number | null;
        };
        Insert: {
          actor_user_id?: string | null;
          agent: string;
          child_id?: string | null;
          completion_tokens?: number | null;
          created_at?: string;
          error?: string | null;
          family_group_id?: string | null;
          id?: string;
          latency_ms?: number | null;
          model: string;
          prompt_tokens?: number | null;
          prompt_version?: string | null;
          total_tokens?: number | null;
        };
        Update: {
          actor_user_id?: string | null;
          agent?: string;
          child_id?: string | null;
          completion_tokens?: number | null;
          created_at?: string;
          error?: string | null;
          family_group_id?: string | null;
          id?: string;
          latency_ms?: number | null;
          model?: string;
          prompt_tokens?: number | null;
          prompt_version?: string | null;
          total_tokens?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_logs_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_logs_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      albums: {
        Row: {
          child_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          family_group_id: string;
          id: string;
          kind: Database['public']['Enums']['album_kind'];
          month_key: string | null;
          name: string;
          share_token: string | null;
          shared_at: string | null;
          updated_at: string;
        };
        Insert: {
          child_id?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id: string;
          id?: string;
          kind?: Database['public']['Enums']['album_kind'];
          month_key?: string | null;
          name: string;
          share_token?: string | null;
          shared_at?: string | null;
          updated_at?: string;
        };
        Update: {
          child_id?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id?: string;
          id?: string;
          kind?: Database['public']['Enums']['album_kind'];
          month_key?: string | null;
          name?: string;
          share_token?: string | null;
          shared_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'albums_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'albums_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: Database['public']['Enums']['audit_action'];
          actor_user_id: string | null;
          created_at: string;
          family_group_id: string | null;
          id: string;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string;
          table_name: string;
        };
        Insert: {
          action: Database['public']['Enums']['audit_action'];
          actor_user_id?: string | null;
          created_at?: string;
          family_group_id?: string | null;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id: string;
          table_name: string;
        };
        Update: {
          action?: Database['public']['Enums']['audit_action'];
          actor_user_id?: string | null;
          created_at?: string;
          family_group_id?: string | null;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string;
          table_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      care_guides: {
        Row: {
          category: Database['public']['Enums']['care_guide_category'];
          content: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          family_group_id: string;
          id: string;
          source: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          category?: Database['public']['Enums']['care_guide_category'];
          content: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id: string;
          id?: string;
          source?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: Database['public']['Enums']['care_guide_category'];
          content?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id?: string;
          id?: string;
          source?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'care_guides_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_messages: {
        Row: {
          content: string;
          created_at: string;
          deleted_at: string | null;
          family_group_id: string;
          id: string;
          role: Database['public']['Enums']['chat_role'];
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          deleted_at?: string | null;
          family_group_id: string;
          id?: string;
          role: Database['public']['Enums']['chat_role'];
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          deleted_at?: string | null;
          family_group_id?: string;
          id?: string;
          role?: Database['public']['Enums']['chat_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      child_measurements: {
        Row: {
          child_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          head_circumference_cm: number | null;
          height_cm: number | null;
          id: string;
          measured_at: string;
          notes: string | null;
          updated_at: string;
          weight_grams: number | null;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          head_circumference_cm?: number | null;
          height_cm?: number | null;
          id?: string;
          measured_at: string;
          notes?: string | null;
          updated_at?: string;
          weight_grams?: number | null;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          head_circumference_cm?: number | null;
          height_cm?: number | null;
          id?: string;
          measured_at?: string;
          notes?: string | null;
          updated_at?: string;
          weight_grams?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'child_measurements_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      child_profiles: {
        Row: {
          avatar_path: string | null;
          birth_date: string | null;
          birth_height_cm: number | null;
          birth_place: string | null;
          birth_time: string | null;
          birth_weight_grams: number | null;
          blood_type: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          family_group_id: string;
          gestational_weeks_at_birth: number | null;
          health_insurance: string | null;
          id: string;
          is_preterm: boolean | null;
          last_feeding_reminder_at: string | null;
          last_predicted_diaper_reminder_at: string | null;
          last_predicted_feeding_reminder_at: string | null;
          name: string;
          notes: string | null;
          pediatrician_name: string | null;
          pediatrician_phone: string | null;
          sex: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          birth_date?: string | null;
          birth_height_cm?: number | null;
          birth_place?: string | null;
          birth_time?: string | null;
          birth_weight_grams?: number | null;
          blood_type?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id: string;
          gestational_weeks_at_birth?: number | null;
          health_insurance?: string | null;
          id?: string;
          is_preterm?: boolean | null;
          last_feeding_reminder_at?: string | null;
          last_predicted_diaper_reminder_at?: string | null;
          last_predicted_feeding_reminder_at?: string | null;
          name: string;
          notes?: string | null;
          pediatrician_name?: string | null;
          pediatrician_phone?: string | null;
          sex?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          birth_date?: string | null;
          birth_height_cm?: number | null;
          birth_place?: string | null;
          birth_time?: string | null;
          birth_weight_grams?: number | null;
          blood_type?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id?: string;
          gestational_weeks_at_birth?: number | null;
          health_insurance?: string | null;
          id?: string;
          is_preterm?: boolean | null;
          last_feeding_reminder_at?: string | null;
          last_predicted_diaper_reminder_at?: string | null;
          last_predicted_feeding_reminder_at?: string | null;
          name?: string;
          notes?: string | null;
          pediatrician_name?: string | null;
          pediatrician_phone?: string | null;
          sex?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'child_profiles_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      diaper_events: {
        Row: {
          child_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          notes: string | null;
          occurred_at: string;
          photo_analysis: Json | null;
          photo_path: string | null;
          type: Database['public']['Enums']['diaper_type'];
          updated_at: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          occurred_at: string;
          photo_analysis?: Json | null;
          photo_path?: string | null;
          type: Database['public']['Enums']['diaper_type'];
          updated_at?: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
          photo_analysis?: Json | null;
          photo_path?: string | null;
          type?: Database['public']['Enums']['diaper_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'diaper_events_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      event_comments: {
        Row: {
          content: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          family_group_id: string;
          id: string;
          target_id: string;
          target_type: Database['public']['Enums']['comment_target'];
          updated_at: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id: string;
          id?: string;
          target_id: string;
          target_type: Database['public']['Enums']['comment_target'];
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id?: string;
          id?: string;
          target_id?: string;
          target_type?: Database['public']['Enums']['comment_target'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_comments_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      family_groups: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      family_invitations: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          family_group_id: string;
          id: string;
          redeemed_at: string | null;
          redeemed_by: string | null;
          revoked_at: string | null;
          role: Database['public']['Enums']['family_role'];
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by: string;
          expires_at: string;
          family_group_id: string;
          id?: string;
          redeemed_at?: string | null;
          redeemed_by?: string | null;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['family_role'];
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          family_group_id?: string;
          id?: string;
          redeemed_at?: string | null;
          redeemed_by?: string | null;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['family_role'];
        };
        Relationships: [
          {
            foreignKeyName: 'family_invitations_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      family_memberships: {
        Row: {
          accepted_at: string;
          created_at: string;
          deleted_at: string | null;
          display_name: string | null;
          family_group_id: string;
          id: string;
          relationship: string | null;
          role: Database['public']['Enums']['family_role'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accepted_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          family_group_id: string;
          id?: string;
          relationship?: string | null;
          role?: Database['public']['Enums']['family_role'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accepted_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          family_group_id?: string;
          id?: string;
          relationship?: string | null;
          role?: Database['public']['Enums']['family_role'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'family_memberships_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      family_memories: {
        Row: {
          content: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          family_group_id: string;
          id: string;
          kind: string | null;
          private_to_user: string | null;
          updated_at: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id: string;
          id?: string;
          kind?: string | null;
          private_to_user?: string | null;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id?: string;
          id?: string;
          kind?: string | null;
          private_to_user?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'family_memories_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      feeding_events: {
        Row: {
          amount_ml: number | null;
          child_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          duration_minutes: number | null;
          foods: string[] | null;
          id: string;
          notes: string | null;
          occurred_at: string;
          reaction: Database['public']['Enums']['feeding_reaction'];
          side: Database['public']['Enums']['breast_side'] | null;
          type: Database['public']['Enums']['feeding_type'];
          updated_at: string;
        };
        Insert: {
          amount_ml?: number | null;
          child_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          duration_minutes?: number | null;
          foods?: string[] | null;
          id?: string;
          notes?: string | null;
          occurred_at: string;
          reaction?: Database['public']['Enums']['feeding_reaction'];
          side?: Database['public']['Enums']['breast_side'] | null;
          type: Database['public']['Enums']['feeding_type'];
          updated_at?: string;
        };
        Update: {
          amount_ml?: number | null;
          child_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          duration_minutes?: number | null;
          foods?: string[] | null;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
          reaction?: Database['public']['Enums']['feeding_reaction'];
          side?: Database['public']['Enums']['breast_side'] | null;
          type?: Database['public']['Enums']['feeding_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feeding_events_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          family_group_id: string;
          id: string;
          invited_by: string;
          role: Database['public']['Enums']['family_role'];
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          family_group_id: string;
          id?: string;
          invited_by: string;
          role: Database['public']['Enums']['family_role'];
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          family_group_id?: string;
          id?: string;
          invited_by?: string;
          role?: Database['public']['Enums']['family_role'];
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      lullabies: {
        Row: {
          audio_path: string | null;
          child_id: string;
          chorus: string;
          closing: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          family_group_id: string;
          generation_meta: Json;
          id: string;
          intro: string;
          mood: Database['public']['Enums']['lullaby_mood'];
          share_token: string | null;
          shared_at: string | null;
          title: string;
          updated_at: string;
          verses: Json;
        };
        Insert: {
          audio_path?: string | null;
          child_id: string;
          chorus?: string;
          closing?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id: string;
          generation_meta?: Json;
          id?: string;
          intro: string;
          mood: Database['public']['Enums']['lullaby_mood'];
          share_token?: string | null;
          shared_at?: string | null;
          title: string;
          updated_at?: string;
          verses: Json;
        };
        Update: {
          audio_path?: string | null;
          child_id?: string;
          chorus?: string;
          closing?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id?: string;
          generation_meta?: Json;
          id?: string;
          intro?: string;
          mood?: Database['public']['Enums']['lullaby_mood'];
          share_token?: string | null;
          shared_at?: string | null;
          title?: string;
          updated_at?: string;
          verses?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'lullabies_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lullabies_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      media_items: {
        Row: {
          album_id: string | null;
          caption: string | null;
          child_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          family_group_id: string | null;
          height: number | null;
          id: string;
          mime_type: string;
          note_id: string | null;
          size_bytes: number | null;
          storage_path: string;
          tags: string[];
          taken_at: string | null;
          updated_at: string;
          width: number | null;
        };
        Insert: {
          album_id?: string | null;
          caption?: string | null;
          child_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id?: string | null;
          height?: number | null;
          id?: string;
          mime_type: string;
          note_id?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          tags?: string[];
          taken_at?: string | null;
          updated_at?: string;
          width?: number | null;
        };
        Update: {
          album_id?: string | null;
          caption?: string | null;
          child_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id?: string | null;
          height?: number | null;
          id?: string;
          mime_type?: string;
          note_id?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          tags?: string[];
          taken_at?: string | null;
          updated_at?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'media_items_album_id_fkey';
            columns: ['album_id'];
            isOneToOne: false;
            referencedRelation: 'albums';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_items_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_items_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_items_note_id_fkey';
            columns: ['note_id'];
            isOneToOne: false;
            referencedRelation: 'notes';
            referencedColumns: ['id'];
          },
        ];
      };
      medical_milestones: {
        Row: {
          category: Database['public']['Enums']['milestone_category'];
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          due_at: string | null;
          family_group_id: string;
          id: string;
          last_reminded_at: string | null;
          notes: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          category?: Database['public']['Enums']['milestone_category'];
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          due_at?: string | null;
          family_group_id: string;
          id?: string;
          last_reminded_at?: string | null;
          notes?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: Database['public']['Enums']['milestone_category'];
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          due_at?: string | null;
          family_group_id?: string;
          id?: string;
          last_reminded_at?: string | null;
          notes?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'medical_milestones_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      medication_doses: {
        Row: {
          child_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          dose_amount: string | null;
          given_at: string;
          id: string;
          interval_hours: number | null;
          medication_name: string;
          next_dose_at: string | null;
          next_dose_notified_at: string | null;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          dose_amount?: string | null;
          given_at?: string;
          id?: string;
          interval_hours?: number | null;
          medication_name: string;
          next_dose_at?: string | null;
          next_dose_notified_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          dose_amount?: string | null;
          given_at?: string;
          id?: string;
          interval_hours?: number | null;
          medication_name?: string;
          next_dose_at?: string | null;
          next_dose_notified_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'medication_doses_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notes: {
        Row: {
          category: Database['public']['Enums']['note_category'];
          child_id: string;
          content: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          occurred_at: string;
          updated_at: string;
        };
        Insert: {
          category?: Database['public']['Enums']['note_category'];
          child_id: string;
          content: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          occurred_at?: string;
          updated_at?: string;
        };
        Update: {
          category?: Database['public']['Enums']['note_category'];
          child_id?: string;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          occurred_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notes_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_prefs: {
        Row: {
          created_at: string;
          prefs: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          prefs?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          prefs?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      pediatric_summaries: {
        Row: {
          child_id: string | null;
          created_at: string;
          created_by: string | null;
          days_back: number;
          deleted_at: string | null;
          family_group_id: string;
          generation_meta: Json;
          headline: string;
          id: string;
          metrics: Json;
          observations: Json;
          pending_milestones: Json;
          period_label: string;
          questions: Json;
        };
        Insert: {
          child_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          days_back: number;
          deleted_at?: string | null;
          family_group_id: string;
          generation_meta?: Json;
          headline: string;
          id?: string;
          metrics: Json;
          observations?: Json;
          pending_milestones?: Json;
          period_label: string;
          questions?: Json;
        };
        Update: {
          child_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          days_back?: number;
          deleted_at?: string | null;
          family_group_id?: string;
          generation_meta?: Json;
          headline?: string;
          id?: string;
          metrics?: Json;
          observations?: Json;
          pending_milestones?: Json;
          period_label?: string;
          questions?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'pediatric_summaries_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pediatric_summaries_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          created_at: string;
          endpoint: string;
          family_group_id: string;
          id: string;
          invalidated_at: string | null;
          keys: Json;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          endpoint: string;
          family_group_id: string;
          id?: string;
          invalidated_at?: string | null;
          keys: Json;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          endpoint?: string;
          family_group_id?: string;
          id?: string;
          invalidated_at?: string | null;
          keys?: Json;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      sleep_sessions: {
        Row: {
          child_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          ended_at: string | null;
          id: string;
          is_nap: boolean;
          notes: string | null;
          quality: Database['public']['Enums']['sleep_quality'];
          started_at: string;
          updated_at: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          ended_at?: string | null;
          id?: string;
          is_nap?: boolean;
          notes?: string | null;
          quality?: Database['public']['Enums']['sleep_quality'];
          started_at: string;
          updated_at?: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          ended_at?: string | null;
          id?: string;
          is_nap?: boolean;
          notes?: string | null;
          quality?: Database['public']['Enums']['sleep_quality'];
          started_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sleep_sessions_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      stories: {
        Row: {
          characters_used: Json;
          child_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          family_group_id: string;
          generation_meta: Json;
          id: string;
          input_meta: Json;
          moral_or_theme: string;
          share_token: string | null;
          shared_at: string | null;
          story: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          characters_used?: Json;
          child_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id: string;
          generation_meta?: Json;
          id?: string;
          input_meta?: Json;
          moral_or_theme: string;
          share_token?: string | null;
          shared_at?: string | null;
          story: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          characters_used?: Json;
          child_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          family_group_id?: string;
          generation_meta?: Json;
          id?: string;
          input_meta?: Json;
          moral_or_theme?: string;
          share_token?: string | null;
          shared_at?: string | null;
          story?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stories_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'child_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stories_family_group_id_fkey';
            columns: ['family_group_id'];
            isOneToOne: false;
            referencedRelation: 'family_groups';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      timeline_events: {
        Row: {
          child_id: string | null;
          created_at: string | null;
          created_by: string | null;
          event_type: string | null;
          id: string | null;
          occurred_at: string | null;
          payload: Json | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      child_chronological_age_days: {
        Args: { p_child_id: string };
        Returns: number;
      };
      child_corrected_age_days: {
        Args: { p_child_id: string };
        Returns: number;
      };
      child_family_group_id: { Args: { p_child_id: string }; Returns: string };
      get_timeline: {
        Args: {
          p_child_id: string;
          p_event_types?: string[];
          p_from?: string;
          p_limit?: number;
          p_offset?: number;
          p_to?: string;
        };
        Returns: {
          child_id: string;
          created_at: string;
          created_by: string;
          event_type: string;
          id: string;
          occurred_at: string;
          payload: Json;
        }[];
      };
      is_family_admin: { Args: { p_family_group_id: string }; Returns: boolean };
      is_family_caregiver_or_admin: {
        Args: { p_family_group_id: string };
        Returns: boolean;
      };
      is_family_member: {
        Args: { p_family_group_id: string };
        Returns: boolean;
      };
      user_family_group_ids: { Args: never; Returns: string[] };
    };
    Enums: {
      album_kind: 'manual' | 'monthly' | 'milestone';
      audit_action: 'insert' | 'update' | 'soft_delete' | 'restore' | 'hard_delete';
      breast_side: 'left' | 'right' | 'both';
      care_guide_category:
        | 'dormir'
        | 'higiene'
        | 'alimentacion'
        | 'control'
        | 'emergencia'
        | 'otros';
      chat_role: 'user' | 'assistant';
      comment_target: 'note' | 'feeding' | 'sleep' | 'diaper' | 'milestone' | 'media';
      diaper_type: 'wet' | 'dirty' | 'both' | 'dry';
      family_role: 'admin' | 'caregiver' | 'family' | 'viewer';
      feeding_reaction: 'none' | 'mild' | 'strong';
      feeding_type: 'breastfeeding' | 'bottle' | 'solid';
      lullaby_mood: 'dulce' | 'jugueton' | 'calmo' | 'valiente';
      milestone_category: 'control_pediatrico' | 'pesquisa' | 'estudio' | 'vacuna' | 'otro';
      note_category: 'memory' | 'observation' | 'milestone' | 'other';
      sleep_quality: 'good' | 'regular' | 'bad' | 'unknown';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      album_kind: ['manual', 'monthly', 'milestone'],
      audit_action: ['insert', 'update', 'soft_delete', 'restore', 'hard_delete'],
      breast_side: ['left', 'right', 'both'],
      care_guide_category: ['dormir', 'higiene', 'alimentacion', 'control', 'emergencia', 'otros'],
      chat_role: ['user', 'assistant'],
      comment_target: ['note', 'feeding', 'sleep', 'diaper', 'milestone', 'media'],
      diaper_type: ['wet', 'dirty', 'both', 'dry'],
      family_role: ['admin', 'caregiver', 'family', 'viewer'],
      feeding_reaction: ['none', 'mild', 'strong'],
      feeding_type: ['breastfeeding', 'bottle', 'solid'],
      lullaby_mood: ['dulce', 'jugueton', 'calmo', 'valiente'],
      milestone_category: ['control_pediatrico', 'pesquisa', 'estudio', 'vacuna', 'otro'],
      note_category: ['memory', 'observation', 'milestone', 'other'],
      sleep_quality: ['good', 'regular', 'bad', 'unknown'],
    },
  },
} as const;
