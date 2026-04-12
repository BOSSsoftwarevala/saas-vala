import { aiIntegrationManager, AIProvider } from './ai-integrations';

// Core interfaces for the AI Software Factory
export interface AppRequirement {
  appType: 'ERP' | 'CRM' | 'Marketplace' | 'Tool' | 'SaaS' | 'Dashboard' | 'Portal';
  features: string[];
  userRoles: string[];
  description: string;
  complexity: 'simple' | 'medium' | 'complex';
}

export interface ProjectPlan {
  id: string;
  name: string;
  description: string;
  appType: AppRequirement['appType'];
  modules: Module[];
  pages: Page[];
  userRoles: Role[];
  database: DatabaseSchema;
  apis: APIEndpoint[];
  generatedAt: Date;
  status: 'planning' | 'generating' | 'testing' | 'deployed' | 'failed';
}

export interface Module {
  id: string;
  name: string;
  description: string;
  features: string[];
  dependencies: string[];
  component: string;
  routes: string[];
}

export interface Page {
  id: string;
  name: string;
  path: string;
  component: string;
  layout: string;
  permissions: string[];
  features: string[];
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  dashboard: string;
  access: string[];
}

export interface DatabaseSchema {
  tables: Table[];
  relationships: Relationship[];
}

export interface Table {
  name: string;
  columns: Column[];
  primaryKey: string;
  indexes: Index[];
}

export interface Column {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'text' | 'uuid';
  nullable: boolean;
  unique: boolean;
  defaultValue?: any;
  foreignKey?: string;
}

export interface Relationship {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  foreignKey: string;
}

export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface APIEndpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  controller: string;
  middleware: string[];
  permissions: string[];
  validation: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'string' | 'number' | 'email' | 'min' | 'max';
  value?: any;
}

export interface GeneratedCode {
  frontend: {
    components: Record<string, string>;
    pages: Record<string, string>;
    hooks: Record<string, string>;
    utils: Record<string, string>;
  };
  backend: {
    controllers: Record<string, string>;
    models: Record<string, string>;
    routes: Record<string, string>;
    middleware: Record<string, string>;
    services: Record<string, string>;
  };
  database: {
    schema: string;
    migrations: string[];
    seeds: string[];
  };
  config: {
    package: string;
    env: string;
    docker: string;
    deploy: string;
  };
}

export interface TestResult {
  passed: boolean;
  tests: TestCase[];
  coverage: number;
  errors: string[];
}

export interface TestCase {
  name: string;
  type: 'unit' | 'integration' | 'e2e';
  passed: boolean;
  error?: string;
  duration: number;
}

export interface DeploymentResult {
  success: boolean;
  url?: string;
  apkUrl?: string;
  demoUrl?: string;
  productId?: string;
  errors: string[];
  logs: string[];
}

export class AISoftwareFactory {
  private static instance: AISoftwareFactory;
  private currentProject: ProjectPlan | null = null;
  private generatedCode: GeneratedCode | null = null;
  private buildLogs: string[] = [];
  private testResults: TestResult | null = null;
  private deploymentResult: DeploymentResult | null = null;

  static getInstance(): AISoftwareFactory {
    if (!AISoftwareFactory.instance) {
      AISoftwareFactory.instance = new AISoftwareFactory();
    }
    return AISoftwareFactory.instance;
  }

  // 1. INPUT SYSTEM
  async processInput(input: string, inputType: 'text' | 'voice' = 'text'): Promise<string> {
    this.addLog(`Processing ${inputType} input: ${input.substring(0, 100)}...`);
    
    try {
      if (inputType === 'voice') {
        // Convert voice to text using ElevenLabs or OpenAI STT
        const text = await this.voiceToText(input);
        this.addLog(`Voice converted to text: ${text.substring(0, 100)}...`);
        return text;
      }
      return input;
    } catch (error) {
      this.addLog(`Input processing failed: ${error.message}`);
      throw error;
    }
  }

  private async voiceToText(audioData: string): Promise<string> {
    try {
      // Try ElevenLabs first (primary)
      const response = await aiIntegrationManager.generateText('openai', 
        `Transcribe the following audio data: ${audioData}`, 
        { model: 'whisper-1' }
      );
      return response.content;
    } catch (error) {
      // Fallback to OpenAI STT
      this.addLog('ElevenLabs failed, using OpenAI STT fallback');
      const response = await aiIntegrationManager.generateText('openai', 
        `Transcribe: ${audioData}`, 
        { model: 'whisper-1' }
      );
      return response.content;
    }
  }

