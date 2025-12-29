export interface User {
  id: number;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface Collection {
  id: string;
  userId: number;
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
  uploaded_files?: UploadedFile[];
}

export interface UploadedFile {
  id: string;
  collectionId: string;
  userId: number;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  parsedContent: string | null;
  processing: boolean | null;
  createdAt: string | null;
}

export interface Flashcard {
  id: string;
  collectionId: string;
  userId: number;
  front: string;
  back: string;
  createdAt: string | null;
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }
  
  return response.json();
}

export const api = {
  getUser: () => apiRequest<{ user: User | null }>("/api/user"),
  
  login: (email: string, password: string) => 
    apiRequest<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
    
  register: (email: string, password: string) =>
    apiRequest<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
    
  logout: () => apiRequest<{ success: boolean }>("/api/auth/logout", { method: "POST" }),
  
  getCollections: () => apiRequest<{ collections: Collection[] }>("/api/collections"),
  
  createCollection: (name: string) =>
    apiRequest<{ collection: Collection }>("/api/collections", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
    
  deleteCollection: (id: string) =>
    apiRequest<{ success: boolean }>(`/api/collections/${id}`, { method: "DELETE" }),
    
  getFiles: (collectionId: string) =>
    apiRequest<{ files: UploadedFile[] }>(`/api/collections/${collectionId}/files`),
    
  uploadFile: async (collectionId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetch(`/api/collections/${collectionId}/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || "Upload failed");
    }
    
    return response.json() as Promise<{ file: UploadedFile }>;
  },
  
  deleteFile: (id: string) =>
    apiRequest<{ success: boolean }>(`/api/files/${id}`, { method: "DELETE" }),
    
  getFlashcards: (collectionId: string) =>
    apiRequest<{ flashcards: Flashcard[] }>(`/api/collections/${collectionId}/flashcards`),
    
  createFlashcard: (collectionId: string, front: string, back: string) =>
    apiRequest<{ flashcard: Flashcard }>("/api/flashcards", {
      method: "POST",
      body: JSON.stringify({ collectionId, front, back }),
    }),
    
  deleteFlashcard: (id: string) =>
    apiRequest<{ success: boolean }>(`/api/flashcards/${id}`, { method: "DELETE" }),
    
  getChunks: (collectionId: string) =>
    apiRequest<{ chunks: any[] }>(`/api/collections/${collectionId}/chunks`),
    
  chat: (messages: any[], mode: string, collectionId: string) =>
    apiRequest<{ content: string }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages, mode, collectionId }),
    }),
    
  submitFeedback: (subject: string, message: string) =>
    apiRequest<{ feedback: any }>("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ subject, message }),
    }),
    
  logLearningEvent: (event: any) =>
    apiRequest<{ event: any }>("/api/learning-events", {
      method: "POST",
      body: JSON.stringify(event),
    }),
    
  reportContent: (report: any) =>
    apiRequest<{ report: any }>("/api/content-reports", {
      method: "POST",
      body: JSON.stringify(report),
    }),
};
