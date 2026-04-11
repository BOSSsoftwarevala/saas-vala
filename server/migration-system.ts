import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { UltraLogger } from './logger';
import { UltraDatabase } from './database';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Migration {
  id: string;
  name: string;
  version: string;
  description: string;
  up: string; // SQL to run for migration
  down: string; // SQL to rollback migration
  checksum: string;
  createdAt: Date;
  appliedAt?: Date;
  rollbackAt?: Date;
}

export interface MigrationResult {
  success: boolean;
  migration: Migration;
  error?: string;
  duration: number;
}

export interface MigrationStatus {
  currentVersion: string;
  pendingMigrations: Migration[];
  appliedMigrations: Migration[];
  lastMigration?: Migration;
  needsMigration: boolean;
}

export class UltraMigrationSystem extends EventEmitter {
  private static instance: UltraMigrationSystem;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private migrationsPath: string;
  private migrations: Map<string, Migration> = new Map();

  static getInstance(): UltraMigrationSystem {
    if (!UltraMigrationSystem.instance) {
      UltraMigrationSystem.instance = new UltraMigrationSystem();
    }
    return UltraMigrationSystem.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.migrationsPath = process.env.MIGRATIONS_PATH || path.join(process.cwd(), 'migrations');
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure migrations directory exists
      if (!fs.existsSync(this.migrationsPath)) {
        fs.mkdirSync(this.migrationsPath, { recursive: true });
      }

      // Initialize migrations table
      await this.initializeMigrationsTable();

      // Load migrations
      await this.loadMigrations();

      this.logger.info('migration-system', 'Migration system initialized', {
        migrationsPath: this.migrationsPath,
        loadedMigrations: this.migrations.size
      });

    } catch (error) {
      this.logger.error('migration-system', 'Failed to initialize migration system', error as Error);
      throw error;
    }
  }

  private async initializeMigrationsTable(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        version VARCHAR(50) NOT NULL,
        description TEXT,
        checksum VARCHAR(64) NOT NULL,
        created_at TIMESTAMP NOT NULL,
        applied_at TIMESTAMP,
        rollback_at TIMESTAMP
      )
    `);

    await this.database.query('CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at)');
  }

  private async loadMigrations(): Promise<void> {
    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure order

    for (const file of files) {
      try {
        const migration = await this.parseMigrationFile(file);
        this.migrations.set(migration.id, migration);
      } catch (error) {
        this.logger.error('migration-system', `Failed to parse migration file: ${file}`, error as Error);
      }
    }

    this.logger.info('migration-system', `Loaded ${this.migrations.size} migrations`);
  }

  private async parseMigrationFile(filename: string): Promise<Migration> {
    const filePath = path.join(this.migrationsPath, filename);
    const content = fs.readFileSync(filePath, 'utf8');

    // Parse migration header
    const headerMatch = content.match(/--\s*Migration:\s*(.+?)\s*--\s*Version:\s*(.+?)\s*--\s*Description:\s*(.+?)\s*--\s*Created:\s*(.+?)\s*\n/);
    
    if (!headerMatch) {
      throw new Error(`Invalid migration format in ${filename}`);
    }

    const [, name, version, description, createdAt] = headerMatch;
    const id = filename.replace('.sql', '');

    // Split up and down migrations
    const parts = content.split('-- DOWN');
    if (parts.length !== 2) {
      throw new Error(`Migration must contain UP and DOWN sections: ${filename}`);
    }

    const up = parts[0].replace(/--\s*UP\s*/, '').trim();
    const down = parts[1].trim();

    // Calculate checksum
    const checksum = require('crypto').createHash('sha256').update(content).digest('hex');

    return {
      id,
      name: name.trim(),
      version: version.trim(),
      description: description.trim(),
      up,
      down,
      checksum,
      createdAt: new Date(createdAt.trim())
    };
  }

  async getStatus(): Promise<MigrationStatus> {
    try {
      // Get applied migrations from database
      const rows = await this.database.query(`
        SELECT * FROM schema_migrations 
        ORDER BY version ASC
      `);

      const appliedMigrations: Migration[] = [];
      for (const row of rows) {
        const migration = this.migrations.get(row.id);
        if (migration) {
          appliedMigrations.push({
            ...migration,
            appliedAt: row.applied_at,
            rollbackAt: row.rollback_at
          });
        }
      }

      // Get pending migrations
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));
      const pendingMigrations = Array.from(this.migrations.values())
        .filter(m => !appliedVersions.has(m.version))
        .sort((a, b) => a.version.localeCompare(b.version));

      const lastMigration = appliedMigrations[appliedMigrations.length - 1];
      const currentVersion = lastMigration?.version || '0.0.0';

      return {
        currentVersion,
        pendingMigrations,
        appliedMigrations,
        lastMigration,
        needsMigration: pendingMigrations.length > 0
      };

    } catch (error) {
      this.logger.error('migration-system', 'Failed to get migration status', error as Error);
      throw error;
    }
  }

  async migrate(targetVersion?: string): Promise<MigrationResult[]> {
    const status = await this.getStatus();
    const results: MigrationResult[] = [];

    try {
      let migrationsToRun = status.pendingMigrations;

      if (targetVersion) {
        migrationsToRun = migrationsToRun.filter(m => 
          m.version <= targetVersion
        );
      }

      if (migrationsToRun.length === 0) {
        this.logger.info('migration-system', 'No migrations to run');
        return results;
      }

      this.logger.info('migration-system', `Starting migration of ${migrationsToRun.length} migrations`);

      for (const migration of migrationsToRun) {
        const result = await this.applyMigration(migration);
        results.push(result);

        if (!result.success) {
          this.logger.error('migration-system', `Migration failed: ${migration.id}`, { error: result.error });
          break;
        }
      }

      const successCount = results.filter(r => r.success).length;
      this.logger.info('migration-system', `Migration completed: ${successCount}/${results.length} successful`);

      this.emit('migrationCompleted', { results, successCount: successCount === results.length });

      return results;

    } catch (error) {
      this.logger.error('migration-system', 'Migration failed', error as Error);
      this.emit('migrationFailed', { error, results });
      throw error;
    }
  }

  private async applyMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      // Verify checksum
      const existing = await this.database.query(
        'SELECT checksum FROM schema_migrations WHERE id = $1',
        [migration.id]
      );

      if (existing.length > 0 && existing[0].checksum !== migration.checksum) {
        throw new Error(`Migration checksum mismatch: ${migration.id}`);
      }

      // Start transaction
      await this.database.query('BEGIN');

      try {
        // Apply migration
        await this.database.query(migration.up);

        // Record migration
        await this.database.query(`
          INSERT INTO schema_migrations (id, name, version, description, checksum, created_at, applied_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          migration.id,
          migration.name,
          migration.version,
          migration.description,
          migration.checksum,
          migration.createdAt
        ]);

        await this.database.query('COMMIT');

        const duration = Date.now() - startTime;
        this.logger.info('migration-system', `Migration applied: ${migration.id}`, { duration });

        return {
          success: true,
          migration,
          duration
        };

      } catch (error) {
        await this.database.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        migration,
        error: error.message,
        duration
      };
    }
  }

  async rollback(targetVersion?: string): Promise<MigrationResult[]> {
    const status = await this.getStatus();
    const results: MigrationResult[] = [];

    try {
      let migrationsToRollback = status.appliedMigrations;

      if (targetVersion) {
        migrationsToRollback = migrationsToRollback.filter(m => 
          m.version > targetVersion
        );
      }

      // Reverse order for rollback
      migrationsToRollback = migrationsToRollback.reverse();

      if (migrationsToRollback.length === 0) {
        this.logger.info('migration-system', 'No migrations to rollback');
        return results;
      }

      this.logger.info('migration-system', `Starting rollback of ${migrationsToRollback.length} migrations`);

      for (const migration of migrationsToRollback) {
        const result = await this.rollbackMigration(migration);
        results.push(result);

        if (!result.success) {
          this.logger.error('migration-system', `Rollback failed: ${migration.id}`, { error: result.error });
          break;
        }
      }

      const successCount = results.filter(r => r.success).length;
      this.logger.info('migration-system', `Rollback completed: ${successCount}/${results.length} successful`);

      this.emit('rollbackCompleted', { results, successCount: successCount === results.length });

      return results;

    } catch (error) {
      this.logger.error('migration-system', 'Rollback failed', error as Error);
      this.emit('rollbackFailed', { error, results });
      throw error;
    }
  }

  private async rollbackMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      // Start transaction
      await this.database.query('BEGIN');

      try {
        // Apply rollback
        await this.database.query(migration.down);

        // Update migration record
        await this.database.query(`
          UPDATE schema_migrations 
          SET rollback_at = NOW() 
          WHERE id = $1
        `, [migration.id]);

        await this.database.query('COMMIT');

        const duration = Date.now() - startTime;
        this.logger.info('migration-system', `Migration rolled back: ${migration.id}`, { duration });

        return {
          success: true,
          migration,
          duration
        };

      } catch (error) {
        await this.database.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        migration,
        error: error.message,
        duration
      };
    }
  }

  async createMigration(name: string, description: string): Promise<string> {
    const version = await this.generateNextVersion();
    const timestamp = new Date().toISOString();
    const id = `${version}_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const filename = `${id}.sql`;

    const template = `-- Migration: ${name}
-- Version: ${version}
-- Description: ${description}
-- Created: ${timestamp}

-- UP
-- Add your migration SQL here

-- DOWN
-- Add your rollback SQL here
`;

    const filePath = path.join(this.migrationsPath, filename);
    fs.writeFileSync(filePath, template);

    // Reload migrations
    await this.loadMigrations();

    this.logger.info('migration-system', `Migration created: ${filename}`, { name, version });

    this.emit('migrationCreated', { id, name, version, description, filename });

    return filename;
  }

  private async generateNextVersion(): Promise<string> {
    const status = await this.getStatus();
    const lastVersion = status.currentVersion;

    if (lastVersion === '0.0.0') {
      return '1.0.0';
    }

    const parts = lastVersion.split('.').map(Number);
    parts[2]++; // Increment patch version

    // Handle overflow
    if (parts[2] > 99) {
      parts[2] = 0;
      parts[1]++; // Increment minor version
      
      if (parts[1] > 99) {
        parts[1] = 0;
        parts[0]++; // Increment major version
      }
    }

    return parts.join('.');
  }

  async validateMigrations(): Promise<{
    valid: boolean;
    issues: Array<{ migration: string; issue: string }>;
  }> {
    const issues: Array<{ migration: string; issue: string }> = [];

    try {
      const status = await this.getStatus();

      // Check for duplicate versions
      const versions = new Map<string, string[]>();
      for (const migration of this.migrations.values()) {
        if (!versions.has(migration.version)) {
          versions.set(migration.version, []);
        }
        versions.get(migration.version)!.push(migration.id);
      }

      for (const [version, ids] of versions.entries()) {
        if (ids.length > 1) {
          issues.push({ migration: ids.join(', '), issue: `Duplicate version: ${version}` });
        }
      }

      // Check for gaps in version sequence
      const appliedVersions = status.appliedMigrations.map(m => m.version).sort();
      for (let i = 1; i < appliedVersions.length; i++) {
        const prev = appliedVersions[i - 1];
        const curr = appliedVersions[i];
        
        // Simple version comparison
        if (curr <= prev) {
          issues.push({ migration: curr, issue: `Version sequence error: ${curr} should be greater than ${prev}` });
        }
      }

      // Check migration syntax
      for (const migration of this.migrations.values()) {
        try {
          // Basic SQL syntax check
          if (!migration.up.trim()) {
            issues.push({ migration: migration.id, issue: 'Empty UP migration' });
          }
          if (!migration.down.trim()) {
            issues.push({ migration: migration.id, issue: 'Empty DOWN migration' });
          }
        } catch (error) {
          issues.push({ migration: migration.id, issue: `Syntax error: ${error.message}` });
        }
      }

      // Check for missing applied migrations
      const appliedIds = new Set(status.appliedMigrations.map(m => m.id));
      for (const migration of this.migrations.values()) {
        if (appliedIds.has(migration.id)) {
          const applied = status.appliedMigrations.find(m => m.id === migration.id);
          if (applied && applied.checksum !== migration.checksum) {
            issues.push({ migration: migration.id, issue: 'Checksum mismatch' });
          }
        }
      }

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error) {
      this.logger.error('migration-system', 'Failed to validate migrations', error as Error);
      return {
        valid: false,
        issues: [{ migration: 'system', issue: `Validation error: ${error.message}` }]
      };
    }
  }

  async reset(): Promise<void> {
    this.logger.warn('migration-system', 'Resetting all migrations');

    try {
      // Drop migrations table
      await this.database.query('DROP TABLE IF EXISTS schema_migrations');

      // Reinitialize
      await this.initializeMigrationsTable();

      this.logger.info('migration-system', 'Migration system reset');

      this.emit('systemReset');

    } catch (error) {
      this.logger.error('migration-system', 'Failed to reset migration system', error as Error);
      throw error;
    }
  }

  async backup(targetPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = targetPath || path.join(this.migrationsPath, `backup-${timestamp}.sql`);

    try {
      // Create database backup
      const { stdout } = await execAsync(`PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} --schema-only > ${backupPath}`);

      this.logger.info('migration-system', `Database backup created: ${backupPath}`);

      return backupPath;

    } catch (error) {
      this.logger.error('migration-system', 'Failed to create backup', error as Error);
      throw error;
    }
  }

  async getMigrationHistory(): Promise<Migration[]> {
    try {
      const rows = await this.database.query(`
        SELECT * FROM schema_migrations 
        ORDER BY applied_at DESC, version DESC
      `);

      const history: Migration[] = [];
      for (const row of rows) {
        const migration = this.migrations.get(row.id);
        if (migration) {
          history.push({
            ...migration,
            appliedAt: row.applied_at,
            rollbackAt: row.rollback_at
          });
        }
      }

      return history;

    } catch (error) {
      this.logger.error('migration-system', 'Failed to get migration history', error as Error);
      return [];
    }
  }

  async dryRun(targetVersion?: string): Promise<{
    migrationsToRun: Migration[];
    migrationsToRollback: Migration[];
    sql: string;
  }> {
    const status = await this.getStatus();
    
    let migrationsToRun = status.pendingMigrations;
    let migrationsToRollback: Migration[] = [];

    if (targetVersion) {
      migrationsToRun = migrationsToRun.filter(m => m.version <= targetVersion);
      migrationsToRollback = status.appliedMigrations
        .filter(m => m.version > targetVersion)
        .reverse();
    }

    const sql = [
      '-- Dry Run Migration Plan',
      `-- Target Version: ${targetVersion || 'latest'}`,
      `-- Generated: ${new Date().toISOString()}`,
      '',
      '-- Migrations to Apply:',
      ...migrationsToRun.map(m => `-- ${m.version}: ${m.name}`),
      '',
      '-- Migrations to Rollback:',
      ...migrationsToRollback.map(m => `-- ${m.version}: ${m.name}`),
      '',
      '-- SQL to be executed:',
      ...migrationsToRun.map(m => [
        `-- Migration: ${m.name} (${m.version})`,
        m.up,
        ''
      ]),
      ...migrationsToRollback.map(m => [
        `-- Rollback: ${m.name} (${m.version})`,
        m.down,
        ''
      ])
    ].join('\n');

    return {
      migrationsToRun,
      migrationsToRollback,
      sql
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    migrationsTableExists: boolean;
    migrationsPathExists: boolean;
    migrationCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check migrations directory
    const migrationsPathExists = fs.existsSync(this.migrationsPath);
    if (!migrationsPathExists) {
      issues.push('Migrations directory does not exist');
    }

    // Check migrations table
    let migrationsTableExists = false;
    try {
      await this.database.query('SELECT 1 FROM schema_migrations LIMIT 1');
      migrationsTableExists = true;
    } catch (error) {
      issues.push('Migrations table does not exist or is inaccessible');
    }

    // Validate migrations
    const validation = await this.validateMigrations();
    if (!validation.valid) {
      issues.push(...validation.issues.map(i => `${i.migration}: ${i.issue}`));
    }

    return {
      healthy: issues.length === 0,
      migrationsTableExists,
      migrationsPathExists,
      migrationCount: this.migrations.size,
      issues
    };
  }
}

export default UltraMigrationSystem;
