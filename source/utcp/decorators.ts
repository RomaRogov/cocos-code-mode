import { HttpCallTemplate } from '@utcp/http';
import { JsonSchema, Tool } from '@utcp/sdk';

export interface ToolMetadata {
    method: Function;
    target: any;
    tool: Tool;
}

export class ToolRegistry {
    private static tools: Map<string, ToolMetadata> = new Map();

    static register(options: ToolMetadata) {
        this.tools.set(options.tool.name, options);
    }

    static getTools() {
        return Array.from(this.tools.values());
    }
}

export function utcpTool(name: string, description: string, inputs: JsonSchema, outputs: JsonSchema, httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', tags: string[] = []) {
    return function (target: any, propertyKey: string, descriptor?: PropertyDescriptor) {
        if (!descriptor) return;

        ToolRegistry.register({
            method: descriptor.value,
            target,
            tool: {
                name,
                description,
                inputs,
                outputs,
                tags,
                tool_call_template: {
                    call_template_type: "http",
                    http_method: httpMethod,
                    request_body_format: "json",
                    url: `/tools/${name}`,
                    content_type: "application/json"
                } as HttpCallTemplate,
            }
        });
    };
}
