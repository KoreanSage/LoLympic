export interface ConversationListItem {
  id: string;
  updatedAt: string;
  otherUser: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  lastMessage: {
    body: string;
    createdAt: string;
    senderId: string;
  } | null;
  unreadCount: number;
}

export interface MessageData {
  id: string;
  body: string;
  imageUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  createdAt: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}
