export interface SoftDeleteEntity {
  id: string;
  status: 'active' | 'deleted' | 'archived';
  deletedAt?: Date;
  deletedBy?: string;
  deleteReason?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface RecoveryOptions {
  restoreAsVersion?: number;
  mergeWithCurrent?: boolean;
  restoreRelations?: boolean;
}

export interface DeleteAudit {
  entityId: string;
  entityType: string;
  deletedBy: string;
  deletedAt: Date;
  deleteReason?: string;
  snapshotBeforeDelete: any;
  restoredAt?: Date;
  restoredBy?: string;
}

export class SoftDeleteManager {
  private static instance: SoftDeleteManager;
  private auditLog: DeleteAudit[] = [];
  private snapshots: Map<string, any> = new Map();

  static getInstance(): SoftDeleteManager {
    if (!SoftDeleteManager.instance) {
      SoftDeleteManager.instance = new SoftDeleteManager();
    }
    return SoftDeleteManager.instance;
  }

  async softDelete(
    entity: SoftDeleteEntity,
    deletedBy: string,
    reason?: string
  ): Promise<SoftDeleteEntity> {
    // Create snapshot before deletion
    const snapshot = JSON.parse(JSON.stringify(entity));
    this.snapshots.set(entity.id, snapshot);

    // Update entity
    entity.status = 'deleted';
    entity.deletedAt = new Date();
    entity.deletedBy = deletedBy;
    entity.deleteReason = reason;
    entity.updatedAt = new Date();
    entity.version += 1;

    // Create audit log
    const audit: DeleteAudit = {
      entityId: entity.id,
      entityType: this.getEntityType(entity),
      deletedBy,
      deletedAt: new Date(),
      deleteReason: reason,
      snapshotBeforeDelete: snapshot,
    };

    this.auditLog.push(audit);
    await this.saveAuditToDB(audit);
    await this.saveEntityToDB(entity);

    return entity;
  }

  async restore(
    entityId: string,
    restoredBy: string,
    options: RecoveryOptions = {}
  ): Promise<SoftDeleteEntity> {
    const snapshot = this.snapshots.get(entityId);
    if (!snapshot) {
      throw new Error(`No snapshot found for entity ${entityId}`);
    }

    const entity = await this.fetchEntityFromDB(entityId);
    if (!entity) {
      throw new Error(`Entity ${entityId} not found`);
    }

    if (entity.status !== 'deleted') {
      throw new Error(`Entity ${entityId} is not deleted`);
    }

    // Restore entity
    const restoredEntity: SoftDeleteEntity = {
      ...snapshot,
      status: 'active',
      deletedAt: undefined,
      deletedBy: undefined,
      deleteReason: undefined,
      updatedAt: new Date(),
      version: entity.version + 1,
    };

    // Handle version restoration
    if (options.restoreAsVersion) {
      const versionSnapshot = await this.getVersionSnapshot(entityId, options.restoreAsVersion);
      if (versionSnapshot) {
        Object.assign(restoredEntity, versionSnapshot, {
          id: entityId,
          status: 'active',
          updatedAt: new Date(),
          version: entity.version + 1,
        });
      }
    }

    // Handle merging
    if (options.mergeWithCurrent) {
      const currentData = await this.getCurrentEntityData(entityId);
      Object.assign(restoredEntity, this.mergeEntities(snapshot, currentData));
    }

    await this.saveEntityToDB(restoredEntity);

    // Update audit log
    const audit = this.auditLog.find(a => a.entityId === entityId && !a.restoredAt);
    if (audit) {
      audit.restoredAt = new Date();
      audit.restoredBy = restoredBy;
      await this.updateAuditInDB(audit);
    }

    // Restore relations if requested
    if (options.restoreRelations) {
      await this.restoreEntityRelations(entityId, restoredBy);
    }

    return restoredEntity;
  }

  async archive(entityId: string, archivedBy: string): Promise<SoftDeleteEntity> {
    const entity = await this.fetchEntityFromDB(entityId);
    if (!entity) {
      throw new Error(`Entity ${entityId} not found`);
    }

    entity.status = 'archived';
    entity.updatedAt = new Date();
    entity.version += 1;

    await this.saveEntityToDB(entity);
    return entity;
  }

  async getDeletedEntities(
    entityType?: string,
    limit?: number,
    offset?: number
  ): Promise<SoftDeleteEntity[]> {
    // Implement database query for deleted entities
    return [];
  }

  async getAuditLog(
    entityId?: string,
    entityType?: string,
    limit?: number
  ): Promise<DeleteAudit[]> {
    let audits = [...this.auditLog];

    if (entityId) {
      audits = audits.filter(a => a.entityId === entityId);
    }
    if (entityType) {
      audits = audits.filter(a => a.entityType === entityType);
    }

    // Sort by deletion date (newest first)
    audits.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

    if (limit) {
      audits = audits.slice(0, limit);
    }

    return audits;
  }