  // 2. INTENT ANALYSIS ENGINE
  async analyzeIntent(input: string): Promise<AppRequirement> {
    this.addLog('Analyzing user intent...');
    
    const prompt = `
Analyze the following user request and extract structured requirements:

User Input: "${input}"

Return a JSON object with:
{
  "appType": "ERP|CRM|Marketplace|Tool|SaaS|Dashboard|Portal",
  "features": ["feature1", "feature2", ...],
  "userRoles": ["role1", "role2", ...],
  "description": "Clear description of what the app does",
  "complexity": "simple|medium|complex"
}

Common app types:
- ERP: Enterprise Resource Planning (inventory, finance, HR)
- CRM: Customer Relationship Management (contacts, sales, support)
- Marketplace: Multi-vendor selling platform
- Tool: Utility or productivity application
- SaaS: Subscription-based software service
- Dashboard: Analytics and monitoring interface
- Portal: Information and access gateway

Focus on core functionality and be specific about features and roles.`;

    try {
      const response = await aiIntegrationManager.generateText('openai', prompt, {
        model: 'gpt-4-turbo',
        temperature: 0.3
      });

      const requirements = JSON.parse(response.content) as AppRequirement;
      this.addLog(`Intent analyzed: ${requirements.appType} with ${requirements.features.length} features`);
      return requirements;
    } catch (error) {
      this.addLog(`Intent analysis failed: ${error.message}`);
      throw new Error('Failed to analyze user intent');
    }
  }

  // 3. PROJECT PLANNER
  async createProjectPlan(requirements: AppRequirement): Promise<ProjectPlan> {
    this.addLog('Creating project plan...');
    
    const prompt = `
Create a detailed project plan for a ${requirements.appType} application with the following requirements:
- Features: ${requirements.features.join(', ')}
- User Roles: ${requirements.userRoles.join(', ')}
- Description: ${requirements.description}

Generate a comprehensive JSON plan with:
{
  "name": "App Name",
  "description": "Detailed app description",
  "modules": [
    {
      "id": "module1",
      "name": "Module Name",
      "description": "What this module does",
      "features": ["feature1", "feature2"],
      "dependencies": ["module2"],
      "component": "ModuleComponent",
      "routes": ["/route1", "/route2"]
    }
  ],
  "pages": [
    {
      "id": "page1",
      "name": "Page Name",
      "path": "/path",
      "component": "PageComponent",
      "layout": "default",
      "permissions": ["role1"],
      "features": ["feature1"]
    }
  ],
  "userRoles": [
    {
      "id": "role1",
      "name": "Role Name",
      "permissions": ["perm1", "perm2"],
      "dashboard": "/dashboard",
      "access": ["/page1", "/page2"]
    }
  ],
  "database": {
    "tables": [
      {
        "name": "table_name",
        "columns": [
          {
            "name": "column_name",
            "type": "string|number|boolean|date|json|text|uuid",
            "nullable": false,
            "unique": false,
            "defaultValue": "default_value"
          }
        ],
        "primaryKey": "id",
        "indexes": [
          {
            "name": "index_name",
            "columns": ["column1"],
            "unique": false
          }
        ]
      }
    ],
    "relationships": [
      {
        "from": "table1",
        "to": "table2",
        "type": "one-to-many",
        "foreignKey": "table2_id"
      }
    ]
  },
  "apis": [
    {
      "id": "api1",
      "path": "/api/endpoint",
      "method": "GET|POST|PUT|DELETE",
      "description": "What this API does",
      "controller": "ControllerName",
      "middleware": ["auth", "validation"],
      "permissions": ["role1"],
      "validation": [
        {
          "field": "field_name",
          "type": "required|string|number",
          "value": "constraint"
        }
      ]
    }
  ]
}

Include standard tables: users, roles, permissions, user_roles, audit_logs
Include standard pages: login, register, dashboard, profile, settings
Include standard APIs: auth, users, roles, permissions

Make sure all relationships are properly defined and all routes are connected.`;

    try {
      const response = await aiIntegrationManager.generateText('openai', prompt, {
        model: 'gpt-4-turbo',
        temperature: 0.2,
        maxTokens: 8000
      });

      const planData = JSON.parse(response.content);
      const projectPlan: ProjectPlan = {
        id: `project-${Date.now()}`,
        ...planData,
        appType: requirements.appType,
        generatedAt: new Date(),
        status: 'planning'
      };

      this.currentProject = projectPlan;
      this.addLog(`Project plan created: ${projectPlan.modules.length} modules, ${projectPlan.pages.length} pages`);
      return projectPlan;
    } catch (error) {
      this.addLog(`Project planning failed: ${error.message}`);
      throw new Error('Failed to create project plan');
    }
  }

