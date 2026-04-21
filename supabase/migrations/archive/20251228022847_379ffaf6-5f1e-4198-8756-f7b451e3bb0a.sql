-- Adicionar novos valores ao enum client_file_kind para documentos do kit
ALTER TYPE public.client_file_kind ADD VALUE IF NOT EXISTS 'KIT_PROCURACAO';
ALTER TYPE public.client_file_kind ADD VALUE IF NOT EXISTS 'KIT_DECLARACAO';
ALTER TYPE public.client_file_kind ADD VALUE IF NOT EXISTS 'KIT_CONTRATO';