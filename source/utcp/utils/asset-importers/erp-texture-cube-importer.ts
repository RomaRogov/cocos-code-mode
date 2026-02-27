import { BaseAssetImporter } from './base-importer';
import { TextureUtils } from '../texture-utils';
import { IAssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';

export class ErpTextureCubeImporter extends BaseAssetImporter {
    name = 'erp-texture-cube';

    async setProperty(assetInfo: IAssetInfo, path: string, value: any): Promise<boolean> {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        if (!meta || !meta.userData) return false;
        
        const userData = meta.userData;
        let handled = false;

        if (TextureUtils.applyProperties(userData, path, value)) {
            handled = true;
        }
        
        if (!handled) {
            if (path.includes('.')) {
                const parts = path.split('.');
                let current = userData;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) return false;
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
        }
        
        if (handled) {
            await Editor.Message.request('asset-db', 'save-asset-meta', assetInfo.uuid, JSON.stringify(meta));
            return true;
        }
        return false;
    }

    async getProperties(assetInfo: IAssetInfo): Promise<{ [key: string]: IPropertyValueType }> {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        const userData = meta?.userData;

        if (!userData) {
            throw new Error(`UserData not found for asset ${assetInfo.uuid}`);
        }

        return this.parseUserData(userData);
    }

    public parseUserData(userData: { [index: string]: any; }): { [key: string]: IProperty } {
        const propertyContainer: { [key: string]: IProperty } = {};

        propertyContainer.anisotropy = {
            value: userData.anisotropy,
            type: 'Number',
            displayName: 'Anisotropy'
        };
        propertyContainer.faceSize = {
            value: userData.faceSize,
            type: 'Number',
            displayName: 'Face Size'
        };

        // Texture Utils (Filter/Wrap)
        TextureUtils.injectTextureProperties(userData, propertyContainer);

        propertyContainer.generateMipmaps = {
            value: userData.mipfilter !== 'none',
            type: 'Boolean',
            displayName: 'Generate Mipmaps'
        };

        propertyContainer.mipBakeMode = {
            value: userData.mipBakeMode,
            type: 'Boolean',
            displayName: 'Mip Bake Mode'
        };

        return propertyContainer;
    }
}
