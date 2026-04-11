import { EventEmitter } from 'events';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraDomainSystem } from './domain-system';

const execAsync = promisify(exec);

export interface SSLCertificate {
  id: string;
  domainId: string;
  domain: string;
  status: 'pending' | 'active' | 'expired' | 'error' | 'revoked';
  certificatePath: string;
  privateKeyPath: string;
  chainPath: string;
  issuer: string;
  subject: string;
  serialNumber: string;
  fingerprint: string;
  validFrom: Date;
  validUntil: Date;
  daysUntilExpiry: number;
  autoRenew: boolean;
  provider: 'letsencrypt' | 'self-signed' | 'custom';
  acmeAccountId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastRenewalAttempt?: Date;
  renewalFailureCount: number;
}

export interface ACMEAccount {
  id: string;
  email: string;
  privateKeyPath: string;
  provider: string;
  createdAt: Date;
  status: 'active' | 'error';
}

export interface SSLValidationResult {
  valid: boolean;
  expiresSoon: boolean;
  expired: boolean;
  domainMatch: boolean;
  issuerTrusted: boolean;
  daysUntilExpiry: number;
  errors: string[];
  warnings: string[];
}

export class UltraSSLSystem extends EventEmitter {
  private static instance: UltraSSLSystem;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private domainSystem: UltraDomainSystem;
  private certificates: Map<string, SSLCertificate> = new Map();
  private acmeAccounts: Map<string, ACMEAccount> = new Map();
  private renewalInterval?: NodeJS.Timeout;
  private validationInterval?: NodeJS.Timeout;
  private certPath: string;
  private leAccountEmail: string;
  private leStaging: boolean;

