ALTER TABLE connector_devices ADD COLUMN last_state TEXT NOT NULL DEFAULT 'PAIRED'
  CHECK (last_state IN ('PAIRED','SYNCED','MCP_OFFLINE','MCP_ERROR','PAUSED'));
ALTER TABLE connector_devices ADD COLUMN last_status_at INTEGER;

CREATE TABLE connector_status_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES connector_devices(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('PAIRED','SYNCED','MCP_OFFLINE','MCP_ERROR','PAUSED')),
  recorded_at INTEGER NOT NULL
);
CREATE INDEX connector_status_events_device_idx ON connector_status_events(device_id, recorded_at DESC);
CREATE TRIGGER connector_status_events_prune AFTER INSERT ON connector_status_events
BEGIN
  DELETE FROM connector_status_events
  WHERE device_id=NEW.device_id AND id NOT IN (
    SELECT id FROM connector_status_events WHERE device_id=NEW.device_id ORDER BY id DESC LIMIT 100
  );
END;
