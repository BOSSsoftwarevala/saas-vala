import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { UltraNotificationSystem } from './notification-system';
import { Message, User, Workspace } from './slack-system';
import * as crypto from 'crypto';

export interface Language {
  code: string; // ISO 639-1 code (e.g., 'en', 'es', 'fr')
  name: string; // English name (e.g., 'English', 'Spanish', 'French')
  nativeName: string; // Native name (e.g., 'English', 'Español', 'Français')
  direction: 'ltr' | 'rtl';
  isActive: boolean;
  isDefault: boolean;
  supportedByAI: boolean;
  flag: string; // emoji flag
  createdAt: Date;
  updatedAt: Date;
}

export interface Translation {
  id: string;
  workspaceId: string;
  languageCode: string;
  key: string;
  value: string;
  context?: string;
  pluralForms?: Record<string, string>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranslationRequest {
  id: string;
  workspaceId: string;
  messageId?: string;
  content: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  translatedContent?: string;
  confidence?: number; // 0-1
  provider: 'google' | 'azure' | 'aws' | 'openai' | 'deepl';
  cost?: number; // in credits
  processingTime?: number; // milliseconds
  metadata: {
    autoTranslate?: boolean;
    userRequested?: boolean;
    batchId?: string;
  };
  createdAt: Date;
  completedAt?: Date;
}

export interface LanguageDetection {
  id: string;
  content: string;
  detectedLanguage: string;
  confidence: number; // 0-1
  provider: 'google' | 'azure' | 'aws' | 'openai';
  alternatives: Array<{
    language: string;
    confidence: number;
  }>;
  createdAt: Date;
}

export interface UserLanguagePreference {
  id: string;
  userId: string;
  workspaceId: string;
  primaryLanguage: string;
  secondaryLanguages: string[];
  autoTranslate: boolean;
  showOriginal: boolean;
  translationProvider: TranslationRequest['provider'];
  createdAt: Date;
  updatedAt: Date;
}

export interface MultiLanguageAnalytics {
  workspaceId: string;
  date: Date;
  totalTranslations: number;
  translationsByLanguage: Record<string, number>;
  translationsByProvider: Record<string, number>;
  averageConfidence: number;
  totalCost: number;
  languageDetections: number;
  topLanguagePairs: Array<{
    source: string;
    target: string;
    count: number;
  }>;
  userLanguageDistribution: Record<string, number>;
  autoTranslationRate: number; // percentage
  errorRate: number; // percentage
}

export class UltraMultiLanguage extends EventEmitter {
  private static instance: UltraMultiLanguage;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private notificationSystem: UltraNotificationSystem;
  
  private languages: Map<string, Language> = new Map(); // code -> language
  private translations: Map<string, Map<string, Map<string, Translation>>> = new Map(); // workspaceId -> languageCode -> key -> translation
  private userPreferences: Map<string, UserLanguagePreference> = new Map(); // userId -> preference
  private translationCache: Map<string, TranslationRequest> = new Map(); // cache key -> request
  private detectionCache: Map<string, LanguageDetection> = new Map(); // content hash -> detection