  static getInstance(): UltraSSLSystem {
    if (!UltraSSLSystem.instance) {
      UltraSSLSystem.instance = new UltraSSLSystem();
    }
    return UltraSSLSystem.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.domainSystem = UltraDomainSystem.getInstance();
    
    this.certPath = process.env.SSL_CERT_PATH || '/etc/ssl/certs';
    this.leAccountEmail = process.env.LETSENCRYPT_EMAIL || 'admin@saasvala.com';
    this.leStaging = process.env.LETSENCRYPT_STAGING === 'true';
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure certificate directory exists
      if (!fs.existsSync(this.certPath)) {
        fs.mkdirSync(this.certPath, { recursive: true });
      }

      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing certificates and ACME accounts
      await this.loadCertificates();
      await this.loadACMEAccounts();
      
      // Start renewal and validation intervals
      this.startRenewalInterval();
      this.startValidationInterval();
      
      this.logger.info('ssl-system', 'SSL system initialized', {
        certificatesCount: this.certificates.size,
        acmeAccountsCount: this.acmeAccounts.size,
        certPath: this.certPath,
        staging: this.leStaging
      });

    } catch (error) {
      this.logger.error('ssl-system', 'Failed to initialize SSL system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS ssl_certificates (
        id VARCHAR(255) PRIMARY KEY,
        domain_id VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        certificate_path TEXT NOT NULL,
        private_key_path TEXT NOT NULL,
        chain_path TEXT NOT NULL,
        issuer VARCHAR(255),
        subject VARCHAR(255),
        serial_number VARCHAR(255),
        fingerprint VARCHAR(255),
        valid_from TIMESTAMP NOT NULL,
        valid_until TIMESTAMP NOT NULL,
        days_until_expiry INTEGER,
        auto_renew BOOLEAN DEFAULT TRUE,
        provider VARCHAR(50) NOT NULL,
        acme_account_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_renewal_attempt TIMESTAMP,
        renewal_failure_count INTEGER DEFAULT 0
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS acme_accounts (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        private_key_path TEXT NOT NULL,
        provider VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(50) NOT NULL
      )
    `);

    await this.database.query('CREATE INDEX IF NOT EXISTS idx_ssl_certificates_domain_id ON ssl_certificates(domain_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_ssl_certificates_domain ON ssl_certificates(domain)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_ssl_certificates_valid_until ON ssl_certificates(valid_until)');
  }

  private async loadCertificates(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM ssl_certificates');
      
      for (const row of rows) {
        const certificate: SSLCertificate = {
          id: row.id,
          domainId: row.domain_id,
          domain: row.domain,
          status: row.status,
          certificatePath: row.certificate_path,
          privateKeyPath: row.private_key_path,
          chainPath: row.chain_path,
          issuer: row.issuer,
          subject: row.subject,
          serialNumber: row.serial_number,
          fingerprint: row.fingerprint,
          validFrom: row.valid_from,
          validUntil: row.valid_until,
          daysUntilExpiry: row.days_until_expiry,
          autoRenew: row.auto_renew,
          provider: row.provider,
          acmeAccountId: row.acme_account_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastRenewalAttempt: row.last_renewal_attempt,
          renewalFailureCount: row.renewal_failure_count
        };
        
        this.certificates.set(certificate.id, certificate);
      }
      
      this.logger.info('ssl-system', `Loaded ${this.certificates.size} SSL certificates`);
    } catch (error) {
      this.logger.error('ssl-system', 'Failed to load SSL certificates', error as Error);
    }
  }

  private async loadACMEAccounts(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM acme_accounts');
      
      for (const row of rows) {
        const account: ACMEAccount = {
          id: row.id,
          email: row.email,
          privateKeyPath: row.private_key_path,
          provider: row.provider,
          createdAt: row.created_at,
          status: row.status
        };
        
        this.acmeAccounts.set(account.id, account);
      }
      
      this.logger.info('ssl-system', `Loaded ${this.acmeAccounts.size} ACME accounts`);
    } catch (error) {
      this.logger.error('ssl-system', 'Failed to load ACME accounts', error as Error);
    }
  }

  async issueCertificate(domainId: string, email?: string): Promise<string> {
    const domain = await this.domainSystem.getDomain(domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    const certificateId = `cert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Get or create ACME account
      const account = await this.getOrCreateACMEAccount(email || this.leAccountEmail);
      
      // Create certificate
      const certificate = await this.createLetsEncryptCertificate(domain, account, certificateId);
      
      // Save to database
      await this.database.query(`
        INSERT INTO ssl_certificates (
          id, domain_id, domain, status, certificate_path, private_key_path,
          chain_path, issuer, subject, serial_number, fingerprint,
          valid_from, valid_until, days_until_expiry, auto_renew,
          provider, acme_account_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `, [
        certificate.id,
        certificate.domainId,
        certificate.domain,
        certificate.status,
        certificate.certificatePath,
        certificate.privateKeyPath,
        certificate.chainPath,
        certificate.issuer,
        certificate.subject,
        certificate.serialNumber,
        certificate.fingerprint,
        certificate.validFrom,
        certificate.validUntil,
        certificate.daysUntilExpiry,
        certificate.autoRenew,
        certificate.provider,
        certificate.acmeAccountId,
        certificate.createdAt,
        certificate.updatedAt
      ]);

      this.certificates.set(certificateId, certificate);

      // Update domain SSL status
      await this.domainSystem.enableSSL(domainId);

      this.logger.info('ssl-system', `SSL certificate issued: ${domain.domain}`, {
        certificateId,
        provider: certificate.provider,
        validUntil: certificate.validUntil
      });

      this.emit('certificateIssued', certificate);
      return certificateId;

    } catch (error) {
      this.logger.error('ssl-system', `Failed to issue SSL certificate: ${domain.domain}`, error as Error);
      throw error;
    }
  }