  async canRestore(entityId: string, userId: string): Promise<boolean> {
    const entity = await this.fetchEntityFromDB(entityId);
    if (!entity || entity.status !== 'deleted') {
      return false;
    }

    // Check if user has permission to restore
    // This would integrate with the permission system
    return true;
  }

  async permanentDelete(entityId: string, deletedBy: string, reason?: string): Promise<void> {
    const entity = await this.fetchEntityFromDB(entityId);
    if (!entity) {
      throw new Error(`Entity ${entityId} not found`);
    }

    if (entity.status !== 'deleted') {
      throw new Error(`Entity ${entityId} must be deleted before permanent removal`);
    }

    // Create final audit entry
    const audit: DeleteAudit = {
      entityId,
      entityType: this.getEntityType(entity),
      deletedBy,
      deletedAt: new Date(),
      deleteReason: reason || 'Permanent deletion',
      snapshotBeforeDelete: this.snapshots.get(entityId),
    };

    // Delete from database
    await this.permanentDeleteFromDB(entityId);
    
    // Clean up snapshots
    this.snapshots.delete(entityId);
    
    // Update audit log
    this.auditLog.push(audit);
    await this.saveAuditToDB(audit);
  }

  async bulkSoftDelete(
    entities: SoftDeleteEntity[],
    deletedBy: string,
    reason?: string
  ): Promise<SoftDeleteEntity[]> {
    const results: SoftDeleteEntity[] = [];
    
    for (const entity of entities) {
      try {
        const result = await this.softDelete(entity, deletedBy, reason);
        results.push(result);
      } catch (error) {
        console.error(`Failed to delete entity ${entity.id}:`, error);
        // Continue with other entities
      }
    }
    
    return results;
  }

  async bulkRestore(
    entityIds: string[],
    restoredBy: string,
    options: RecoveryOptions = {}
  ): Promise<SoftDeleteEntity[]> {
    const results: SoftDeleteEntity[] = [];
    
    for (const entityId of entityIds) {
      try {
        const result = await this.restore(entityId, restoredBy, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to restore entity ${entityId}:`, error);
        // Continue with other entities
      }
    }
    
    return results;
  }

  async getDeletedCount(entityType?: string): Promise<number> {
    // Implement database count query
    return 0;
  }

  async cleanupOldSnapshots(daysOld: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [entityId, snapshot] of this.snapshots) {
      const audit = this.auditLog.find(a => a.entityId === entityId);
      if (audit && audit.deletedAt < cutoff && audit.restoredAt) {
        this.snapshots.delete(entityId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  private getEntityType(entity: SoftDeleteEntity): string {
    // This should be implemented based on your entity structure
    return entity.constructor.name;
  }

  private mergeEntities(original: any, current: any): any {
    // Implement intelligent merging logic
    // For now, return current (newer) data
    return current;
  }

  private async getVersionSnapshot(entityId: string, version: number): Promise<any> {
    // Implement version snapshot retrieval
    return null;
  }

  private async getCurrentEntityData(entityId: string): Promise<any> {
    // Implement current entity data retrieval
    return {};
  }

  private async restoreEntityRelations(entityId: string, restoredBy: string): Promise<void> {
    // Implement relation restoration logic
  }

  private async saveEntityToDB(entity: SoftDeleteEntity): Promise<void> {
    // Implement database save logic
  }

  private async fetchEntityFromDB(entityId: string): Promise<SoftDeleteEntity | null> {
    // Implement database fetch logic
    return null;
  }

  private async saveAuditToDB(audit: DeleteAudit): Promise<void> {
    // Implement database save logic
  }

  private async updateAuditInDB(audit: DeleteAudit): Promise<void> {
    // Implement database update logic
  }

  private async permanentDeleteFromDB(entityId: string): Promise<void> {
    // Implement permanent deletion from database
  }

  clearCache(): void {
    this.snapshots.clear();
    this.auditLog = [];
  }
}

// Middleware for automatic soft delete handling
export function withSoftDelete<T extends SoftDeleteEntity>(entity: T): T {
  return {
    ...entity,
    status: entity.status || 'active',
    deletedAt: entity.deletedAt,
    deletedBy: entity.deletedBy,
    deleteReason: entity.deleteReason,
    version: entity.version || 1,
  };
}

// Query helper for filtering out deleted entities
export function filterActiveEntities<T extends SoftDeleteEntity>(entities: T[]): T[] {
  return entities.filter(entity => entity.status === 'active');
}

// Query helper for getting only deleted entities
export function filterDeletedEntities<T extends SoftDeleteEntity>(entities: T[]): T[] {
  return entities.filter(entity => entity.status === 'deleted');
}

// Query helper for getting archived entities
export function filterArchivedEntities<T extends SoftDeleteEntity>(entities: T[]): T[] {
  return entities.filter(entity => entity.status === 'archived');
}