  // 4. CODE GENERATION ENGINE
  async generateCode(projectPlan: ProjectPlan): Promise<GeneratedCode> {
    this.addLog('Starting code generation...');
    this.currentProject = { ...projectPlan, status: 'generating' };

    try {
      const generatedCode: GeneratedCode = {
        frontend: await this.generateFrontend(projectPlan),
        backend: await this.generateBackend(projectPlan),
        database: await this.generateDatabase(projectPlan),
        config: await this.generateConfig(projectPlan)
      };

      this.generatedCode = generatedCode;
      this.addLog('Code generation completed');
      return generatedCode;
    } catch (error) {
      this.addLog(`Code generation failed: ${error.message}`);
      this.currentProject = { ...projectPlan, status: 'failed' };
      throw error;
    }
  }

  private async generateFrontend(projectPlan: ProjectPlan) {
    this.addLog('Generating frontend code...');
    
    const frontend = {
      components: {} as Record<string, string>,
      pages: {} as Record<string, string>,
      hooks: {} as Record<string, string>,
      utils: {} as Record<string, string>
    };

    // Generate components for each module
    for (const module of projectPlan.modules) {
      const componentCode = await this.generateModuleComponent(module);
      frontend.components[module.component] = componentCode;
    }

    // Generate pages
    for (const page of projectPlan.pages) {
      const pageCode = await this.generatePageComponent(page, projectPlan);
      frontend.pages[page.component] = pageCode;
    }

    // Generate hooks
    frontend.hooks = await this.generateHooks(projectPlan);
    
    // Generate utils
    frontend.utils = await this.generateUtils(projectPlan);

    return frontend;
  }

  private async generateBackend(projectPlan: ProjectPlan) {
    this.addLog('Generating backend code...');
    
    const backend = {
      controllers: {} as Record<string, string>,
      models: {} as Record<string, string>,
      routes: {} as Record<string, string>,
      middleware: {} as Record<string, string>,
      services: {} as Record<string, string>
    };

    // Generate controllers for APIs
    for (const api of projectPlan.apis) {
      const controllerCode = await this.generateController(api, projectPlan);
      backend.controllers[api.controller] = controllerCode;
    }

    // Generate models for database tables
    for (const table of projectPlan.database.tables) {
      const modelCode = await this.generateModel(table, projectPlan);
      backend.models[table.name] = modelCode;
    }

    // Generate routes
    backend.routes = await this.generateRoutes(projectPlan);
    
    // Generate middleware
    backend.middleware = await this.generateMiddleware(projectPlan);
    
    // Generate services
    backend.services = await this.generateServices(projectPlan);

    return backend;
  }

  private async generateDatabase(projectPlan: ProjectPlan) {
    this.addLog('Generating database schema...');
    
    const schema = this.generatePrismaSchema(projectPlan.database);
    const migrations = await this.generateMigrations(projectPlan.database);
    const seeds = await this.generateSeeds(projectPlan.database);

    return {
      schema,
      migrations,
      seeds
    };
  }

  private async generateConfig(projectPlan: ProjectPlan) {
    this.addLog('Generating configuration files...');
    
    return {
      package: await this.generatePackageJson(projectPlan),
      env: await this.generateEnvFile(projectPlan),
      docker: await this.generateDockerfile(projectPlan),
      deploy: await this.generateDeployConfig(projectPlan)
    };
  }

  // Helper methods for code generation
  private async generateModuleComponent(module: Module): Promise<string> {
    const prompt = `Generate a React TypeScript component for a module called "${module.name}" with features: ${module.features.join(', ')}. 

The component should:
- Use existing design system components (Card, Button, Input, etc.)
- Be fully functional and connected to state
- Include proper TypeScript types
- Handle loading and error states
- Be responsive and accessible

Return only the complete component code without explanations.`;

    const response = await aiIntegrationManager.generateCode('openai', prompt, {
      provider: 'openai',
      model: 'gpt-4-turbo',
      language: 'typescript',
      framework: 'react',
      includeTests: false,
      includeDocs: true
    });

    return response.content;
  }

