import { BaseAssetImporter } from './base-importer';
import { IAssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';
import * as fs from 'fs';

export class ScriptImporter extends BaseAssetImporter {
    name = 'typescript';

    async getProperties(assetInfo: IAssetInfo): Promise<{ [key: string]: IPropertyValueType }> {
        const filePath = assetInfo.file;
        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error(`File not found for asset ${assetInfo.uuid}`);
        }

        try {
            // Limit to 400 lines or 20000 chars, similar to engine inspector
            const content = fs.readFileSync(filePath, 'utf-8');
            const MAX_CHARS = 20000;
            const MAX_LINES = 400;
            
            let truncated = false;
            let finalContent = content;

            if (finalContent.length > MAX_CHARS) {
                finalContent = finalContent.substring(0, MAX_CHARS);
                truncated = true;
            }

            const lines = finalContent.split('\n');
            if (lines.length > MAX_LINES) {
                finalContent = lines.slice(0, MAX_LINES).join('\n');
                truncated = true;
            }

            if (truncated) {
                finalContent += '\n... (truncated)';
            }

            return this.parseUserData(finalContent, this.name);
        } catch (e) {
            return {
                error: {
                    type: 'String',
                    value: 'Failed to read script file: ' + e,
                    displayName: 'Error',
                    readonly: true
                }
            };
        }
    }

    public parseUserData(content: string, language: string): { [key: string]: IProperty } {
        return {
            content: {
                value: content,
                type: 'String',
                displayName: 'Content',
                readonly: true
            },
            language: {
                value: language,
                type: 'String',
                displayName: 'Language',
                readonly: true
            }
        };
    }
}
