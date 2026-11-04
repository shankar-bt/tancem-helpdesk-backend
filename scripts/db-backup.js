/**
 * TANCEM Helpdesk - Automated Database Backup Script
 * 
 * Features:
 * - Reads database credentials securely from backend/.env (DATABASE_URL)
 * - Auto-detects pg_dump in system PATH or PostgreSQL installation directory
 * - Generates clean, timestamped, self-contained SQL dumps in backups/
 * - Automatic retention: purges backup files older than 14 days to preserve disk space
 * - Safe & 100% read-only: does not modify or lock active database tables
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Load environment variables
const backendDir = path.resolve(__dirname, '..');
const envPath = path.join(backendDir, '.env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[ERROR] DATABASE_URL not found in .env file');
  process.exit(1);
}

// 2. Parse DATABASE_URL
// Format: postgresql://user:password@host:port/database
function parseDatabaseUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return {
      user: decodeURIComponent(parsed.username || 'postgres'),
      password: decodeURIComponent(parsed.password || ''),
      host: parsed.hostname || 'localhost',
      port: parsed.port || '5432',
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'tancem_helpdesk',
    };
  } catch (err) {
    console.error('[ERROR] Failed to parse DATABASE_URL:', err.message);
    process.exit(1);
  }
}

const dbConfig = parseDatabaseUrl(databaseUrl);

// 3. Locate pg_dump binary
function findPgDump() {
  if (process.env.PG_DUMP_PATH && fs.existsSync(process.env.PG_DUMP_PATH)) {
    return process.env.PG_DUMP_PATH;
  }

  try {
    execSync('pg_dump --version', { stdio: 'ignore' });
    return 'pg_dump';
  } catch {
    // Search common Windows PostgreSQL installations
    const basePaths = [
      'C:/Program Files/PostgreSQL',
      'C:/Program Files (x86)/PostgreSQL',
    ];
    for (const basePath of basePaths) {
      if (fs.existsSync(basePath)) {
        const dirs = fs.readdirSync(basePath).sort().reverse();
        for (const ver of dirs) {
          const candidate = path.join(basePath, ver, 'bin', 'pg_dump.exe');
          if (fs.existsSync(candidate)) {
            return candidate;
          }
        }
      }
    }
  }

  console.error('[ERROR] pg_dump executable could not be found.');
  console.error('Please install PostgreSQL or set PG_DUMP_PATH in .env');
  process.exit(1);
}

const pgDumpBin = findPgDump();

// 4. Ensure backups directory exists
const backupsDir = path.join(backendDir, 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// 5. Generate timestamped filename
const now = new Date();
const dateStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
const backupFileName = `tancem_helpdesk_${dateStr}.sql`;
const backupFilePath = path.join(backupsDir, backupFileName);

console.log('====================================================');
console.log('  TANCEM HELPDESK - DATABASE BACKUP (pg_dump)');
console.log('====================================================');
console.log(`Database : ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
console.log(`User     : ${dbConfig.user}`);
console.log(`Target   : ${backupFilePath}`);
console.log(`Tool     : ${pgDumpBin}`);
console.log('----------------------------------------------------');

// 6. Execute pg_dump
// Options:
// --clean --if-exists: outputs DROP TABLE IF EXISTS before CREATE, making restoration clean
// --no-owner --no-acl: ensures backup is portable across any postgres user / permissions
const dumpArgs = [
  `-h "${dbConfig.host}"`,
  `-p ${dbConfig.port}`,
  `-U "${dbConfig.user}"`,
  `--clean`,
  `--if-exists`,
  `--no-owner`,
  `--no-acl`,
  `-d "${dbConfig.database}"`,
  `-f "${backupFilePath}"`,
].join(' ');

const cmd = `"${pgDumpBin}" ${dumpArgs}`;

try {
  const startTime = Date.now();
  execSync(cmd, {
    env: {
      ...process.env,
      PGPASSWORD: dbConfig.password,
    },
    stdio: 'inherit',
  });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  const stats = fs.statSync(backupFilePath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  const sizeKb = (stats.size / 1024).toFixed(1);
  const displaySize = stats.size >= 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

  console.log(`[SUCCESS] Backup created successfully in ${duration}s!`);
  console.log(`  File : ${backupFileName}`);
  console.log(`  Size : ${displaySize}`);

  // 7. Housekeeping / Auto-Retention: Purge files older than 14 days
  const RETENTION_DAYS = 14;
  const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(backupsDir);

  let purgedCount = 0;
  let remainingCount = 0;

  files.forEach((file) => {
    if (file.endsWith('.sql') || file.endsWith('.dump')) {
      const filePath = path.join(backupsDir, file);
      const fileStat = fs.statSync(filePath);
      if (fileStat.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        purgedCount++;
        console.log(`  [AUTO-PURGE] Deleted old backup (>14 days): ${file}`);
      } else {
        remainingCount++;
      }
    }
  });

  console.log('----------------------------------------------------');
  console.log(`Retention Policy : ${RETENTION_DAYS} days maximum retention`);
  console.log(`Active Backups   : ${remainingCount} files safely retained on disk`);
  if (purgedCount > 0) {
    console.log(`Purged Backups   : ${purgedCount} old files removed to save disk space`);
  }
  console.log('====================================================\n');
} catch (err) {
  console.error('\n[ERROR] Database backup failed:');
  console.error(err.message);
  process.exit(1);
}