  private async generatePageComponent(page: Page, projectPlan: ProjectPlan): Promise<string> {
    const pageFeatures = page.features.join(', ');
    const prompt = `Generate a React TypeScript page component for "${page.name}" at path "${page.path}" with features: ${pageFeatures}.

The page should:
- Use the existing dashboard layout
- Include proper routing and navigation
- Be fully functional with data integration
- Include role-based access control
- Use existing UI components
- Handle authentication and permissions

Return only the complete page component code.`;

    const response = await aiIntegrationManager.generateCode('openai', prompt, {
      provider: 'openai',
      model: 'gpt-4-turbo',
      language: 'typescript',
      framework: 'react',
      includeTests: false,
      includeDocs: true
    });

    return response.content;
  }

  private async generateHooks(projectPlan: ProjectPlan): Promise<Record<string, string>> {
    const hooks: Record<string, string> = {};
    
    // Generate auth hook
    hooks['useAuth'] = await this.generateAuthHook();
    
    // Generate API hooks
    hooks['useApi'] = await this.generateApiHook();
    
    // Generate data hooks for each module
    for (const module of projectPlan.modules) {
      hooks[`use${module.name}`] = await this.generateModuleHook(module);
    }

    return hooks;
  }

  private async generateUtils(projectPlan: ProjectPlan): Promise<Record<string, string>> {
    const utils: Record<string, string> = {};
    
    utils['api'] = await this.generateApiUtils();
    utils['validation'] = await this.generateValidationUtils();
    utils['constants'] = await this.generateConstants(projectPlan);
    utils['helpers'] = await this.generateHelperUtils();

    return utils;
  }

  private async generateController(api: APIEndpoint, projectPlan: ProjectPlan): Promise<string> {
    const prompt = `Generate a Node.js Express controller for API endpoint "${api.path}" (${api.method}) with description: ${api.description}.

The controller should:
- Use TypeScript with proper types
- Include validation middleware
- Handle errors properly
- Include authentication checks
- Connect to database models
- Return proper JSON responses
- Include logging

Return only the complete controller code.`;

    const response = await aiIntegrationManager.generateCode('openai', prompt, {
      provider: 'openai',
      model: 'gpt-4-turbo',
      language: 'typescript',
      framework: 'express',
      includeTests: true,
      includeDocs: true
    });

    return response.content;
  }

  private async generateModel(table: Table, projectPlan: ProjectPlan): Promise<string> {
    const prompt = `Generate a Prisma model for table "${table.name}" with columns: ${JSON.stringify(table.columns, null, 2)}.

The model should:
- Use proper Prisma schema syntax
- Include all relationships
- Have proper field types
- Include default values
- Be properly formatted

Return only the complete Prisma model code.`;

    const response = await aiIntegrationManager.generateCode('openai', prompt, {
      provider: 'openai',
      model: 'gpt-4-turbo',
      language: 'typescript',
      framework: 'prisma',
      includeTests: false,
      includeDocs: true
    });

    return response.content;
  }

  private async generateRoutes(projectPlan: ProjectPlan): Promise<Record<string, string>> {
    const routes: Record<string, string> = {};
    
    for (const api of projectPlan.apis) {
      const routeKey = `${api.method.toLowerCase()}_${api.path.replace(/\//g, '_')}`;
      routes[routeKey] = await this.generateRoute(api);
    }

    return routes;
  }

  private async generateRoute(api: APIEndpoint): Promise<string> {
    const prompt = `Generate an Express.js route for ${api.method} ${api.path} with controller: ${api.controller}.

The route should:
- Use proper Express router syntax
- Include all middleware
- Handle validation
- Include authentication
- Connect to controller
- Handle errors

Return only the complete route code.`;

    const response = await aiIntegrationManager.generateCode('openai', prompt, {
      provider: 'openai',
      model: 'gpt-4-turbo',
      language: 'typescript',
      framework: 'express',
      includeTests: false,
      includeDocs: true
    });

    return response.content;
  }

