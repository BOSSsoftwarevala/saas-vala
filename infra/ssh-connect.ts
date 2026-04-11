import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Client } from 'ssh2';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';

const execAsync = promisify(exec);

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
  password?: string;
  keyId?: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastConnected?: Date;
  lastError?: string;
  userId: string;
  serverId?: string;
  tags: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SSHCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

export interface SSHKeyPair {
  id: string;
  name: string;
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  userId: string;
  createdAt: Date;
  encrypted: boolean;
  passphrase?: string;
}

export interface SSHSession {
  id: string;
  connectionId: string;
  startTime: Date;
  endTime?: Date;
  commands: SSHCommandResult[];
  status: 'active' | 'completed' | 'error';
}

export class UltraSSHConnect extends EventEmitter {
  private static instance: UltraSSHConnect;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private connections: Map<string, SSHConnection> = new Map();
  private keyPairs: Map<string, SSHKeyPair> = new Map();
  private activeSessions: Map<string, SSHSession> = new Map();
  private sshConfigPath: string;
  private knownHostsPath: string;

  static getInstance(): UltraSSHConnect {
    if (!UltraSSHConnect.instance) {
      UltraSSHConnect.instance = new UltraSSHConnect();
    }
    return UltraSSHConnect.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    
    this.sshConfigPath = process.env.SSH_CONFIG_PATH || path.join(process.cwd(), '.ssh', 'config');
    this.knownHostsPath = process.env.SSH_KNOWN_HOSTS_PATH || path.join(process.cwd(), '.ssh', 'known_hosts');
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure SSH directories exist
      const sshDir = path.dirname(this.sshConfigPath);
      if (!fs.existsSync(sshDir)) {
        fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
      }

      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing connections and key pairs
      await this.loadConnections();
      await this.loadKeyPairs();
      
      // Setup SSH config
      await this.setupSSHConfig();
      
      // Start connection monitoring
      this.startConnectionMonitoring();
      
      this.logger.info('ssh-connect', 'SSH connect system initialized', {
        connectionsCount: this.connections.size,
        keyPairsCount: this.keyPairs.size,
        sshConfigPath: this.sshConfigPath
      });

    } catch (error) {
      this.logger.error('ssh-connect', 'Failed to initialize SSH connect system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS ssh_connections (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL,
        username VARCHAR(255) NOT NULL,
        private_key_path TEXT NOT NULL,
        password TEXT,
        key_id VARCHAR(255),
        status VARCHAR(50) NOT NULL,
        last_connected TIMESTAMP,
        last_error TEXT,
        user_id VARCHAR(255) NOT NULL,
        server_id VARCHAR(255),
        tags JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS ssh_key_pairs (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        public_key TEXT NOT NULL,
        private_key TEXT NOT NULL,
        fingerprint VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        encrypted BOOLEAN DEFAULT FALSE,
        passphrase TEXT
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS ssh_sessions (
        id VARCHAR(255) PRIMARY KEY,
        connection_id VARCHAR(255) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        commands JSONB,
        status VARCHAR(50) NOT NULL
      )
    `);

    await this.database.query('CREATE INDEX IF NOT EXISTS idx_ssh_connections_user_id ON ssh_connections(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_ssh_connections_server_id ON ssh_connections(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_ssh_key_pairs_user_id ON ssh_key_pairs(user_id)');
  }

  private async loadConnections(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM ssh_connections');
      
      for (const row of rows) {
        const connection: SSHConnection = {
          id: row.id,
          name: row.name,
          host: row.host,
          port: row.port,
          username: row.username,
          privateKeyPath: row.private_key_path,
          password: row.password,
          keyId: row.key_id,
          status: row.status,
          lastConnected: row.last_connected,
          lastError: row.last_error,
          userId: row.user_id,
          serverId: row.server_id,
          tags: row.tags || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.connections.set(connection.id, connection);
      }
      
      this.logger.info('ssh-connect', `Loaded ${this.connections.size} SSH connections`);
    } catch (error) {
      this.logger.error('ssh-connect', 'Failed to load SSH connections', error as Error);
    }
  }

  private async loadKeyPairs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM ssh_key_pairs');
      
      for (const row of rows) {
        const keyPair: SSHKeyPair = {
          id: row.id,
          name: row.name,
          publicKey: row.public_key,
          privateKey: row.private_key,
          fingerprint: row.fingerprint,
          userId: row.user_id,
          createdAt: row.created_at,
          encrypted: row.encrypted,
          passphrase: row.passphrase
        };
        
        this.keyPairs.set(keyPair.id, keyPair);
      }
      
      this.logger.info('ssh-connect', `Loaded ${this.keyPairs.size} SSH key pairs`);
    } catch (error) {
      this.logger.error('ssh-connect', 'Failed to load SSH key pairs', error as Error);
    }
  }

  private async setupSSHConfig(): Promise<void> {
    try {
      // Create SSH config file
      let configContent = '# Ultra SSH Connect Configuration\n';
      configContent += 'StrictHostKeyChecking=accept-new\n';
      configContent += 'UserKnownHostsFile ' + this.knownHostsPath + '\n';
      configContent += 'LogLevel ERROR\n';
      configContent += 'ConnectTimeout 30\n';
      configContent += 'ServerAliveInterval 60\n';
      configContent += 'ServerAliveCountMax 3\n\n';

      // Add connection configurations
      for (const [id, connection] of this.connections.entries()) {
        configContent += `Host ${connection.name}\n`;
        configContent += `  HostName ${connection.host}\n`;
        configContent += `  Port ${connection.port}\n`;
        configContent += `  User ${connection.username}\n`;
        configContent += `  IdentityFile ${connection.privateKeyPath}\n`;
        configContent += `  IdentitiesOnly yes\n\n`;
      }

      fs.writeFileSync(this.sshConfigPath, configContent);
      fs.chmodSync(this.sshConfigPath, 0o600);

      this.logger.debug('ssh-connect', 'SSH configuration updated');
    } catch (error) {
      this.logger.error('ssh-connect', 'Failed to setup SSH configuration', error as Error);
    }
  }

  async createConnection(
    name: string,
    host: string,
    port: number,
    username: string,
    privateKeyPath: string,
    password?: string,
    userId: string,
    serverId?: string,
    tags?: Record<string, string>
  ): Promise<string> {
    const connectionId = `ssh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate private key exists
      if (!fs.existsSync(privateKeyPath)) {
        throw new Error('Private key file not found');
      }

      const connection: SSHConnection = {
        id: connectionId,
        name,
        host,
        port,
        username,
        privateKeyPath,
        password,
        status: 'disconnected',
        userId,
        serverId,
        tags: tags || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await this.database.query(`
        INSERT INTO ssh_connections (
          id, name, host, port, username, private_key_path, password,
          status, user_id, server_id, tags, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        connection.id,
        connection.name,
        connection.host,
        connection.port,
        connection.username,
        connection.privateKeyPath,
        connection.password,
        connection.status,
        connection.userId,
        connection.serverId,
        JSON.stringify(connection.tags),
        connection.createdAt,
        connection.updatedAt
      ]);

      this.connections.set(connectionId, connection);

      // Update SSH config
      await this.setupSSHConfig();

      this.logger.info('ssh-connect', `SSH connection created: ${name}`, {
        connectionId,
        host,
        port,
        username
      });

      this.emit('connectionCreated', connection);
      return connectionId;

    } catch (error) {
      this.logger.error('ssh-connect', `Failed to create SSH connection: ${name}`, error as Error);
      throw error;
    }
  }

  async testConnection(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('SSH connection not found');
    }

    try {
      connection.status = 'connecting';
      connection.updatedAt = new Date();

      await this.database.query(`
        UPDATE ssh_connections 
        SET status = 'connecting', updated_at = $1 
        WHERE id = $2
      `, [connection.updatedAt, connectionId]);

      const result = await this.executeCommand(connectionId, 'echo "Connection test successful"', 10000);

      if (result.success) {
        connection.status = 'connected';
        connection.lastConnected = new Date();
        connection.lastError = undefined;
        
        this.logger.info('ssh-connect', `SSH connection test successful: ${connection.name}`, {
          connectionId,
          executionTime: result.executionTime
        });

        this.emit('connectionTestSuccess', connection);
        return true;
      } else {
        throw new Error(result.stderr);
      }

    } catch (error) {
      connection.status = 'error';
      connection.lastError = error.message;
      connection.updatedAt = new Date();

      await this.database.query(`
        UPDATE ssh_connections 
        SET status = 'error', last_error = $1, updated_at = $2 
        WHERE id = $3
      `, [connection.lastError, connection.updatedAt, connectionId]);

      this.logger.error('ssh-connect', `SSH connection test failed: ${connection.name}`, error as Error);
      this.emit('connectionTestFailed', { connection, error });
      return false;
    }
  }

  async executeCommand(connectionId: string, command: string, timeout: number = 30000): Promise<SSHCommandResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('SSH connection not found');
    }

    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const conn = new Client();
      let stdout = '';
      let stderr = '';

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            resolve({
              success: false,
              stdout: '',
              stderr: err.message,
              exitCode: 1,
              executionTime: Date.now() - startTime
            });
            return;
          }

          stream.on('close', (code: number) => {
            conn.end();
            resolve({
              success: code === 0,
              stdout,
              stderr,
              exitCode: code,
              executionTime: Date.now() - startTime
            });
          });

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        });
      });

      conn.on('error', (err) => {
        resolve({
          success: false,
          stdout: '',
          stderr: err.message,
          exitCode: 1,
          executionTime: Date.now() - startTime
        });
      });

      // Connection configuration
      const config: any = {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        readyTimeout: timeout
      };

      if (connection.privateKeyPath && fs.existsSync(connection.privateKeyPath)) {
        config.privateKey = fs.readFileSync(connection.privateKeyPath);
      } else if (connection.password) {
        config.password = connection.password;
      }

      conn.connect(config);

      // Timeout
      setTimeout(() => {
        if (!conn.destroyed) {
          conn.destroy();
          resolve({
            success: false,
            stdout: '',
            stderr: 'Command execution timeout',
            exitCode: 124,
            executionTime: Date.now() - startTime
          });
        }
      }, timeout);
    });
  }

  async createSession(connectionId: string): Promise<string> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('SSH connection not found');
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: SSHSession = {
      id: sessionId,
      connectionId,
      startTime: new Date(),
      commands: [],
      status: 'active'
    };

    this.activeSessions.set(sessionId, session);

    // Save to database
    await this.database.query(`
      INSERT INTO ssh_sessions (id, connection_id, start_time, status)
      VALUES ($1, $2, $3, $4)
    `, [session.id, session.connectionId, session.startTime, session.status]);

    this.logger.info('ssh-connect', `SSH session created: ${connection.name}`, {
      sessionId,
      connectionId
    });

    return sessionId;
  }

  async executeCommandInSession(sessionId: string, command: string, timeout: number = 30000): Promise<SSHCommandResult> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('SSH session not found');
    }

    const connection = this.connections.get(session.connectionId);
    if (!connection) {
      throw new Error('SSH connection not found');
    }

    try {
      const result = await this.executeCommand(session.connectionId, command, timeout);
      
      session.commands.push(result);
      
      // Update session in database
      await this.database.query(`
        UPDATE ssh_sessions 
        SET commands = $1 
        WHERE id = $2
      `, [JSON.stringify(session.commands), sessionId]);

      return result;

    } catch (error) {
      session.status = 'error';
      throw error;
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    session.endTime = new Date();
    session.status = 'completed';

    await this.database.query(`
      UPDATE ssh_sessions 
      SET end_time = $1, status = $2 
      WHERE id = $3
    `, [session.endTime, session.status, sessionId]);

    this.activeSessions.delete(sessionId);

    this.logger.info('ssh-connect', `SSH session closed: ${sessionId}`, {
      commandsExecuted: session.commands.length,
      duration: session.endTime.getTime() - session.startTime.getTime()
    });
  }

  async generateKeyPair(name: string, userId: string, passphrase?: string, encrypt: boolean = true): Promise<string> {
    const keyId = `keypair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const tempDir = fs.mkdtempSync('/tmp/ssh-keygen-');
      const privateKeyPath = path.join(tempDir, 'id_rsa');
      const publicKeyPath = path.join(tempDir, 'id_rsa.pub');

      // Generate key pair
      let command = `ssh-keygen -t rsa -b 4096 -f "${privateKeyPath}" -N "${passphrase || ''}"`;
      await execAsync(command);

      // Read keys
      const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

      // Generate fingerprint
      const { stdout } = await execAsync(`ssh-keygen -lf "${publicKeyPath}"`);
      const fingerprint = stdout.trim().split(/\s+/)[1];

      const keyPair: SSHKeyPair = {
        id: keyId,
        name,
        publicKey,
        privateKey,
        fingerprint,
        userId,
        createdAt: new Date(),
        encrypted: encrypt && !!passphrase,
        passphrase
      };

      // Save to database
      await this.database.query(`
        INSERT INTO ssh_key_pairs (id, name, public_key, private_key, fingerprint, user_id, created_at, encrypted, passphrase)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        keyPair.id,
        keyPair.name,
        keyPair.publicKey,
        keyPair.privateKey,
        keyPair.fingerprint,
        keyPair.userId,
        keyPair.createdAt,
        keyPair.encrypted,
        keyPair.passphrase
      ]);

      this.keyPairs.set(keyId, keyPair);

      // Cleanup temp files
      fs.rmSync(tempDir, { recursive: true });

      this.logger.info('ssh-connect', `SSH key pair generated: ${name}`, {
        keyId,
        fingerprint,
        encrypted: keyPair.encrypted
      });

      this.emit('keyPairGenerated', keyPair);
      return keyId;

    } catch (error) {
      this.logger.error('ssh-connect', `Failed to generate SSH key pair: ${name}`, error as Error);
      throw error;
    }
  }

  async deploySSHKey(connectionId: string, publicKey: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('SSH connection not found');
    }

    try {
      // Create .ssh directory if it doesn't exist
      await this.executeCommand(connectionId, 'mkdir -p ~/.ssh && chmod 700 ~/.ssh');

      // Add public key to authorized_keys
      const escapedKey = publicKey.replace(/'/g, "'\"'\"'");
      await this.executeCommand(connectionId, `echo '${escapedKey}' >> ~/.ssh/authorized_keys`);

      // Set proper permissions
      await this.executeCommand(connectionId, 'chmod 600 ~/.ssh/authorized_keys');

      this.logger.info('ssh-connect', `SSH key deployed to: ${connection.name}`, {
        connectionId,
        fingerprint: publicKey.split(' ').slice(-2)[0]
      });

      return true;

    } catch (error) {
      this.logger.error('ssh-connect', `Failed to deploy SSH key: ${connection.name}`, error as Error);
      return false;
    }
  }

  async installSSHKeyOnServer(connectionId: string, keyId: string): Promise<boolean> {
    const keyPair = this.keyPairs.get(keyId);
    if (!keyPair) {
      throw new Error('SSH key pair not found');
    }

    return await this.deploySSHKey(connectionId, keyPair.publicKey);
  }

  private startConnectionMonitoring(): void {
    // Check connection status every 5 minutes
    setInterval(async () => {
      for (const [connectionId, connection] of this.connections.entries()) {
        if (connection.status === 'connected') {
          try {
            const result = await this.executeCommand(connectionId, 'echo "health check"', 5000);
            if (!result.success) {
              connection.status = 'disconnected';
              connection.lastError = 'Health check failed';
              connection.updatedAt = new Date();

              await this.database.query(`
                UPDATE ssh_connections 
                SET status = 'disconnected', last_error = $1, updated_at = $2 
                WHERE id = $3
              `, [connection.lastError, connection.updatedAt, connectionId]);

              this.emit('connectionLost', connection);
            }
          } catch (error) {
            // Connection is actually down
            connection.status = 'disconnected';
            connection.lastError = 'Connection lost';
            connection.updatedAt = new Date();

            await this.database.query(`
              UPDATE ssh_connections 
              SET status = 'disconnected', last_error = $1, updated_at = $2 
              WHERE id = $3
            `, [connection.lastError, connection.updatedAt, connectionId]);

            this.emit('connectionLost', connection);
          }
        }
      }
    }, 300000); // 5 minutes
  }

  // Public API methods
  async getConnection(connectionId: string): Promise<SSHConnection | null> {
    return this.connections.get(connectionId) || null;
  }

  async getConnectionsByUserId(userId: string): Promise<SSHConnection[]> {
    return Array.from(this.connections.values()).filter(c => c.userId === userId);
  }

  async getKeyPair(keyId: string): Promise<SSHKeyPair | null> {
    return this.keyPairs.get(keyId) || null;
  }

  async getKeyPairsByUserId(userId: string): Promise<SSHKeyPair[]> {
    return Array.from(this.keyPairs.values()).filter(k => k.userId === userId);
  }

  async deleteConnection(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      // Delete from database
      await this.database.query('DELETE FROM ssh_connections WHERE id = $1', [connectionId]);

      this.connections.delete(connectionId);

      // Update SSH config
      await this.setupSSHConfig();

      this.logger.info('ssh-connect', `SSH connection deleted: ${connection.name}`, {
        connectionId
      });

      this.emit('connectionDeleted', { connectionId, name: connection.name });
      return true;

    } catch (error) {
      this.logger.error('ssh-connect', `Failed to delete SSH connection: ${connection.name}`, error as Error);
      return false;
    }
  }

  async deleteKeyPair(keyId: string): Promise<boolean> {
    const keyPair = this.keyPairs.get(keyId);
    if (!keyPair) {
      return false;
    }

    try {
      // Delete from database
      await this.database.query('DELETE FROM ssh_key_pairs WHERE id = $1', [keyId]);

      this.keyPairs.delete(keyId);

      this.logger.info('ssh-connect', `SSH key pair deleted: ${keyPair.name}`, {
        keyId,
        fingerprint: keyPair.fingerprint
      });

      this.emit('keyPairDeleted', { keyId, name: keyPair.name });
      return true;

    } catch (error) {
      this.logger.error('ssh-connect', `Failed to delete SSH key pair: ${keyPair.name}`, error as Error);
      return false;
    }
  }

  async getConnectionStats(): Promise<{
    totalConnections: number;
    connectedConnections: number;
    disconnectedConnections: number;
    errorConnections: number;
    totalKeyPairs: number;
    activeSessions: number;
  }> {
    const connections = Array.from(this.connections.values());
    
    return {
      totalConnections: connections.length,
      connectedConnections: connections.filter(c => c.status === 'connected').length,
      disconnectedConnections: connections.filter(c => c.status === 'disconnected').length,
      errorConnections: connections.filter(c => c.status === 'error').length,
      totalKeyPairs: this.keyPairs.size,
      activeSessions: this.activeSessions.size
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    connectionsCount: number;
    keyPairsCount: number;
    activeSessionsCount: number;
    sshConfigExists: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    const sshConfigExists = fs.existsSync(this.sshConfigPath);
    if (!sshConfigExists) {
      issues.push('SSH config file not found');
    }

    const stats = await this.getConnectionStats();
    if (stats.errorConnections > 0) {
      issues.push(`${stats.errorConnections} connections in error state`);
    }

    return {
      healthy: issues.length === 0,
      connectionsCount: stats.totalConnections,
      keyPairsCount: stats.totalKeyPairs,
      activeSessionsCount: stats.activeSessions,
      sshConfigExists,
      issues
    };
  }
}

export default UltraSSHConnect;
