import express, { Request, Response } from 'express';
import cors from 'cors';
import { ToolRegistry } from './decorators';
import './tools/typescript-defenition';
import './tools/get-properties-tool';
import './tools/set-property-tool';
import './tools/asset-tools';
import './tools/component-tools';
import './tools/scene-tools';
import './tools/editor-tools';
import { registerAllImporters } from './utils/asset-importers';
import { Tool, UtcpManual } from '@utcp/sdk';
import { parse } from 'qs';

export class UtcpServerManager {
    private app: express.Application;
    private server: any;

    constructor() {
        this.app = express();
        registerAllImporters();
    }

    async start(port: number = 3000): Promise<number> {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.set("query parser", (queryString: string) =>
            parse(queryString, {
                decoder(value, defaultDecoder, charset, type) {
                    const decoded = defaultDecoder(value);

                    if (decoded === "true") return true;
                    if (decoded === "false") return false;

                    if (
                        typeof decoded === "string" &&
                        decoded !== "" &&
                        !Number.isNaN(Number(decoded))
                    ) {
                        return Number(decoded);
                    }

                    if (decoded === "__null__") return null;

                    return decoded;
                }
            })
        );

        const tools = ToolRegistry.getTools();
        const toolInstances = new Map<Function, any>();
        const utcpTools: Tool[] = [];

        let currentPort = port;

        // Let's listen first to get the port if it's 0
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, "127.0.0.1", () => {
                const addr = this.server.address();
                if (addr && typeof addr === 'object') {
                    currentPort = addr.port;
                }

                // Now register tools with the correct port
                this.registerTools(currentPort, tools, toolInstances, utcpTools);

                resolve(currentPort);
            });
            this.server.on('error', (err: any) => {
                reject(err);
            });
        });
    }

    private registerTools(port: number, tools: any[], toolInstances: Map<Function, any>, utcpTools: Tool[]) {
        const baseUrl = `http://localhost:${port}`;

        // Initialize tool instances and build UTCP definitions
        for (const toolMeta of tools) {
            const ToolClass = toolMeta.target.constructor;
            let instance = toolInstances.get(ToolClass);
            if (!instance) {
                instance = new ToolClass();
                toolInstances.set(ToolClass, instance);
            }

            const toolDef = JSON.parse(JSON.stringify(toolMeta.tool));
            const toolUrlPath = toolDef.tool_call_template.url;

            toolDef.tool_call_template.url = `${baseUrl}${toolUrlPath}`;

            utcpTools.push(toolDef);

            // Register specific endpoint
            const handler = async (req: Request, res: Response) => {
                try {
                    const args = req.query;

                    let result = await toolMeta.method.apply(instance, [args]);

                    if (result === undefined || result === null) {
                        res.json(null);
                        return;
                    }

                    res.json(result);

                } catch (err: any) {
                    console.error(`Error in tool ${toolDef.name}:`, err);
                    res.status(500).json({ error: err.message });
                }
            };

            switch (toolDef.tool_call_template.http_method) {
                case 'POST':
                    this.app.post(toolUrlPath, handler);
                    break;
                case 'GET':
                    this.app.get(toolUrlPath, handler);
                    break;
                case 'DELETE':
                    this.app.delete(toolUrlPath, handler);
                    break;
                case 'PUT':
                    this.app.put(toolUrlPath, handler);
                    break;
                default:
                // throw new Error(`Unsupported HTTP method: ${toolDef.tool_call_template.http_method}`);
            }
        }

        // Serve UTCP Manual
        this.app.get('/utcp', (req, res) => {
            const manual: UtcpManual = {
                utcp_version: "1.0.1",
                manual_version: "1.0.0",
                tools: utcpTools
            };
            res.json(manual);
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            console.log("UTCP Server stopped");
        }
    }
}
