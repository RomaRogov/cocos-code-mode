import packageJSON from '../package.json';
import { UtcpServerManager } from './utcp/utcp-server';
import { getConfigManager } from './utcp/config-manager';

let utcpServer: UtcpServerManager | null = null;


export const methods: { [key: string]: (...any: any) => any } = {

    openPanel() {
        Editor.Panel.open(packageJSON.name + '.configuration');
    },

    openPreviewPanel() {
        Editor.Panel.open(packageJSON.name + '.preview');
    },


    async restartServer(newPort: number) {
        if (utcpServer) {
            console.log(`[${packageJSON.name}] Restarting UTCP Server on port ${newPort}...`);
            utcpServer.stop();
            try {
                const actualPort = await utcpServer.start(newPort);
                console.log(`[${packageJSON.name}] UTCP Server restarted on port ${actualPort}`);
                
                // Используем менеджер конфигурации для обновления порта
                const configManager = getConfigManager();
                await configManager.updatePort(actualPort);
            } catch (err) {
                console.error(`[${packageJSON.name}] Failed to restart UTCP Server:`, err);
            }
        }
    }
};

export async function load() {
    // Initialize config manager
    const configManager = getConfigManager();
    await configManager.initialize();
    
    utcpServer = new UtcpServerManager();

    let wasConfiguredPort = true;
    // Load port from profile, default to 0 (random free port) if not set
    let port = await Editor.Profile.getConfig(packageJSON.name, 'serverPort');
    if (typeof port !== 'number') {
        port = 0;
        wasConfiguredPort = false;
    }

    try {
        const actualPort = await utcpServer.start(port);
        console.log(`[${packageJSON.name}] UTCP Server started on port ${actualPort}`);
        
        // Automatically update the port in the configuration on startup
        await configManager.updatePort(actualPort);
        console.log(`[${packageJSON.name}] UTCP config automatically updated with port ${actualPort}`);
    } catch (err) {
        console.error(`[${packageJSON.name}] Failed to start UTCP Server:`, err);
    }

    if (!wasConfiguredPort) {
        Editor.Panel.open(packageJSON.name);
    }
}

export function unload() {
    if (utcpServer) {
        console.log(`[${packageJSON.name}] Stopping UTCP Server...`);
        utcpServer.stop();
        utcpServer = null;
    }
}
