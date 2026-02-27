import { BaseAssetImporter } from './base-importer';
import { IAssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';
import { TextureUtils } from '../texture-utils';

export class TextureImporter extends BaseAssetImporter {
    name = 'texture';

    async getProperties(assetInfo: IAssetInfo): Promise<{ [key: string]: IPropertyValueType }> {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        const userData = meta?.userData;

        if (!userData) {
            throw new Error(`UserData not found for asset ${assetInfo.uuid}`);
        }

        return this.parseUserData(userData);
    }


    async setProperty(assetInfo: IAssetInfo, path: string, value: any): Promise<boolean> {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        const userData = meta?.userData;

        if (!userData) {
            return false;
        }

        let handled = TextureUtils.applyProperties(userData, path, value);
        
        if (!handled) {
            // Default: direct assignment to userData
            // TODO: Support nested paths if needed (e.g. 'some.deep.prop')
            if (path.includes('.')) {
                // Simple dot notation support
                const parts = path.split('.');
                let current = userData;
                for (let i = 0; i < parts.length - 1; i++) {
                    current = current[parts[i]];
                    if (!current) return false; // Path doesn't exist
                }
                current[parts[parts.length - 1]] = value;
            } else {
                userData[path] = value;
            }
        }

        await Editor.Message.request('asset-db', 'save-asset-meta', assetInfo.uuid, JSON.stringify(meta));
        return true;
    }

    public parseUserData(userData: { [index: string]: any; }): { [key: string]: IProperty } {
        const propertyContainer: { [key: string]: IProperty } = {};

        TextureUtils.injectTextureProperties(userData, propertyContainer);

        // Generate Mipmaps
        propertyContainer.generateMipmaps = {
            value: userData.mipfilter !== 'none',
            type: 'Boolean',
            displayName: 'Generate Mipmaps'
        };

        return propertyContainer;
    }
}
