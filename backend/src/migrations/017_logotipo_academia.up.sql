BEGIN;
CREATE TABLE academia_logotipos (
  academia_id integer PRIMARY KEY REFERENCES academias(id) ON DELETE CASCADE,
  mime text NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp')),
  conteudo bytea NOT NULL CHECK (octet_length(conteudo) BETWEEN 12 AND 131072)
);
COMMIT;