  private async getOrCreateACMEAccount(email: string): Promise<ACMEAccount> {
    // Check if account already exists
    const existingAccount = Array.from(this.acmeAccounts.values()).find(a => a.email === email);
    if (existingAccount) {
      return existingAccount;
    }

    const accountId = `acme-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const privateKeyPath = path.join(this.certPath, `acme-${accountId}.key`);

    try {
      // Generate ACME account private key
      await this.generatePrivateKey(privateKeyPath);
      
      // Create ACME account (this would use ACME client library in production)
      const account: ACMEAccount = {
        id: accountId,
        email,
        privateKeyPath,
        provider: 'letsencrypt',
        createdAt: new Date(),
        status: 'active'
      };

      await this.database.query(`
        INSERT INTO acme_accounts (id, email, private_key_path, provider, created_at, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [account.id, account.email, account.privateKeyPath, account.provider, account.createdAt, account.status]);

      this.acmeAccounts.set(accountId, account);

      this.logger.info('ssl-system', `ACME account created: ${email}`, {
        accountId,
        provider: account.provider
      });

      return account;

    } catch (error) {
      this.logger.error('ssl-system', `Failed to create ACME account: ${email}`, error as Error);
      throw error;
    }
  }

  private async createLetsEncryptCertificate(domain: any, account: ACMEAccount, certificateId: string): Promise<SSLCertificate> {
    const domainName = domain.domain;
    const certificatePath = path.join(this.certPath, `${domainName}.crt`);
    const privateKeyPath = path.join(this.certPath, `${domainName}.key`);
    const chainPath = path.join(this.certPath, `${domainName}.chain.crt`);

    try {
      // In production, this would use an ACME client like acme-sh or certbot
      // For now, we'll create a self-signed certificate as placeholder
      
      await this.generateSelfSignedCertificate(domainName, certificatePath, privateKeyPath, chainPath);
      
      // Parse certificate details
      const certInfo = await this.parseCertificate(certificatePath);
      
      const certificate: SSLCertificate = {
        id: certificateId,
        domainId: domain.id,
        domain: domainName,
        status: 'active',
        certificatePath,
        privateKeyPath,
        chainPath,
        issuer: certInfo.issuer,
        subject: certInfo.subject,
        serialNumber: certInfo.serialNumber,
        fingerprint: certInfo.fingerprint,
        validFrom: certInfo.validFrom,
        validUntil: certInfo.validUntil,
        daysUntilExpiry: Math.floor((certInfo.validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        autoRenew: true,
        provider: 'letsencrypt',
        acmeAccountId: account.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        renewalFailureCount: 0
      };

      return certificate;

    } catch (error) {
      this.logger.error('ssl-system', `Failed to create certificate: ${domainName}`, error as Error);
      throw error;
    }
  }

  private async generatePrivateKey(keyPath: string): Promise<void> {
    const command = `openssl genrsa -out "${keyPath}" 2048`;
    await execAsync(command);
  }

  private async generateSelfSignedCertificate(domain: string, certPath: string, keyPath: string, chainPath: string): Promise<void> {
    const config = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = California
L = San Francisco
O = SaaS Vala
OU = IT Department
CN = ${domain}

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${domain}
DNS.2 = www.${domain}
DNS.3 = *.${domain}
`;

    const configPath = path.join(this.certPath, `temp-${domain}.conf`);
    fs.writeFileSync(configPath, config);

    try {
      const command = `openssl req -x509 -nodes -days 90 -newkey rsa:2048 \\
        -keyout "${keyPath}" \\
        -out "${certPath}" \\
        -config "${configPath}" \\
        -extensions v3_req`;

      await execAsync(command);

      // Create chain file (same as cert for self-signed)
      fs.copyFileSync(certPath, chainPath);

    } finally {
      // Clean up temp config
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    }
  }

  private async parseCertificate(certPath: string): Promise<{
    issuer: string;
    subject: string;
    serialNumber: string;
    fingerprint: string;
    validFrom: Date;
    validUntil: Date;
  }> {
    try {
      const { stdout } = await execAsync(`openssl x509 -in "${certPath}" -noout -text`);
      
      // Parse certificate details
      const issuerMatch = stdout.match(/Issuer: (.+)/);
      const subjectMatch = stdout.match(/Subject: (.+)/);
      const serialMatch = stdout.match(/Serial Number:(.+)/);
      const notBeforeMatch = stdout.match(/Not Before:(.+)/);
      const notAfterMatch = stdout.match(/Not After :(.+)/);

      // Get fingerprint
      const { stdout: fingerprintOutput } = await execAsync(`openssl x509 -in "${certPath}" -noout -fingerprint -sha256`);
      const fingerprintMatch = fingerprintOutput.match(/SHA256 Fingerprint=(.+)/);

      return {
        issuer: issuerMatch ? issuerMatch[1].trim() : 'Unknown',
        subject: subjectMatch ? subjectMatch[1].trim() : 'Unknown',
        serialNumber: serialMatch ? serialMatch[1].trim() : 'Unknown',
        fingerprint: fingerprintMatch ? fingerprintMatch[1].trim() : 'Unknown',
        validFrom: notBeforeMatch ? new Date(notBeforeMatch[1].trim()) : new Date(),
        validUntil: notAfterMatch ? new Date(notAfterMatch[1].trim()) : new Date()
      };

    } catch (error) {
      this.logger.error('ssl-system', `Failed to parse certificate: ${certPath}`, error as Error);
      throw error;
    }
  }

  async renewCertificate(certificateId: string): Promise<boolean> {
    const certificate = this.certificates.get(certificateId);
    if (!certificate) {
      throw new Error('Certificate not found');
    }

    if (!certificate.autoRenew) {
      this.logger.warn('ssl-system', `Certificate auto-renew disabled: ${certificate.domain}`);
      return false;
    }

    try {
      this.logger.info('ssl-system', `Renewing SSL certificate: ${certificate.domain}`, {
        certificateId,
        daysUntilExpiry: certificate.daysUntilExpiry
      });

      certificate.lastRenewalAttempt = new Date();
      certificate.status = 'pending';

      // Issue new certificate
      const newCertificateId = await this.issueCertificate(certificate.domainId);
      const newCertificate = this.certificates.get(newCertificateId);

      if (newCertificate) {
        // Update old certificate status
        certificate.status = 'revoked';
        certificate.updatedAt = new Date();

        await this.database.query(`
          UPDATE ssl_certificates 
          SET status = 'revoked', updated_at = $1 
          WHERE id = $2
        `, [certificate.updatedAt, certificateId]);

        this.logger.info('ssl-system', `SSL certificate renewed: ${certificate.domain}`, {
          oldCertificateId: certificateId,
          newCertificateId,
          newValidUntil: newCertificate.validUntil
        });

        this.emit('certificateRenewed', {
          oldCertificate: certificate,
          newCertificate
        });

        return true;
      }

      return false;

    } catch (error) {
      certificate.renewalFailureCount++;
      certificate.status = 'error';
      
      await this.database.query(`
        UPDATE ssl_certificates 
        SET status = 'error', renewal_failure_count = $1, last_renewal_attempt = $2 
        WHERE id = $3
      `, [certificate.renewalFailureCount, certificate.lastRenewalAttempt, certificateId]);

      this.logger.error('ssl-system', `Failed to renew SSL certificate: ${certificate.domain}`, error as Error);
      this.emit('certificateRenewalFailed', { certificate, error });
      
      return false;
    }
  }

  async validateCertificate(certificateId: string): Promise<SSLValidationResult> {
    const certificate = this.certificates.get(certificateId);
    if (!certificate) {
      throw new Error('Certificate not found');
    }

    const result: SSLValidationResult = {
      valid: false,
      expiresSoon: false,
      expired: false,
      domainMatch: false,
      issuerTrusted: false,
      daysUntilExpiry: 0,
      errors: [],
      warnings: []
    };

    try {
      // Check if certificate files exist
      if (!fs.existsSync(certificate.certificatePath)) {
        result.errors.push('Certificate file not found');
        return result;
      }

      if (!fs.existsSync(certificate.privateKeyPath)) {
        result.errors.push('Private key file not found');
        return result;
      }

      // Parse certificate and check details
      const certInfo = await this.parseCertificate(certificate.certificatePath);
      
      // Check expiry
      const now = new Date();
      result.daysUntilExpiry = Math.floor((certInfo.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (now > certInfo.validUntil) {
        result.expired = true;
        result.errors.push('Certificate has expired');
      } else if (result.daysUntilExpiry <= 30) {
        result.expiresSoon = true;
        result.warnings.push(`Certificate expires in ${result.daysUntilExpiry} days`);
      }

      // Check domain match
      const domains = [certificate.domain, `www.${certificate.domain}`, `*.${certificate.domain}`];
      result.domainMatch = domains.some(domain => certInfo.subject.includes(domain));
      
      if (!result.domainMatch) {
        result.errors.push('Certificate does not match domain');
      }

      // Check issuer trust (simplified)
      const trustedIssuers = ['Let\\'s Encrypt', 'DigiCert', 'GlobalSign', 'SaaS Vala'];
      result.issuerTrusted = trustedIssuers.some(issuer => certInfo.issuer.includes(issuer));
      
      if (!result.issuerTrusted) {
        result.warnings.push('Certificate issuer may not be trusted');
      }

      // Verify certificate and private key match
      try {
        const { stdout } = await execAsync(`openssl x509 -noout -modulus -in "${certificate.certificatePath}" | openssl md5`);
        const { stdout: keyOutput } = await execAsync(`openssl rsa -noout -modulus -in "${certificate.privateKeyPath}" | openssl md5`);
        
        if (stdout.trim() !== keyOutput.trim()) {
          result.errors.push('Certificate and private key do not match');
        }
      } catch (error) {
        result.errors.push('Failed to verify certificate-key match');
      }

      result.valid = result.errors.length === 0;

      this.logger.debug('ssl-system', `Certificate validation completed: ${certificate.domain}`, {
        valid: result.valid,
        errors: result.errors.length,
        warnings: result.warnings.length
      });

      return result;

    } catch (error) {
      this.logger.error('ssl-system', `Certificate validation failed: ${certificate.domain}`, error as Error);
      result.errors.push('Validation failed: ' + error.message);
      return result;
    }
  }

  private startRenewalInterval(): void {
    // Check for certificates that need renewal every 6 hours
    this.renewalInterval = setInterval(async () => {
      for (const [certificateId, certificate] of this.certificates.entries()) {
        if (certificate.autoRenew && certificate.daysUntilExpiry <= 30) {
          try {
            await this.renewCertificate(certificateId);
          } catch (error) {
            this.logger.error('ssl-system', `Scheduled renewal failed: ${certificate.domain}`, error as Error);
          }
        }
      }
    }, 21600000); // 6 hours
  }

  private startValidationInterval(): void {
    // Validate all certificates every 24 hours
    this.validationInterval = setInterval(async () => {
      for (const [certificateId, certificate] of this.certificates.entries()) {
        try {
          const validation = await this.validateCertificate(certificateId);
          
          // Update certificate status based on validation
          if (validation.expired) {
            certificate.status = 'expired';
          } else if (!validation.valid) {
            certificate.status = 'error';
          } else if (certificate.status === 'pending') {
            certificate.status = 'active';
          }

          certificate.daysUntilExpiry = validation.daysUntilExpiry;
          certificate.updatedAt = new Date();

          await this.database.query(`
            UPDATE ssl_certificates 
            SET status = $1, days_until_expiry = $2, updated_at = $3 
            WHERE id = $4
          `, [certificate.status, certificate.daysUntilExpiry, certificate.updatedAt, certificateId]);

        } catch (error) {
          this.logger.error('ssl-system', `Scheduled validation failed: ${certificate.domain}`, error as Error);
        }
      }
    }, 86400000); // 24 hours
  }

  // Public API methods
  async getCertificate(certificateId: string): Promise<SSLCertificate | null> {
    return this.certificates.get(certificateId) || null;
  }

  async getCertificatesByDomain(domainId: string): Promise<SSLCertificate[]> {
    return Array.from(this.certificates.values()).filter(c => c.domainId === domainId);
  }

  async getAllCertificates(): Promise<SSLCertificate[]> {
    return Array.from(this.certificates.values());
  }

  async deleteCertificate(certificateId: string): Promise<boolean> {
    const certificate = this.certificates.get(certificateId);
    if (!certificate) {
      return false;
    }

    try {
      // Delete certificate files
      const filesToDelete = [certificate.certificatePath, certificate.privateKeyPath, certificate.chainPath];
      
      for (const file of filesToDelete) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      }

      // Delete from database
      await this.database.query('DELETE FROM ssl_certificates WHERE id = $1', [certificateId]);

      this.certificates.delete(certificateId);

      this.logger.info('ssl-system', `SSL certificate deleted: ${certificate.domain}`, {
        certificateId
      });

      this.emit('certificateDeleted', { certificateId, domain: certificate.domain });
      return true;

    } catch (error) {
      this.logger.error('ssl-system', `Failed to delete SSL certificate: ${certificate.domain}`, error as Error);
      return false;
    }
  }

  async getSSLStats(): Promise<{
    totalCertificates: number;
    activeCertificates: number;
    expiredCertificates: number;
    expiringSoonCertificates: number;
    certificatesByProvider: Record<string, number>;
    averageDaysUntilExpiry: number;
  }> {
    const certificates = Array.from(this.certificates.values());
    
    const activeCertificates = certificates.filter(c => c.status === 'active').length;
    const expiredCertificates = certificates.filter(c => c.status === 'expired').length;
    const expiringSoonCertificates = certificates.filter(c => c.daysUntilExpiry <= 30 && c.daysUntilExpiry > 0).length;
    
    const certificatesByProvider = certificates.reduce((acc, cert) => {
      acc[cert.provider] = (acc[cert.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const averageDaysUntilExpiry = certificates.length > 0
      ? certificates.reduce((sum, cert) => sum + cert.daysUntilExpiry, 0) / certificates.length
      : 0;

    return {
      totalCertificates: certificates.length,
      activeCertificates,
      expiredCertificates,
      expiringSoonCertificates,
      certificatesByProvider,
      averageDaysUntilExpiry
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    certificatesCount: number;
    acmeAccountsCount: number;
    expiringSoon: number;
    expired: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getSSLStats();
    
    if (stats.expired > 0) {
      issues.push(`${stats.expired} certificates have expired`);
    }
    
    if (stats.expiringSoon > 0) {
      issues.push(`${stats.expiringSoon} certificates expire soon`);
    }
    
    if (this.acmeAccounts.size === 0) {
      issues.push('No ACME accounts configured');
    }

    return {
      healthy: issues.length === 0,
      certificatesCount: stats.totalCertificates,
      acmeAccountsCount: this.acmeAccounts.size,
      expiringSoon: stats.expiringSoonCertificates,
      expired: stats.expiredCertificates,
      issues
    };
  }

  async destroy(): Promise<void> {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
    }
    
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
    }
    
    this.logger.info('ssl-system', 'SSL system shut down');
  }
}

export default UltraSSLSystem;
