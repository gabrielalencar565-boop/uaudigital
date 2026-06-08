import { supabase } from "@/integrations/supabase/client";

export async function sendChatMessage(opts: {
  conversationId: string;
  senderId: string;
  content: string;
  replyToId?: string | null;
  mentions?: string[];
  files?: File[];
}) {
  const { conversationId, senderId, content, replyToId, mentions, files } = opts;
  const { data: msg, error } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content || null,
      reply_to_id: replyToId ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  if (mentions && mentions.length > 0) {
    const rows = mentions.map((uid) => ({ message_id: msg.id, user_id: uid }));
    await supabase.from("chat_mentions").insert(rows).then(() => {}, () => {});
  }

  if (files && files.length > 0) {
    for (const file of files) {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${senderId}/${msg.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) continue;
      await supabase.from("chat_message_attachments").insert({
        message_id: msg.id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      }).then(() => {}, () => {});
    }
  }
  return msg;
}

export async function getSignedAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function markConversationRead(conversationId: string) {
  await supabase.rpc("chat_mark_read", { _conv: conversationId }).then(() => {}, () => {});
}

export async function deleteChatMessage(messageId: string) {
  return supabase
    .from("chat_messages")
    .update({ is_deleted: true, content: null })
    .eq("id", messageId);
}

export async function togglePin(messageId: string, pinned: boolean) {
  return supabase.from("chat_messages").update({ is_pinned: pinned }).eq("id", messageId);
}

export async function getOrCreateDirect(otherUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("chat_get_or_create_direct", { _other_user: otherUserId });
  if (error) return null;
  return data as string;
}
