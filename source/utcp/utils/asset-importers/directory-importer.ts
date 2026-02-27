import { BaseAssetImporter } from './base-importer';
import { IAssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';

export class DirectoryImporter extends BaseAssetImporter {
    name = 'directory';

    async setProperty(assetInfo: IAssetInfo, path: string, value: any): Promise<boolean> {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        if (!meta) return false;
        
        // Ensure userData exists
        if (!meta.userData) meta.userData = {};
        const userData = meta.userData;
        
        let handled = false;
        
        if (path.includes('.')) {
            const parts = path.split('.');
            let current = userData;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) current[parts[i]] = {}; // Create object if missing
                current = current[parts[i]];
            }
            if (current) {
                current[parts[parts.length - 1]] = value;
                handled = true;
            }
        } else {
            userData[path] = value;
            handled = true;
        }
        
        if (handled) {
            await Editor.Message.request('asset-db', 'save-asset-meta', assetInfo.uuid, JSON.stringify(meta));
            return true;
        }
        return false;
    }

    async getProperties(assetInfo: IAssetInfo): Promise<{ [key: string]: IPropertyValueType }> {
        const assetMeta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        
        if (!assetMeta) {
            throw new Error(`Asset meta not found for ${assetInfo.uuid}`);
        }

        const userData = assetMeta.userData;
        // Directory might not have userData if it's not a bundle, but let's handle it gracefully
        return this.parseUserData(userData || {});
    }

    private parseUserData(userData: any): { [key: string]: IProperty } {
        const propertyContainer: { [key: string]: IProperty } = {};

        propertyContainer.isBundle = {
            value: !!userData.isBundle,
            type: 'Boolean',
            displayName: 'Is Bundle'
        };

        if (userData.isBundle) {
            propertyContainer.bundleName = {
                value: userData.bundleName,
                type: 'String',
                displayName: 'Bundle Name'
            };

            propertyContainer.priority = {
                value: userData.priority,
                type: 'Integer',
                displayName: 'Priority'
            };
            
            // Some bundles might have compression settings, but we only saw these in the sample
            if (userData.compressionType !== undefined) {
                 propertyContainer.compressionType = {
                    value: userData.compressionType,
                    type: 'Enum', // Assuming enum
                    enumList: [
                        { name: 'None', value: 'none' },
                        { name: 'Merge Depend', value: 'merge_dep' },
                        { name: 'Zip', value: 'zip' },
                        { name: 'Zip High Compression', value: 'zip_high' },
                        { name: 'Zip Store', value: 'zip_store' }
                    ],
                    displayName: 'Compression Type'
                };
            }
            
            if (userData.target !== undefined) {
                 propertyContainer.target = {
                    value: userData.target,
                    type: 'String', // Could be array of strings (platforms)
                    displayName: 'Target Platform'
                };
            }
        }

        return propertyContainer;
    }
}