  private async generateMiddleware(projectPlan: ProjectPlan): Promise<Record<string, string>> {
    const middleware: Record<string, string> = {};
    
    middleware['auth'] = await this.generateAuthMiddleware();
    middleware['validation'] = await this.generateValidationMiddleware();
    middleware['error'] = await this.generateErrorMiddleware();
    middleware['logging'] = await this.generateLoggingMiddleware();

    return middleware;
  }

  private async generateServices(projectPlan: ProjectPlan): Promise<Record<string, string>> {
    const services: Record<string, string> = {};
    
    services['database'] = await this.generateDatabaseService();
    services['email'] = await this.generateEmailService();
    services['storage'] = await this.generateStorageService();
    services['cache'] = await this.generateCacheService();

    return services;
  }

  private generatePrismaSchema(database: DatabaseSchema): string {
    let schema = `// Generated Prisma Schema\n\n`;
    
    for (const table of database.tables) {
      schema += `model ${table.name.charAt(0).toUpperCase() + table.name.slice(1)} {\n`;
      
      for (const column of table.columns) {
        let field = `  ${column.name} `;
        
        // Map types to Prisma types
        const typeMap: Record<string, string> = {
          'string': 'String',
          'number': 'Int',
          'boolean': 'Boolean',
          'date': 'DateTime',
          'json': 'Json',
          'text': 'String',
          'uuid': 'String'
        };
        
        field += typeMap[column.type] || 'String';
        
        if (!column.nullable) field += ' @default(autoincrement())';
        if (column.unique) field += ' @unique';
        if (column.defaultValue) field += ` @default(${column.defaultValue})`;
        if (column.foreignKey) field += ` @relation(fields: [${column.foreignKey}], references: [id])`;
        
        schema += field + '\n';
      }
      
      schema += '}\n\n';
    }
    
    return schema;
  }

  private async generateMigrations(database: DatabaseSchema): Promise<string[]> {
    // Generate migration files for each table
    const migrations: string[] = [];
    
    for (const table of database.tables) {
      const migration = await this.generateTableMigration(table);
      migrations.push(migration);
    }
    
    return migrations;
  }

  private async generateTableMigration(table: Table): Promise<string> {
    const prompt = `Generate a Prisma migration SQL for creating table "${table.name}" with columns: ${JSON.stringify(table.columns, null, 2)}.

Return only the complete SQL migration code.`;

    const response = await aiIntegrationManager.generateCode('openai', prompt, {
      provider: 'openai',
      model: 'gpt-4-turbo',
      language: 'sql',
      framework: 'postgresql',
      includeTests: false,
      includeDocs: false
    });

    return response.content;
  }

  private async generateSeeds(database: DatabaseSchema): Promise<string[]> {
    // Generate seed data for tables
    const seeds: string[] = [];
    
    for (const table of database.tables) {
      if (['users', 'roles', 'permissions'].includes(table.name)) {
        const seed = await this.generateTableSeed(table);
        seeds.push(seed);
      }
    }
    
    return seeds;
  }

  private async generateTableSeed(table: Table): Promise<string> {
    const prompt = `Generate Prisma seed data for table "${table.name}" with realistic sample data.

Return only the complete seed code.`;

    const response = await aiIntegrationManager.generateCode('openai', prompt, {
      provider: 'openai',
      model: 'gpt-4-turbo',
      language: 'typescript',
      framework: 'prisma',
      includeTests: false,
      includeDocs: false
    });

    return response.content;
  }

  private async generatePackageJson(projectPlan: ProjectPlan): Promise<string> {
    const packageJson = {
      name: projectPlan.name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: projectPlan.description,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        test: 'jest',
        'test:watch': 'jest --watch',
        lint: 'eslint . --ext .ts,.tsx',
        'db:generate': 'prisma generate',
        'db:push': 'prisma db push',
        'db:migrate': 'prisma migrate dev',
        'db:seed': 'tsx prisma/seed.ts'
      },
      dependencies: {
        next: '^14.0.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        typescript: '^5.0.0',
        '@prisma/client': '^5.0.0',
        prisma: '^5.0.0',
        express: '^4.18.0',
        cors: '^2.8.5',
        helmet: '^7.0.0',
        bcryptjs: '^2.4.3',
        jsonwebtoken: '^9.0.0',
        joi: '^17.9.0',
        nodemailer: '^6.9.0',
        multer: '^1.4.5',
        'aws-sdk': '^2.1400.0'
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@types/express': '^4.17.0',
        '@types/cors': '^2.8.0',
        '@types/bcryptjs': '^2.4.0',
        '@types/jsonwebtoken': '^9.0.0',
        '@types/nodemailer': '^6.4.0',
        '@types/multer': '^1.4.0',
        eslint: '^8.0.0',
        jest: '^29.0.0',
        tsx: '^3.12.0'
      }
    };

