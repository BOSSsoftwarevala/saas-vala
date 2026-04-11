export interface ProductVersion {
  id: string;
  productId: string;
  version: string;
  description: string;
  changelog: string;
  isActive: boolean;
  deployedAt?: string;
  createdAt: string;
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface ApiVersion {
  id: string;
  version: string;
  description: string;
  endpoint: string;
  isActive: boolean;
  deprecatedAt?: string;
  sunsetAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface Deployment {
  id: string;
  versionId: string;
  environment: 'development' | 'staging' | 'production';
  status: 'pending' | 'deploying' | 'completed' | 'failed' | 'rolled_back';
  deployedAt?: string;
  rollbackData?: any;
  createdAt: string;
  createdBy: string;
}

export class VersionManager {
  private static instance: VersionManager;
  private productVersions: Map<string, ProductVersion[]> = new Map();
  private apiVersions: Map<string, ApiVersion> = new Map();

  static getInstance(): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager();
    }
    return VersionManager.instance;
  }

  async createProductVersion(
    productId: string,
    version: string,
    description: string,
    changelog: string,
    createdBy: string,
    metadata?: Record<string, any>
  ): Promise<ProductVersion> {
    const newVersion: ProductVersion = {
      id: this.generateVersionId(),
      productId,
      version,
      description,
      changelog,
      isActive: false,
      createdAt: new Date().toISOString(),
      createdBy,
      metadata,
    };

    if (!this.productVersions.has(productId)) {
      this.productVersions.set(productId, []);
    }

    this.productVersions.get(productId)!.push(newVersion);
    await this.saveVersionToDB(newVersion);

    return newVersion;
  }

  async getProductVersions(productId: string): Promise<ProductVersion[]> {
    if (this.productVersions.has(productId)) {
      return this.productVersions.get(productId)!;
    }

    // Fetch from database
    const versions = await this.fetchProductVersionsFromDB(productId);
    this.productVersions.set(productId, versions);
    return versions;
  }

  async getActiveVersion(productId: string): Promise<ProductVersion | null> {
    const versions = await this.getProductVersions(productId);
    return versions.find(v => v.isActive) || null;
  }

  async activateVersion(productId: string, versionId: string, activatedBy: string): Promise<void> {
    const versions = await this.getProductVersions(productId);
    const versionToActivate = versions.find(v => v.id === versionId);
    
    if (!versionToActivate) {
      throw new Error(`Version ${versionId} not found for product ${productId}`);
    }

    // Deactivate all other versions
    versions.forEach(v => {
      v.isActive = v.id === versionId;
    });

    versionToActivate.isActive = true;
    versionToActivate.deployedAt = new Date().toISOString();

    await this.updateVersionsInDB(versions);
    this.productVersions.set(productId, versions);
  }

  async rollbackToVersion(productId: string, versionId: string, rolledBackBy: string): Promise<void> {
    const versions = await this.getProductVersions(productId);
    const targetVersion = versions.find(v => v.id === versionId);
    
    if (!targetVersion) {
      throw new Error(`Version ${versionId} not found for product ${productId}`);
    }

    const currentActiveVersion = versions.find(v => v.isActive);
    
    // Create rollback deployment record
    const rollbackDeployment: Deployment = {
      id: this.generateDeploymentId(),
      versionId: targetVersion.id,
      environment: 'production',
      status: 'completed',
      deployedAt: new Date().toISOString(),
      rollbackData: {
        fromVersion: currentActiveVersion?.id,
        toVersion: targetVersion.id,
        rolledBackBy,
      },
      createdAt: new Date().toISOString(),
      createdBy: rolledBackBy,
    };

    await this.createDeploymentRecord(rollbackDeployment);
    await this.activateVersion(productId, versionId, rolledBackBy);
  }

  async createApiVersion(
    version: string,
    description: string,
    endpoint: string,
    createdBy: string
  ): Promise<ApiVersion> {
    const newApiVersion: ApiVersion = {
      id: this.generateApiVersionId(),
      version,
      description,
      endpoint,
      isActive: false,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    this.apiVersions.set(newApiVersion.id, newApiVersion);
    await this.saveApiVersionToDB(newApiVersion);

    return newApiVersion;
  }

  async getApiVersions(): Promise<ApiVersion[]> {
    return Array.from(this.apiVersions.values());
  }

  async getActiveApiVersion(): Promise<ApiVersion | null> {
    const versions = Array.from(this.apiVersions.values());
    return versions.find(v => v.isActive) || null;
  }

  async activateApiVersion(versionId: string, activatedBy: string): Promise<void> {
    const version = this.apiVersions.get(versionId);
    if (!version) {
      throw new Error(`API version ${versionId} not found`);
    }

    // Deactivate all other versions
    this.apiVersions.forEach(v => {
      v.isActive = v.id === versionId;
    });

    version.isActive = true;
    await this.updateApiVersionInDB(version);
  }

  async deprecateApiVersion(versionId: string, sunsetAt?: string): Promise<void> {
    const version = this.apiVersions.get(versionId);
    if (!version) {
      throw new Error(`API version ${versionId} not found`);
    }

    version.deprecatedAt = new Date().toISOString();
    if (sunsetAt) {
      version.sunsetAt = sunsetAt;
    }

    await this.updateApiVersionInDB(version);
  }

  private generateVersionId(): string {
    return `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateApiVersionId(): string {
    return `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeploymentId(): string {
    return `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveVersionToDB(version: ProductVersion): Promise<void> {
    // Implement database save logic
  }

  private async fetchProductVersionsFromDB(productId: string): Promise<ProductVersion[]> {
    // Implement database fetch logic
    return [];
  }

  private async updateVersionsInDB(versions: ProductVersion[]): Promise<void> {
    // Implement database update logic
  }

  private async saveApiVersionToDB(version: ApiVersion): Promise<void> {
    // Implement database save logic
  }

  private async updateApiVersionInDB(version: ApiVersion): Promise<void> {
    // Implement database update logic
  }

  private async createDeploymentRecord(deployment: Deployment): Promise<void> {
    // Implement database save logic
  }

  clearCache(productId?: string): void {
    if (productId) {
      this.productVersions.delete(productId);
    } else {
      this.productVersions.clear();
    }
  }
}
