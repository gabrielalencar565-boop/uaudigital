// Tracks which conversation is currently visible in the chat panel,
// so the global notifier can suppress sound/toast for the active chat.
let activeConversationId: string | null = null;
let panelOpen = false;

export function setActiveConversation(id: string | null) {
  activeConversationId = id;
}
export function getActiveConversation() {
  return activeConversationId;
}
export function setChatPanelOpen(open: boolean) {
  panelOpen = open;
}
export function isChatPanelOpen() {
  return panelOpen;
}