  static getInstance(): UltraMultiLanguage {
    if (!UltraMultiLanguage.instance) {
      UltraMultiLanguage.instance = new UltraMultiLanguage();
    }
    return UltraMultiLanguage.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadLanguages();
      await this.loadTranslations();
      await this.loadUserPreferences();
      this.startCacheCleanup();
      
      this.logger.info('multi-language', 'Multi-language system initialized', {
        languagesCount: this.languages.size,
        translationsCount: Array.from(this.translations.values()).reduce((sum, langMap) => sum + langMap.size, 0),
        userPreferencesCount: this.userPreferences.size
      });
    } catch (error) {
      this.logger.error('multi-language', 'Failed to initialize multi-language system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS languages (
        code VARCHAR(10) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        native_name VARCHAR(100) NOT NULL,
        direction VARCHAR(3) NOT NULL DEFAULT 'ltr',
        is_active BOOLEAN DEFAULT TRUE,
        is_default BOOLEAN DEFAULT FALSE,
        supported_by_ai BOOLEAN DEFAULT TRUE,
        flag VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS translations (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        key VARCHAR(255) NOT NULL,
        value TEXT NOT NULL,
        context VARCHAR(255),
        plural_forms JSONB,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, language_code, key)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS translation_requests (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255),
        content TEXT NOT NULL,
        source_language VARCHAR(10) NOT NULL,
        target_language VARCHAR(10) NOT NULL,
        status VARCHAR(20) NOT NULL,
        translated_content TEXT,
        confidence DECIMAL(3,2),
        provider VARCHAR(20) NOT NULL,
        cost DECIMAL(10,4),
        processing_time INTEGER,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS language_detections (
        id VARCHAR(255) PRIMARY KEY,
        content TEXT NOT NULL,
        detected_language VARCHAR(10) NOT NULL,
        confidence DECIMAL(3,2) NOT NULL,
        provider VARCHAR(20) NOT NULL,
        alternatives JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS user_language_preferences (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        primary_language VARCHAR(10) NOT NULL,
        secondary_languages TEXT[] NOT NULL,
        auto_translate BOOLEAN DEFAULT TRUE,
        show_original BOOLEAN DEFAULT FALSE,
        translation_provider VARCHAR(20) DEFAULT 'google',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, workspace_id)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS multi_language_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_translations INTEGER DEFAULT 0,
        translations_by_language JSONB NOT NULL,
        translations_by_provider JSONB NOT NULL,
        average_confidence DECIMAL(3,2),
        total_cost DECIMAL(10,4),
        language_detections INTEGER DEFAULT 0,
        top_language_pairs JSONB NOT NULL,
        user_language_distribution JSONB NOT NULL,
        auto_translation_rate DECIMAL(5,2),
        error_rate DECIMAL(5,2),
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_translations_workspace_id ON translations(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_translations_language_code ON translations(language_code)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_translation_requests_workspace_id ON translation_requests(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_translation_requests_status ON translation_requests(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_user_language_preferences_user_id ON user_language_preferences(user_id)');
  }

  private async loadLanguages(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM languages WHERE is_active = TRUE ORDER BY name');
      
      for (const row of rows) {
        const language: Language = {
          code: row.code,
          name: row.name,
          nativeName: row.native_name,
          direction: row.direction,
          isActive: row.is_active,
          isDefault: row.is_default,
          supportedByAI: row.supported_by_ai,
          flag: row.flag,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.languages.set(language.code, language);
      }
      
      this.logger.info('multi-language', `Loaded ${this.languages.size} languages`);
    } catch (error) {
      this.logger.error('multi-language', 'Failed to load languages', error as Error);
    }
  }

  private async loadTranslations(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM translations ORDER BY workspace_id, language_code, key');
      
      for (const row of rows) {
        const translation: Translation = {
          id: row.id,
          workspaceId: row.workspace_id,
          languageCode: row.language_code,
          key: row.key,
          value: row.value,
          context: row.context,
          pluralForms: row.plural_forms || {},
          metadata: row.metadata || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.translations.has(translation.workspaceId)) {
          this.translations.set(translation.workspaceId, new Map());
        }
        
        const workspaceTranslations = this.translations.get(translation.workspaceId)!;
        if (!workspaceTranslations.has(translation.languageCode)) {
          workspaceTranslations.set(translation.languageCode, new Map());
        }
        
        workspaceTranslations.get(translation.languageCode)!.set(translation.key, translation);
      }
      
      this.logger.info('multi-language', `Loaded translations for ${this.translations.size} workspaces`);
    } catch (error) {
      this.logger.error('multi-language', 'Failed to load translations', error as Error);
    }
  }

  private async loadUserPreferences(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM user_language_preferences ORDER BY updated_at DESC');
      
      for (const row of rows) {
        const preference: UserLanguagePreference = {
          id: row.id,
          userId: row.user_id,
          workspaceId: row.workspace_id,
          primaryLanguage: row.primary_language,
          secondaryLanguages: row.secondary_languages || [],
          autoTranslate: row.auto_translate,
          showOriginal: row.show_original,
          translationProvider: row.translation_provider,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.userPreferences.set(`${preference.userId}:${preference.workspaceId}`, preference);
      }
      
      this.logger.info('multi-language', `Loaded ${this.userPreferences.size} user language preferences`);
    } catch (error) {
      this.logger.error('multi-language', 'Failed to load user preferences', error as Error);
    }
  }

  private startCacheCleanup(): void {
    // Clean up caches every hour
    setInterval(() => {
      const now = Date.now();
      const cacheTimeout = 60 * 60 * 1000; // 1 hour
      
      for (const [key, request] of this.translationCache.entries()) {
        if (now - request.createdAt.getTime() > cacheTimeout) {
          this.translationCache.delete(key);
        }
      }
      
      for (const [key, detection] of this.detectionCache.entries()) {
        if (now - detection.createdAt.getTime() > cacheTimeout) {
          this.detectionCache.delete(key);
        }
      }
    }, 60 * 60 * 1000);
  }

  // PUBLIC API METHODS
  async addLanguage(config: {
    code: string;
    name: string;
    nativeName: string;
    direction?: 'ltr' | 'rtl';
    isActive?: boolean;
    isDefault?: boolean;
    supportedByAI?: boolean;
    flag: string;
  }): Promise<boolean> {
    try {
      const language: Language = {
        code: config.code,
        name: config.name,
        nativeName: config.nativeName,
        direction: config.direction || 'ltr',
        isActive: config.isActive !== false,
        isDefault: config.isDefault || false,
        supportedByAI: config.supportedByAI !== false,
        flag: config.flag,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO languages (
          code, name, native_name, direction, is_active, is_default, supported_by_ai, flag, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        native_name = EXCLUDED.native_name,
        direction = EXCLUDED.direction,
        is_active = EXCLUDED.is_active,
        is_default = EXCLUDED.is_default,
        supported_by_ai = EXCLUDED.supported_by_ai,
        flag = EXCLUDED.flag,
        updated_at = EXCLUDED.updated_at
      `, [
        language.code,
        language.name,
        language.nativeName,
        language.direction,
        language.isActive,
        language.isDefault,
        language.supportedByAI,
        language.flag,
        language.createdAt,
        language.updatedAt
      ]);
      
      this.languages.set(language.code, language);
      
      this.emit('languageAdded', language);
      return true;
      
    } catch (error) {
      this.logger.error('multi-language', `Failed to add language: ${config.code}`, error as Error);
      return false;
    }
  }

  async detectLanguage(content: string, provider: LanguageDetection['provider'] = 'google'): Promise<LanguageDetection> {
    try {
      const contentHash = this.hashContent(content);
      
      // Check cache first
      const cached = this.detectionCache.get(contentHash);
      if (cached && Date.now() - cached.createdAt.getTime() < 30 * 60 * 1000) { // 30 minutes cache
        return cached;
      }
      
      // Detect language (mock implementation)
      const detectedLanguage = await this.performLanguageDetection(content, provider);
      
      // Save to database
      await this.database.query(`
        INSERT INTO language_detections (
          id, content, detected_language, confidence, provider, alternatives, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        `detection-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
        content,
        detectedLanguage.detectedLanguage,
        detectedLanguage.confidence,
        detectedLanguage.provider,
        JSON.stringify(detectedLanguage.alternatives),
        detectedLanguage.createdAt
      ]);
      
      // Cache result
      this.detectionCache.set(contentHash, detectedLanguage);
      
      this.emit('languageDetected', detectedLanguage);
      return detectedLanguage;
      
    } catch (error) {
      this.logger.error('multi-language', 'Failed to detect language', error as Error);
      
      // Return fallback detection
      return {
        id: `fallback-${Date.now()}`,
        content,
        detectedLanguage: 'en',
        confidence: 0.5,
        provider,
        alternatives: [],
        createdAt: new Date()
      };
    }
  }

  async translateText(config: {
    workspaceId: string;
    content: string;
    sourceLanguage: string;
    targetLanguage: string;
    messageId?: string;
    provider?: TranslationRequest['provider'];
    autoTranslate?: boolean;
  }): Promise<TranslationRequest> {
    const requestId = `translation-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      // Check if source and target are the same
      if (config.sourceLanguage === config.targetLanguage) {
        const request: TranslationRequest = {
          id: requestId,
          workspaceId: config.workspaceId,
          messageId: config.messageId,
          content: config.content,
          sourceLanguage: config.sourceLanguage,
          targetLanguage: config.targetLanguage,
          status: 'completed',
          translatedContent: config.content,
          confidence: 1.0,
          provider: config.provider || 'google',
          cost: 0,
          processingTime: 0,
          metadata: {
            autoTranslate: config.autoTranslate || false,
            userRequested: !config.autoTranslate
          },
          createdAt: new Date(),
          completedAt: new Date()
        };
        
        return request;
      }
      
      // Check cache
      const cacheKey = this.generateTranslationCacheKey(config.content, config.sourceLanguage, config.targetLanguage);
      const cached = this.translationCache.get(cacheKey);
      if (cached && cached.status === 'completed') {
        return {
          ...cached,
          id: requestId,
          workspaceId: config.workspaceId,
          messageId: config.messageId,
          metadata: {
            ...cached.metadata,
            autoTranslate: config.autoTranslate || false,
            userRequested: !config.autoTranslate
          }
        };
      }
      
      // Create translation request
      const request: TranslationRequest = {
        id: requestId,
        workspaceId: config.workspaceId,
        messageId: config.messageId,
        content: config.content,
        sourceLanguage: config.sourceLanguage,
        targetLanguage: config.targetLanguage,
        status: 'pending',
        provider: config.provider || 'google',
        metadata: {
          autoTranslate: config.autoTranslate || false,
          userRequested: !config.autoTranslate
        },
        createdAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO translation_requests (
          id, workspace_id, message_id, content, source_language, target_language,
          status, provider, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        request.id,
        request.workspaceId,
        request.messageId,
        request.content,
        request.sourceLanguage,
        request.targetLanguage,
        request.status,
        request.provider,
        JSON.stringify(request.metadata),
        request.createdAt
      ]);
      
      // Process translation asynchronously
      this.processTranslation(requestId);
      
      return request;
      
    } catch (error) {
      this.logger.error('multi-language', `Failed to create translation request: ${requestId}`, error as Error);
      throw error;
    }
  }

  private async processTranslation(requestId: string): Promise<void> {
    try {
      // Update status to processing
      await this.database.query(
        'UPDATE translation_requests SET status = $1 WHERE id = $2',
        ['processing', requestId]
      );
      
      // Get request details
      const result = await this.database.query('SELECT * FROM translation_requests WHERE id = $1', [requestId]);
      if (result.rows.length === 0) return;
      
      const request: TranslationRequest = {
        ...result.rows[0],
        metadata: result.rows[0].metadata
      };
      
      const startTime = Date.now();
      
      // Perform translation (mock implementation)
      const translationResult = await this.performTranslation(
        request.content,
        request.sourceLanguage,
        request.targetLanguage,
        request.provider
      );
      
      const processingTime = Date.now() - startTime;
      
      // Update request with results
      await this.database.query(`
        UPDATE translation_requests SET
          status = $1,
          translated_content = $2,
          confidence = $3,
          cost = $4,
          processing_time = $5,
          completed_at = $6
        WHERE id = $7
      `, [
        'completed',
        translationResult.translatedContent,
        translationResult.confidence,
        translationResult.cost,
        processingTime,
        new Date(),
        requestId
      ]);
      
      // Update request object
      request.status = 'completed';
      request.translatedContent = translationResult.translatedContent;
      request.confidence = translationResult.confidence;
      request.cost = translationResult.cost;
      request.processingTime = processingTime;
      request.completedAt = new Date();
      
      // Cache result
      const cacheKey = this.generateTranslationCacheKey(request.content, request.sourceLanguage, request.targetLanguage);
      this.translationCache.set(cacheKey, request);
      
      this.emit('translationCompleted', request);
      
    } catch (error) {
      this.logger.error('multi-language', `Failed to process translation: ${requestId}`, error as Error);
      
      // Update status to failed
      await this.database.query(
        'UPDATE translation_requests SET status = $1 WHERE id = $2',
        ['failed', requestId]
      );
      
      this.emit('translationFailed', { requestId, error: error.message });
    }
  }

  async setUserLanguagePreference(config: {
    userId: string;
    workspaceId: string;
    primaryLanguage: string;
    secondaryLanguages?: string[];
    autoTranslate?: boolean;
    showOriginal?: boolean;
    translationProvider?: TranslationRequest['provider'];
  }): Promise<boolean> {
    try {
      const preferenceKey = `${config.userId}:${config.workspaceId}`;
      const existingPreference = this.userPreferences.get(preferenceKey);
      
      const preference: UserLanguagePreference = {
        id: existingPreference?.id || `pref-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
        userId: config.userId,
        workspaceId: config.workspaceId,
        primaryLanguage: config.primaryLanguage,
        secondaryLanguages: config.secondaryLanguages || [],
        autoTranslate: config.autoTranslate !== false,
        showOriginal: config.showOriginal || false,
        translationProvider: config.translationProvider || 'google',
        createdAt: existingPreference?.createdAt || new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO user_language_preferences (
          id, user_id, workspace_id, primary_language, secondary_languages,
          auto_translate, show_original, translation_provider, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id, workspace_id) DO UPDATE SET
        primary_language = EXCLUDED.primary_language,
        secondary_languages = EXCLUDED.secondary_languages,
        auto_translate = EXCLUDED.auto_translate,
        show_original = EXCLUDED.show_original,
        translation_provider = EXCLUDED.translation_provider,
        updated_at = EXCLUDED.updated_at
      `, [
        preference.id,
        preference.userId,
        preference.workspaceId,
        preference.primaryLanguage,
        preference.secondaryLanguages,
        preference.autoTranslate,
        preference.showOriginal,
        preference.translationProvider,
        preference.createdAt,
        preference.updatedAt
      ]);
      
      this.userPreferences.set(preferenceKey, preference);
      
      this.emit('userPreferenceUpdated', preference);
      return true;
      
    } catch (error) {
      this.logger.error('multi-language', 'Failed to set user language preference', error as Error);
      return false;
    }
  }

  async getTranslation(workspaceId: string, languageCode: string, key: string, context?: string): Promise<string | null> {
    try {
      const workspaceTranslations = this.translations.get(workspaceId);
      if (!workspaceTranslations) return null;
      
      const languageTranslations = workspaceTranslations.get(languageCode);
      if (!languageTranslations) return null;
      
      const translation = languageTranslations.get(key);
      if (!translation) return null;
      
      return translation.value;
      
    } catch (error) {
      this.logger.error('multi-language', 'Failed to get translation', error as Error);
      return null;
    }
  }

  async setTranslation(config: {
    workspaceId: string;
    languageCode: string;
    key: string;
    value: string;
    context?: string;
    pluralForms?: Record<string, string>;
    metadata?: Record<string, any>;
  }): Promise<boolean> {
    try {
      const translationId = `trans-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      const translation: Translation = {
        id: translationId,
        workspaceId: config.workspaceId,
        languageCode: config.languageCode,
        key: config.key,
        value: config.value,
        context: config.context,
        pluralForms: config.pluralForms || {},
        metadata: config.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO translations (
          id, workspace_id, language_code, key, value, context, plural_forms, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (workspace_id, language_code, key) DO UPDATE SET
        value = EXCLUDED.value,
        context = EXCLUDED.context,
        plural_forms = EXCLUDED.plural_forms,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
      `, [
        translation.id,
        translation.workspaceId,
        translation.languageCode,
        translation.key,
        translation.value,
        translation.context,
        JSON.stringify(translation.pluralForms),
        JSON.stringify(translation.metadata),
        translation.createdAt,
        translation.updatedAt
      ]);
      
      // Update cache
      if (!this.translations.has(config.workspaceId)) {
        this.translations.set(config.workspaceId, new Map());
      }
      
      const workspaceTranslations = this.translations.get(config.workspaceId)!;
      if (!workspaceTranslations.has(config.languageCode)) {
        workspaceTranslations.set(config.languageCode, new Map());
      }
      
      workspaceTranslations.get(config.languageCode)!.set(config.key, translation);
      
      this.emit('translationSet', translation);
      return true;
      
    } catch (error) {
      this.logger.error('multi-language', 'Failed to set translation', error as Error);
      return false;
    }
  }

  async getAvailableLanguages(): Promise<Language[]> {
    return Array.from(this.languages.values()).filter(lang => lang.isActive);
  }

  async getUserLanguagePreference(userId: string, workspaceId: string): Promise<UserLanguagePreference | null> {
    const preferenceKey = `${userId}:${workspaceId}`;
    return this.userPreferences.get(preferenceKey) || null;
  }

  async getTranslationStatus(requestId: string, workspaceId: string): Promise<TranslationRequest | null> {
    try {
      const result = await this.database.query(
        'SELECT * FROM translation_requests WHERE id = $1 AND workspace_id = $2',
        [requestId, workspaceId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        messageId: row.message_id,
        content: row.content,
        sourceLanguage: row.source_language,
        targetLanguage: row.target_language,
        status: row.status,
        translatedContent: row.translated_content,
        confidence: row.confidence ? parseFloat(row.confidence) : undefined,
        provider: row.provider,
        cost: row.cost ? parseFloat(row.cost) : undefined,
        processingTime: row.processing_time,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        completedAt: row.completed_at
      };
      
    } catch (error) {
      this.logger.error('multi-language', 'Failed to get translation status', error as Error);
      return null;
    }
  }

  async getAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<MultiLanguageAnalytics[]> {
    try {
      let sql = 'SELECT * FROM multi_language_analytics WHERE workspace_id = $1';
      const params: any[] = [workspaceId];
      
      if (dateRange) {
        sql += ' AND date >= $2 AND date <= $3';
        params.push(dateRange.start, dateRange.end);
      }
      
      sql += ' ORDER BY date DESC';
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        workspaceId: row.workspace_id,
        date: row.date,
        totalTranslations: row.total_translations,
        translationsByLanguage: row.translations_by_language || {},
        translationsByProvider: row.translations_by_provider || {},
        averageConfidence: parseFloat(row.average_confidence) || 0,
        totalCost: parseFloat(row.total_cost) || 0,
        languageDetections: row.language_detections,
        topLanguagePairs: row.top_language_pairs || [],
        userLanguageDistribution: row.user_language_distribution || {},
        autoTranslationRate: parseFloat(row.auto_translation_rate) || 0,
        errorRate: parseFloat(row.error_rate) || 0
      }));
      
    } catch (error) {
      this.logger.error('multi-language', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  // Helper methods
  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private generateTranslationCacheKey(content: string, sourceLanguage: string, targetLanguage: string): string {
    return `${this.hashContent(content)}:${sourceLanguage}:${targetLanguage}`;
  }

  private async performLanguageDetection(content: string, provider: LanguageDetection['provider']): Promise<LanguageDetection> {
    // Mock implementation - in production would integrate with actual language detection APIs
    const commonLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'];
    const randomLanguage = commonLanguages[Math.floor(Math.random() * commonLanguages.length)];
    
    return {
      id: `detection-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
      content,
      detectedLanguage: randomLanguage,
      confidence: 0.8 + Math.random() * 0.2,
      provider,
      alternatives: commonLanguages.slice(0, 3).map(lang => ({
        language: lang,
        confidence: Math.random()
      })),
      createdAt: new Date()
    };
  }

  private async performTranslation(
    content: string,
    sourceLanguage: string,
    targetLanguage: string,
    provider: TranslationRequest['provider']
  ): Promise<{
    translatedContent: string;
    confidence: number;
    cost: number;
  }> {
    // Mock implementation - in production would integrate with actual translation APIs
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400)); // Simulate API delay
    
    return {
      translatedContent: `[Translated from ${sourceLanguage} to ${targetLanguage}]: ${content}`,
      confidence: 0.7 + Math.random() * 0.3,
      cost: content.length * 0.0001 // Mock cost calculation
    };
  }

  async createDefaultLanguages(): Promise<void> {
    const defaultLanguages = [
      { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
      { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
      { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
      { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
      { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
      { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', direction: 'rtl' as const },
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' }
    ];
    
    for (const lang of defaultLanguages) {
      try {
        await this.addLanguage(lang);
      } catch (error) {
        this.logger.debug('multi-language', `Language ${lang.code} may already exist`);
      }
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    languagesCount: number;
    activeTranslationsCount: number;
    userPreferencesCount: number;
    cacheSize: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (this.languages.size === 0) {
      issues.push('No languages configured');
    }
    
    return {
      healthy: issues.length === 0,
      languagesCount: this.languages.size,
      activeTranslationsCount: this.translationCache.size,
      userPreferencesCount: this.userPreferences.size,
      cacheSize: this.translationCache.size + this.detectionCache.size,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.languages.clear();
    this.translations.clear();
    this.userPreferences.clear();
    this.translationCache.clear();
    this.detectionCache.clear();
    
    this.logger.info('multi-language', 'Multi-language system shut down');
  }
}

export default UltraMultiLanguage;
