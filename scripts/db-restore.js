/**
 * TANCEM Helpdesk - Database Restore Script
 * 
 * Safely restores the PostgreSQL database from a chosen .sql backup file.
 * Defaults to the most recent backup in backups/ if no file is provided.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function findPsql() {
  if (process.env.PSQL_PATH && fs.existsSync(process.env.PSQL_PATH)) {
    return process.env.PSQL_PATH;
  }

  try {
    execSync('psql --version', { stdio: 'ignore' });
    return 'psql';
  } catch {
    const basePaths = [
      'C:/Program Files/PostgreSQL',
      'C:/Program Files (x86)/PostgreSQL',
    ];
    for (const basePath of basePaths) {
      if (fs.existsSync(basePath)) {
        const dirs = fs.readdirSync(basePath).sort().reverse();
        for (const ver of dirs) {
          const candidate = path.join(basePath, ver, 'bin', 'psql.exe');
          if (fs.existsSync(candidate)) {
            return candidate;
          }
        }
      }
    }
  }

  console.error('[ERROR] psql executable could not be found.');
  process.exit(1);
}

const psqlBin = findPsql();
const backupsDir = path.join(backendDir, 'backups');

// Check target backup file
let targetFile = process.argv[2];
if (!targetFile) {
  if (!fs.existsSync(backupsDir)) {
    console.error('[ERROR] No backups directory found at ' + backupsDir);
    process.exit(1);
  }
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('[ERROR] No .sql backup files found in ' + backupsDir);
    process.exit(1);
  }
  targetFile = path.join(backupsDir, files[0]);
  console.log('[INFO] No specific file specified. Defaulting to most recent backup:');
} else if (!path.isAbsolute(targetFile)) {
  targetFile = path.resolve(process.cwd(), targetFile);
}

if (!fs.existsSync(targetFile)) {
  console.error('[ERROR] Target backup file not found: ' + targetFile);
  process.exit(1);
}

console.log('====================================================');
console.log('  TANCEM HELPDESK - DATABASE RESTORE (psql)');
console.log('====================================================');
console.log(`Database : ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
console.log(`User     : ${dbConfig.user}`);
console.log(`Source   : ${targetFile}`);
console.log('----------------------------------------------------');

const restoreArgs = [
  `-h "${dbConfig.host}"`,
  `-p ${dbConfig.port}`,
  `-U "${dbConfig.user}"`,
  `-d "${dbConfig.database}"`,
  `-f "${targetFile}"`,
].join(' ');

const cmd = `"${psqlBin}" ${restoreArgs}`;

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
  console.log(`\n[SUCCESS] Database restored successfully in ${duration}s!`);
  console.log('====================================================\n');
} catch (err) {
  console.error('\n[ERROR] Database restore failed:');
  console.error(err.message);
  process.exit(1);
}
