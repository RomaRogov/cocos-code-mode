import { BaseAssetImporter } from './base-importer';
import { IAssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { TextureImporter } from './texture-importer';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';
import { TextureUtils } from '../texture-utils';

export class RenderTextureImporter extends BaseAssetImporter {
    name = 'render-texture';
    private textureImporter = new TextureImporter();

    async setProperty(assetInfo: IAssetInfo, path: string, value: any): Promise<boolean> {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        if (!meta || !meta.userData) return false;
        
        const userData = meta.userData;
        let handled = TextureUtils.applyProperties(userData, path, value);

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
        
        if (!meta) {
            throw new Error(`Asset meta not found for ${assetInfo.uuid}`);
        }

        const userData = meta.userData;
        if (!userData) {
            throw new Error(`UserData not found for asset ${assetInfo.uuid}`);
        }

        return this.parseUserData(userData, meta.subMetas);
    }

    private parseUserData(userData: any, subMetas: any): { [key: string]: IProperty } {
        const propertyContainer: { [key: string]: IProperty } = {};

        // Width & Height
        propertyContainer.width = {
            value: userData.width,
            type: 'Integer',
            displayName: 'Width'
        };
        propertyContainer.height = {
            value: userData.height,
            type: 'Integer',
            displayName: 'Height'
        };

        // Texture properties
        const textureProps = this.textureImporter.parseUserData(userData);
        Object.assign(propertyContainer, textureProps);

        // SpriteFrame UUID from subMetas
        if (subMetas) {
            const spriteFrameSubMeta = Object.values(subMetas).find((sm: any) => sm.importer === 'sprite-frame');
            if (spriteFrameSubMeta) {
                 propertyContainer.spriteFrame = {
                    value: { uuid: (spriteFrameSubMeta as any).uuid },
                    type: 'cc.SpriteFrame',
                    displayName: 'Sprite Frame',
                    readonly: true
                };
            }
        }

        return propertyContainer;
    }
}
