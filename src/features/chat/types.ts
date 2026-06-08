export type ChatConversationType = "general" | "direct";

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  reply_to_id: string | null;
  is_pinned: boolean;
  is_deleted: boolean;
  deleted_by: string | null;
  edited_at: string | null;
  created_at: string;
}

export interface ChatAttachmentRow {
  id: string;
  message_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  duration_ms: number | null;
  created_at: string;
}

export interface ChatMessage extends ChatMessageRow {
  attachments: ChatAttachmentRow[];
  read_by?: string[];
}

export interface TeamMemberLite {
  user_id: string;
  display_name: string;
  role_title: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export interface ChatConversationSummary {
  id: string;
  type: ChatConversationType;
  other_user?: TeamMemberLite | null;
  last_message?: ChatMessageRow | null;
  unread_count: number;
  updated_at: string;
}
