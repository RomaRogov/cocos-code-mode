import { BaseAssetImporter } from './base-importer';
import { IAssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { TextureImporter } from './texture-importer';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';

export class AutoAtlasImporter extends BaseAssetImporter {
    name = 'auto-atlas';
    private textureImporter = new TextureImporter();

    async setProperty(assetInfo: IAssetInfo, path: string, value: any): Promise<boolean> {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        if (!meta || !meta.userData) return false;
        
        const userData = meta.userData;
        let handled = false;
        
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
        if (!userData) {
            throw new Error(`UserData not found for asset ${assetInfo.uuid}`);
        }

        return this.parseUserData(userData);
    }

    private parseUserData(userData: any): { [key: string]: IProperty } {
        const propertyContainer: { [key: string]: IProperty } = {};

        // Atlas Settings
        propertyContainer.maxWidth = { value: userData.maxWidth, type: 'Integer', displayName: 'Max Width' };
        propertyContainer.maxHeight = { value: userData.maxHeight, type: 'Integer', displayName: 'Max Height' };
        propertyContainer.padding = { value: userData.padding, type: 'Integer', displayName: 'Padding' };
        propertyContainer.allowRotation = { value: !!userData.allowRotation, type: 'Boolean', displayName: 'Allow Rotation' };
        propertyContainer.forceSquared = { value: !!userData.forceSquared, type: 'Boolean', displayName: 'Force Squared' };
        propertyContainer.powerOfTwo = { value: !!userData.powerOfTwo, type: 'Boolean', displayName: 'Power of Two' };
        
        propertyContainer.algorithm = { 
            value: userData.algorithm, 
            type: 'Enum', 
            enumList: [
                { name: 'MaxRects', value: 'MaxRects' },
                { name: 'Basic', value: 'Basic' }
            ],
            displayName: 'Algorithm' 
        };
        
        propertyContainer.format = { 
            value: userData.format, 
            type: 'Enum', 
            enumList: [
                { name: 'png', value: 'png' },
                { name: 'jpg', value: 'jpg' },
                { name: 'webp', value: 'webp' }
            ],
            displayName: 'Format' 
        };

        propertyContainer.quality = { 
            value: userData.quality, 
            type: 'Number', 
            displayName: 'Quality',
            visible: userData.format === 'jpg'
        };

        propertyContainer.contourBleed = { value: !!userData.contourBleed, type: 'Boolean', displayName: 'Contour Bleed' };
        propertyContainer.paddingBleed = { value: !!userData.paddingBleed, type: 'Boolean', displayName: 'Padding Bleed' };
        propertyContainer.filterUnused = { value: !!userData.filterUnused, type: 'Boolean', displayName: 'Filter Unused Resources' };

        // Texture Settings
        if (userData.textureSetting) {
             const textureProps = this.textureImporter.parseUserData(userData.textureSetting);
             Object.assign(propertyContainer, textureProps);
        }

        return propertyContainer;
    }
}
