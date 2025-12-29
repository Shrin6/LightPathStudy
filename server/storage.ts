import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users, collections, uploadedFiles, documentChunks, flashcards, studySessions,
  contentReports, learningEvents, feedback,
  type User, type InsertUser,
  type Collection, type InsertCollection,
  type UploadedFile, type InsertUploadedFile,
  type DocumentChunk, type InsertDocumentChunk,
  type Flashcard, type InsertFlashcard,
  type StudySession, type InsertStudySession,
  type ContentReport, type InsertContentReport,
  type LearningEvent, type InsertLearningEvent,
  type Feedback, type InsertFeedback,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  
  getCollections(userId: number): Promise<Collection[]>;
  getCollection(id: string): Promise<Collection | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  deleteCollection(id: string, userId: number): Promise<boolean>;
  
  getUploadedFiles(collectionId: string): Promise<UploadedFile[]>;
  getUploadedFile(id: string): Promise<UploadedFile | undefined>;
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
  updateUploadedFile(id: string, updates: Partial<InsertUploadedFile>): Promise<UploadedFile | undefined>;
  deleteUploadedFile(id: string, userId: number): Promise<boolean>;
  
  getDocumentChunks(collectionId: string): Promise<DocumentChunk[]>;
  createDocumentChunks(chunks: InsertDocumentChunk[]): Promise<DocumentChunk[]>;
  deleteDocumentChunksByFile(fileId: string): Promise<boolean>;
  
  getFlashcards(collectionId: string): Promise<Flashcard[]>;
  createFlashcard(flashcard: InsertFlashcard): Promise<Flashcard>;
  deleteFlashcard(id: string, userId: number): Promise<boolean>;
  
  getStudySession(id: string): Promise<StudySession | undefined>;
  getStudySessions(userId: number): Promise<StudySession[]>;
  createStudySession(session: InsertStudySession): Promise<StudySession>;
  updateStudySession(id: string, updates: Partial<InsertStudySession>): Promise<StudySession | undefined>;
  
  createContentReport(report: InsertContentReport): Promise<ContentReport>;
  createLearningEvent(event: InsertLearningEvent): Promise<LearningEvent>;
  createFeedback(fb: InsertFeedback): Promise<Feedback>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return updated;
  }

  async getCollections(userId: number): Promise<Collection[]> {
    return db.select().from(collections).where(eq(collections.userId, userId)).orderBy(desc(collections.createdAt));
  }

  async getCollection(id: string): Promise<Collection | undefined> {
    const [collection] = await db.select().from(collections).where(eq(collections.id, id));
    return collection;
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    const [newCollection] = await db.insert(collections).values(collection).returning();
    return newCollection;
  }

  async deleteCollection(id: string, userId: number): Promise<boolean> {
    const result = await db.delete(collections).where(and(eq(collections.id, id), eq(collections.userId, userId)));
    return true;
  }

  async getUploadedFiles(collectionId: string): Promise<UploadedFile[]> {
    return db.select().from(uploadedFiles).where(eq(uploadedFiles.collectionId, collectionId));
  }

  async getUploadedFile(id: string): Promise<UploadedFile | undefined> {
    const [file] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id));
    return file;
  }

  async createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile> {
    const [newFile] = await db.insert(uploadedFiles).values(file).returning();
    return newFile;
  }

  async updateUploadedFile(id: string, updates: Partial<InsertUploadedFile>): Promise<UploadedFile | undefined> {
    const [updated] = await db.update(uploadedFiles).set(updates).where(eq(uploadedFiles.id, id)).returning();
    return updated;
  }

  async deleteUploadedFile(id: string, userId: number): Promise<boolean> {
    await db.delete(uploadedFiles).where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.userId, userId)));
    return true;
  }

  async getDocumentChunks(collectionId: string): Promise<DocumentChunk[]> {
    return db.select().from(documentChunks).where(eq(documentChunks.collectionId, collectionId));
  }

  async createDocumentChunks(chunks: InsertDocumentChunk[]): Promise<DocumentChunk[]> {
    if (chunks.length === 0) return [];
    return db.insert(documentChunks).values(chunks).returning();
  }

  async deleteDocumentChunksByFile(fileId: string): Promise<boolean> {
    await db.delete(documentChunks).where(eq(documentChunks.fileId, fileId));
    return true;
  }

  async getFlashcards(collectionId: string): Promise<Flashcard[]> {
    return db.select().from(flashcards).where(eq(flashcards.collectionId, collectionId));
  }

  async createFlashcard(flashcard: InsertFlashcard): Promise<Flashcard> {
    const [newFlashcard] = await db.insert(flashcards).values(flashcard).returning();
    return newFlashcard;
  }

  async deleteFlashcard(id: string, userId: number): Promise<boolean> {
    await db.delete(flashcards).where(and(eq(flashcards.id, id), eq(flashcards.userId, userId)));
    return true;
  }

  async getStudySession(id: string): Promise<StudySession | undefined> {
    const [session] = await db.select().from(studySessions).where(eq(studySessions.id, id));
    return session;
  }

  async getStudySessions(userId: number): Promise<StudySession[]> {
    return db.select().from(studySessions).where(eq(studySessions.userId, userId)).orderBy(desc(studySessions.createdAt));
  }

  async createStudySession(session: InsertStudySession): Promise<StudySession> {
    const [newSession] = await db.insert(studySessions).values(session).returning();
    return newSession;
  }

  async updateStudySession(id: string, updates: Partial<InsertStudySession>): Promise<StudySession | undefined> {
    const [updated] = await db.update(studySessions).set({ ...updates, updatedAt: new Date() }).where(eq(studySessions.id, id)).returning();
    return updated;
  }

  async createContentReport(report: InsertContentReport): Promise<ContentReport> {
    const [newReport] = await db.insert(contentReports).values(report).returning();
    return newReport;
  }

  async createLearningEvent(event: InsertLearningEvent): Promise<LearningEvent> {
    const [newEvent] = await db.insert(learningEvents).values(event).returning();
    return newEvent;
  }

  async createFeedback(fb: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db.insert(feedback).values(fb).returning();
    return newFeedback;
  }
}

export const storage = new DatabaseStorage();
