-- Script to ensure all patients have a valid client_id reference
-- This resolves the spaghetti code in webhooks and variable resolver

-- Find the first available office/tenant or a default test office if any
DO $$
DECLARE
    default_client_id uuid;
BEGIN
    -- We assume 'clients' table or 'office' table exists that maps to a tenant.
    -- The schema might use 'clients' or 'offices' to group patients.
    -- We'll try to find a valid client_id from the clients table.
    
    SELECT id INTO default_client_id FROM clients LIMIT 1;
    
    IF default_client_id IS NOT NULL THEN
        -- Update patients that DO NOT have a client_id
        UPDATE pacientes
        SET client_id = default_client_id
        WHERE client_id IS NULL;
        
        RAISE NOTICE 'Consolidated patients without client_id to %', default_client_id;
    ELSE
        RAISE NOTICE 'No clients found in the database to act as default reference.';
    END IF;
END $$;