    return JSON.stringify(packageJson, null, 2);
  }

  private async generateEnvFile(projectPlan: ProjectPlan): Promise<string> {
    return `# Database
DATABASE_URL="postgresql://username:password@localhost:5432/${projectPlan.name.toLowerCase().replace(/\s+/g, '_')}"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# AWS
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-s3-bucket"

# Next.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"

# App
NODE_ENV="development"
PORT=3000
API_URL="http://localhost:3001"
`;
  }

  private async generateDockerfile(projectPlan: ProjectPlan): Promise<string> {
    return `# Multi-stage build for ${projectPlan.name}
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
`;
  }

  private async generateDeployConfig(projectPlan: ProjectPlan): Promise<string> {
    return `# Deployment configuration for ${projectPlan.name}

version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}
      - JWT_SECRET=\${JWT_SECRET}
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=${projectPlan.name.toLowerCase().replace(/\s+/g, '_')}
      - POSTGRES_USER=\${DB_USER}
      - POSTGRES_PASSWORD=\${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app

volumes:
  postgres_data:
`;
  }

  // Additional helper methods (simplified for brevity)
  private async generateAuthHook(): Promise<string> {
    // Generate authentication hook
    return `import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const userData = await response.json();
      setUser(userData);
      router.push('/dashboard');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout');
    setUser(null);
    router.push('/login');
  };

  return { user, loading, login, logout };
}`;
  }

  private async generateApiHook(): Promise<string> {
    return `import { useState, useCallback } from 'react';

interface UseApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (url: string, options: UseApiOptions = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        throw new Error(\`API Error: \${response.status}\`);
      }

      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { request, loading, error };
}`;
  }

  private async generateModuleHook(module: Module): Promise<string> {
    return `import { useState, useEffect } from 'react';
import { useApi } from './useApi';

interface ${module.name}Data {
  id: string;
  // Add specific fields based on module
}

export function use${module.name}() {
  const [data, setData] = useState<${module.name}Data[]>([]);
  const [loading, setLoading] = useState(true);
  const { request } = useApi();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const result = await request('/api/${module.name.toLowerCase()}');
      setData(result);
    } catch (error) {
      console.error('Failed to fetch ${module.name.toLowerCase()}:', error);
    } finally {
      setLoading(false);
    }
  };

  const create = async (item: Partial<${module.name}Data>) => {
    const result = await request('/api/${module.name.toLowerCase()}', {
      method: 'POST',
      body: item,
    });
    setData(prev => [...prev, result]);
    return result;
  };

  const update = async (id: string, item: Partial<${module.name}Data>) => {
    const result = await request(\`/api/${module.name.toLowerCase()}/\${id}\`, {
      method: 'PUT',
      body: item,
    });
    setData(prev => prev.map(item => item.id === id ? result : item));
    return result;
  };

  const remove = async (id: string) => {
    await request(\`/api/${module.name.toLowerCase()}/\${id}\`, {
      method: 'DELETE',
    });
    setData(prev => prev.filter(item => item.id !== id));
  };

  return { data, loading, create, update, remove, refetch: fetchData };
}`;
  }

  private async generateApiUtils(): Promise<string> {
    return `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = \`\${this.baseURL}\${endpoint}\`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(\`API Error: \${response.status} \${response.statusText}\`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();`;
  }

  private async generateValidationUtils(): Promise<string> {
    return `import Joi from 'joi';

export const validationSchemas = {
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(50).required(),
  phone: Joi.string().pattern(/^[+]?[1-9]\d{1,14}$/).optional(),
};

export const validateInput = <T>(
  schema: Joi.ObjectSchema<T>,
  data: unknown
): { error?: string; value?: T } => {
  const { error, value } = schema.validate(data);
  if (error) {
    return { error: error.details[0].message };
  }
  return { value };
};

export const validateRequired = (value: any, fieldName: string): string | null => {
  if (!value || value.toString().trim() === '') {
    return \`\${fieldName} is required\`;
  }
  return null;
};

export const validateEmail = (email: string): string | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};`;
  }

  private async generateConstants(projectPlan: ProjectPlan): Promise<string> {
    return `export const APP_CONFIG = {
  name: '${projectPlan.name}',
  description: '${projectPlan.description}',
  version: '1.0.0',
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  ${projectPlan.pages.map(page => `${page.name.toUpperCase()}: '${page.path}',`).join('\n  ')}
};

export const ROLES = {
  ${projectPlan.userRoles.map(role => `${role.name.toUpperCase()}: '${role.id}',`).join('\n  ')}
};

export const PERMISSIONS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  ADMIN: 'admin',
};

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
  },
  ${projectPlan.apis.map(api => `${api.id.toUpperCase()}: '${api.path}',`).join('\n  ')}
};`;
  }

  private async generateHelperUtils(): Promise<string> {
    return `export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};`;
  }

  private async generateAuthMiddleware(): Promise<string> {
    return `import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    req.user = user as any;
    next();
  });
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};`;
  }

  private async generateValidationMiddleware(): Promise<string> {
    return `import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => detail.message),
      });
      return;
    }
    
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      res.status(400).json({
        error: 'Query validation failed',
        details: error.details.map(detail => detail.message),
      });
      return;
    }
    
    next();
  };
};`;
  }

  private async generateErrorMiddleware(): Promise<string> {
    return `import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      message: err.message,
    });
    return;
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication credentials',
    });
    return;
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message,
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response
): void => {
  res.status(404).json({
    error: 'Not Found',
    message: \`Route \${req.originalUrl} not found\`,
  });
};`;
  }

  private async generateLoggingMiddleware(): Promise<string> {
    return `import { Request, Response, NextFunction } from 'express';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const timestamp = new Date().toISOString();
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || '';

  console.log(\`[\${timestamp}] \${method} \${url} - \${ip} - \${userAgent}\`);

  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(\`[\${timestamp}] \${method} \${url} - \${statusCode} - \${duration}ms\`);
  });

  next();
};`;
  }

  private async generateDatabaseService(): Promise<string> {
    return `import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
};

export const connectDatabase = async (): Promise<void> => {
  try {
    const client = getPrismaClient();
    await client.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('Database disconnected');
  } catch (error) {
    console.error('Database disconnection error:', error);
  }
};`;
  }

  private async generateEmailService(): Promise<string> {
    return `import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        ...options,
      });
      console.log(\`Email sent to \${options.to}\`);
    } catch (error) {
      console.error('Email sending failed:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to our platform!',
      html: \`<h1>Welcome, \${name}!</h1><p>Thank you for joining our platform.</p>\`,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html: \`<p>Click <a href="\${process.env.NEXTAUTH_URL}/reset-password?token=\${resetToken}">here</a> to reset your password.</p>\`,
    });
  }
}

export const emailService = new EmailService();`;
  }

  private async generateStorageService(): Promise<string> {
    return `import AWS from 'aws-sdk';
import { Readable } from 'stream';

interface UploadOptions {
  bucket: string;
  key: string;
  body: Buffer | Readable;
  contentType: string;
  metadata?: Record<string, string>;
}

class StorageService {
  private s3: AWS.S3;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
  }

  async upload(options: UploadOptions): Promise<string> {
    try {
      const result = await this.s3.upload({
        Bucket: options.bucket,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType,
        Metadata: options.metadata,
      }).promise();

      return result.Location;
    } catch (error) {
      console.error('S3 upload failed:', error);
      throw error;
    }
  }

  async delete(bucket: string, key: string): Promise<void> {
    try {
      await this.s3.deleteObject({
        Bucket: bucket,
        Key: key,
      }).promise();
    } catch (error) {
      console.error('S3 delete failed:', error);
      throw error;
    }
  }

  getSignedUrl(bucket: string, key: string, expiresIn = 3600): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: key,
      Expires: expiresIn,
    });
  }
}

export const storageService = new StorageService();`;
  }

  private async generateCacheService(): Promise<string> {
    return `import Redis from 'ioredis';

class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
  }

  async set(key: string, value: any, ttl = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async flush(): Promise<void> {
    await this.redis.flushall();
  }
}

export const cacheService = new CacheService();`;
  }
}

export const aiSoftwareFactory = AISoftwareFactory.getInstance();
