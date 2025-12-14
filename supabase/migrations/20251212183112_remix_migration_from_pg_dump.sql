CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: match_document_chunks(text, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_document_chunks(query_embedding text, match_collection_id uuid, match_count integer DEFAULT 10) RETURNS TABLE(id uuid, file_id uuid, chunk_text text, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.file_id,
    dc.chunk_text,
    1 - (dc.embedding <=> query_embedding::vector) AS similarity
  FROM document_chunks dc
  WHERE dc.collection_id = match_collection_id
  ORDER BY dc.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: document_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    user_id uuid NOT NULL,
    chunk_text text NOT NULL,
    embedding public.vector(768),
    metadata jsonb DEFAULT '{}'::jsonb,
    chunk_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: flashcards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flashcards (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    collection_id uuid NOT NULL,
    user_id uuid NOT NULL,
    front text NOT NULL,
    back text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: study_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    collection_id uuid,
    mode text NOT NULL,
    conversation_history jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: uploaded_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uploaded_files (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    collection_id uuid NOT NULL,
    user_id uuid NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_type text NOT NULL,
    file_size bigint NOT NULL,
    parsed_content text,
    created_at timestamp with time zone DEFAULT now(),
    processing boolean DEFAULT false
);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: document_chunks document_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_pkey PRIMARY KEY (id);


--
-- Name: flashcards flashcards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcards
    ADD CONSTRAINT flashcards_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: study_sessions study_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_sessions
    ADD CONSTRAINT study_sessions_pkey PRIMARY KEY (id);


--
-- Name: uploaded_files uploaded_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_pkey PRIMARY KEY (id);


--
-- Name: document_chunks_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_chunks_embedding_idx ON public.document_chunks USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: collections update_collections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: study_sessions update_study_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_study_sessions_updated_at BEFORE UPDATE ON public.study_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: document_chunks document_chunks_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: document_chunks document_chunks_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.uploaded_files(id) ON DELETE CASCADE;


--
-- Name: flashcards flashcards_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcards
    ADD CONSTRAINT flashcards_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: study_sessions study_sessions_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_sessions
    ADD CONSTRAINT study_sessions_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE SET NULL;


--
-- Name: uploaded_files uploaded_files_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: profiles Profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);


--
-- Name: collections Users can create their own collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own collections" ON public.collections FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: flashcards Users can create their own flashcards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own flashcards" ON public.flashcards FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: study_sessions Users can create their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own sessions" ON public.study_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: document_chunks Users can delete their own chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own chunks" ON public.document_chunks FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: collections Users can delete their own collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own collections" ON public.collections FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: uploaded_files Users can delete their own files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own files" ON public.uploaded_files FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: flashcards Users can delete their own flashcards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own flashcards" ON public.flashcards FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: study_sessions Users can delete their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own sessions" ON public.study_sessions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: document_chunks Users can insert their own chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own chunks" ON public.document_chunks FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: collections Users can update their own collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own collections" ON public.collections FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: uploaded_files Users can update their own files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own files" ON public.uploaded_files FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: flashcards Users can update their own flashcards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own flashcards" ON public.flashcards FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: study_sessions Users can update their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own sessions" ON public.study_sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: uploaded_files Users can upload their own files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can upload their own files" ON public.uploaded_files FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: document_chunks Users can view their own chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own chunks" ON public.document_chunks FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: collections Users can view their own collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own collections" ON public.collections FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: uploaded_files Users can view their own files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own files" ON public.uploaded_files FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: flashcards Users can view their own flashcards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own flashcards" ON public.flashcards FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: study_sessions Users can view their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own sessions" ON public.study_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

--
-- Name: document_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: flashcards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: study_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: uploaded_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


