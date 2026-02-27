import { BaseAssetImporter } from './base-importer';
import { IAssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';

export class SpriteFrameImporter extends BaseAssetImporter {
    name = 'sprite-frame';

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
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        const userData = meta?.userData;

        if (!userData) {
            throw new Error(`UserData not found for asset ${assetInfo.uuid}`);
        }
        
        return this.parseUserData(userData);
    }

    public parseUserData(userData: { [index: string]: any; }): { [key: string]: IProperty } {
        const propertyContainer: { [key: string]: IProperty } = {};

        // Basic properties
        propertyContainer.packable = {
            value: userData.packable,
            type: 'Boolean',
            displayName: 'Packable',
        };
        propertyContainer.rotated = {
            value: userData.rotated,
            type: 'Boolean',
            displayName: 'Rotated',
            readonly: true
        };
        propertyContainer.offsetX = {
            value: userData.offsetX,
            type: 'Number',
            displayName: 'Offset X',
            readonly: true
        };
        propertyContainer.offsetY = {
            value: userData.offsetY,
            type: 'Number',
            displayName: 'Offset Y',
            readonly: true
        };

        // Trim
        propertyContainer.trimType = {
            value: userData.trimType,
            type: 'Enum',
            enumList: ['auto', 'custom', 'none'].map(k => ({ name: k, value: k })),
            displayName: 'Trim Type'
        };
        propertyContainer.trimThreshold = {
            value: userData.trimThreshold,
            type: 'Number',
            displayName: 'Trim Threshold'
        };
        propertyContainer.trimX = {
            value: userData.trimX,
            type: 'Number',
            displayName: 'Trim X'
        };
        propertyContainer.trimY = {
            value: userData.trimY,
            type: 'Number',
            displayName: 'Trim Y'
        };
        propertyContainer.width = {
            value: userData.width,
            type: 'Number',
            displayName: 'Width'
        };
        propertyContainer.height = {
            value: userData.height,
            type: 'Number',
            displayName: 'Height'
        };

        // Borders
        propertyContainer.borderTop = {
            value: userData.borderTop,
            type: 'Number',
            displayName: 'Border Top'
        };
        propertyContainer.borderBottom = {
            value: userData.borderBottom,
            type: 'Number',
            displayName: 'Border Bottom'
        };
        propertyContainer.borderLeft = {
            value: userData.borderLeft,
            type: 'Number',
            displayName: 'Border Left'
        };
        propertyContainer.borderRight = {
            value: userData.borderRight,
            type: 'Number',
            displayName: 'Border Right'
        };

        propertyContainer.pixelsToUnit = {
            value: userData.pixelsToUnit,
            type: 'Number',
            displayName: 'Pixels To Unit'
        };
        propertyContainer.pivotX = {
            value: userData.pivotX,
            type: 'Number',
            displayName: 'Pivot X'
        };
        propertyContainer.pivotY = {
            value: userData.pivotY,
            type: 'Number',
            displayName: 'Pivot Y'
        };

        return propertyContainer;
    }

}
