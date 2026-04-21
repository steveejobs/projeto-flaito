-- Fix hard delete of documents: document versioning trigger inserts on DELETE and violates FK
-- Remove DELETE from documents->document_versions versioning trigger

BEGIN;

DROP TRIGGER IF EXISTS trg_documents_versions ON public.documents;

CREATE TRIGGER trg_documents_versions
AFTER INSERT OR UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.trg_document_versions();

COMMIT;