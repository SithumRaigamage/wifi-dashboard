-- Bootstrap for the WiFi Dashboard MySQL store.
-- Run once as a privileged user:   mysql -u root -p < server/sql/init.sql
-- Then set DB_PASSWORD in server/.env to match the password below.
--
-- The application creates its own tables on startup (CREATE TABLE IF NOT EXISTS),
-- so this script only provisions the database and a least-privilege app user.

CREATE DATABASE IF NOT EXISTS wifi_dashboard
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Change this password, and mirror it in server/.env (DB_PASSWORD).
CREATE USER IF NOT EXISTS 'wifi'@'localhost' IDENTIFIED BY 'change-me';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER
  ON wifi_dashboard.* TO 'wifi'@'localhost';

FLUSH PRIVILEGES;
