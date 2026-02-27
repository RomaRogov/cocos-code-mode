import { readFileSync, writeFileSync, existsSync } from 'fs-extra';
import { join } from 'path';
import { homedir } from 'os';

// @ts-ignore
import packageJSON from '../../package.json';


export class UtcpConfigManager {
    private static instance: UtcpConfigManager;
    private configPath: string = '';

    private constructor() {}

    static getInstance(): UtcpConfigManager {
        if (!UtcpConfigManager.instance) {
            UtcpConfigManager.instance = new UtcpConfigManager();
        }
        return UtcpConfigManager.instance;
    }

    async initialize(): Promise<void> {
        const savedPath = await Editor.Profile.getConfig(packageJSON.name, 'utcpConfigPath');
        if (savedPath && typeof savedPath === 'string') {
            this.configPath = savedPath;
        } else {
            this.configPath = join(homedir(), '.utcp_config.json');
        }
        console.log(`[UtcpConfigManager] Initialized with config path: ${this.configPath}`);
    }

    getConfigPath(): string {
        if (!this.configPath) {
            this.configPath = join(homedir(), '.utcp_config.json');
        }
        return this.configPath;
    }

    async setConfigPath(path: string): Promise<void> {
        this.configPath = path;
        await Editor.Profile.setConfig(packageJSON.name, 'utcpConfigPath', path);
        console.log(`[UtcpConfigManager] Config path updated to: ${path}`);
    }

    readConfig(): any {
        const path = this.getConfigPath();
        if (path && existsSync(path)) {
            try {
                const content = readFileSync(path, 'utf-8');
                return JSON.parse(content);
            } catch (e) {
                console.error('[UtcpConfigManager] Failed to parse UTCP config:', e);
                return { manual_call_templates: [] };
            }
        }
        return { manual_call_templates: [] };
    }

    writeConfig(config: any): void {
        const path = this.getConfigPath();
        if (!path) {
            console.error('[UtcpConfigManager] Config path is not set');
            return;
        }
        try {
            writeFileSync(path, JSON.stringify(config, null, 2));
            console.log(`[UtcpConfigManager] Saved UTCP config to ${path}`);
        } catch (e) {
            console.error('[UtcpConfigManager] Failed to write UTCP config:', e);
        }
    }

    async ensureCocosEditorTemplate(port: number): Promise<boolean> {
        if (!port || port <= 0) {
            console.warn('[UtcpConfigManager] Invalid port provided:', port);
            return false;
        }

        const expectedUrl = `http://localhost:${port}/utcp`;
        const config = this.readConfig();

        if (!config.manual_call_templates) {
            config.manual_call_templates = [];
        }

        const templates = config.manual_call_templates;
        const idx = templates.findIndex((t: any) => t.name === 'CocosEditor');

        let changed = false;
        if (idx === -1) {
            templates.push({
                name: 'CocosEditor',
                call_template_type: 'http',
                url: expectedUrl,
                http_method: 'GET',
                content_type: 'application/json',
            });
            changed = true;
            console.log(`[UtcpConfigManager] Created CocosEditor template with port ${port}`);
        } else {
            if (templates[idx].url !== expectedUrl) {
                templates[idx].url = expectedUrl;
                changed = true;
                console.log(`[UtcpConfigManager] Updated CocosEditor template port to ${port}`);
            }
        }

        if (changed) {
            this.writeConfig(config);
        }

        return changed;
    }

    async getCurrentPort(): Promise<number> {
        const port = await Editor.Profile.getConfig(packageJSON.name, 'serverPort');
        return typeof port === 'number' ? port : 0;
    }

    async updatePort(port: number): Promise<void> {
        await Editor.Profile.setConfig(packageJSON.name, 'serverPort', port);
        await this.ensureCocosEditorTemplate(port);
    }
}

export function getConfigManager(): UtcpConfigManager {
    return UtcpConfigManager.getInstance();
}
