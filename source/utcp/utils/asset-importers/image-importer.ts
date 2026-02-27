import { BaseAssetImporter } from './base-importer';
import { TextureImporter } from './texture-importer';
import { SpriteFrameImporter } from './sprite-frame-importer';
import { ErpTextureCubeImporter } from './erp-texture-cube-importer';
import { IAssetInfo, IAssetMeta } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';
import { TextureUtils } from '../texture-utils';

export class ImageImporter extends BaseAssetImporter {
    name = 'image';

    private textureImporter = new TextureImporter();
    private spriteFrameImporter = new SpriteFrameImporter();
    private erpTextureCubeImporter = new ErpTextureCubeImporter();

    async setProperty(assetInfo: IAssetInfo, path: string, value: any): Promise<boolean> {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        if (!meta) return false;

        const userData = meta.userData;
        let handled = false;

        // Top level properties
        if (['type', 'flipVertical', 'fixAlphaTransparencyArtifacts', 'flipGreenChannel', 'isRGBE'].includes(path)) {
            userData[path] = value;
            handled = true;
        } 
        // Sub-asset delegation
        else if (path.startsWith('texture.') || path.startsWith('spriteFrame.')) {
            const [prefix, ...rest] = path.split('.');
            const subPath = rest.join('.');
            let targetImporter = '';
            
            switch (prefix) {
                case 'texture':
                    targetImporter = 'texture';
                    break;
                case 'spriteFrame':
                    targetImporter = 'sprite-frame';
                    break;
                case 'textureCube':
                    targetImporter = 'erp-texture-cube';
                    break;
            }

            if (targetImporter && meta.subMetas) {
                const subMetaKey = Object.keys(meta.subMetas).find(key => meta.subMetas[key].importer === targetImporter);
                if (subMetaKey) {
                    const subUserData = meta.subMetas[subMetaKey].userData;
                    
                    let syntheticHandled = false;
                    if (targetImporter === 'texture') {
                        syntheticHandled = TextureUtils.applyProperties(subUserData, subPath, value);
                    }

                    if (!syntheticHandled) {
                        if (subPath.includes('.')) {
                            // deep set
                            const parts = subPath.split('.');
                            let current = subUserData;
                            for (let i = 0; i < parts.length - 1; i++) {
                                current = current[parts[i]];
                            }
                            if (current) current[parts[parts.length - 1]] = value;
                        } else {
                            subUserData[subPath] = value;
                        }
                    }
                    handled = true;
                }
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
            throw new Error('Asset meta not found');
        }

        return await this.inspectImageAsset(meta);
    }

    private async inspectImageAsset(meta: IAssetMeta): Promise<{ [key: string]: IProperty }> {
        const propertyContainer: { [key: string]: IProperty } = {};

        // Type
        propertyContainer['type'] = {
            type: 'Enum',
            value: meta.userData.type || 'texture',
            enumList: [
                { name: 'raw', value: 'raw' },
                { name: 'texture', value: 'texture' },
                { name: 'normal-map', value: 'normal map' },
                { name: 'sprite-frame', value: 'sprite-frame' },
                { name: 'texture-cube', value: 'texture cube' }
            ],
            displayName: 'Type',
            visible: true
        };

        // Flip Vertical
        propertyContainer['flipVertical'] = {
            type: 'Boolean',
            value: !!meta.userData.flipVertical,
            displayName: 'Flip Vertical',
            visible: true
        };

        // Fix Alpha Transparency Artifacts
        propertyContainer['fixAlphaTransparencyArtifacts'] = {
            type: 'Boolean',
            value: !!meta.userData.fixAlphaTransparencyArtifacts,
            displayName: 'Fix Alpha Transparency Artifacts',
            visible: meta.userData.type !== 'normal map'
        };

        // Flip Green Channel
        propertyContainer['flipGreenChannel'] = {
            type: 'Boolean',
            value: !!meta.userData.flipGreenChannel,
            displayName: 'Flip Green Channel',
            visible: true
        };

        // Is RGBE
        propertyContainer['isRGBE'] = {
            type: 'Boolean',
            value: !!meta.userData.isRGBE,
            displayName: 'Is RGBE',
            visible: meta.userData.type === 'texture cube'
        };

        // Sub-assets inspection
        const subMetas = meta.subMetas || {};
        
        // Determine which importers to use based on type
        const type = meta.userData.type || 'texture';
        
        if (type === 'texture' || type === 'normal map' || type === 'sprite-frame') {
            propertyContainer['texture'] = {
                value: this.textureImporter.parseUserData(Object.values(subMetas).find(sm => sm.importer === 'texture')?.userData || {}),
                type: 'cc.Object',
                displayName: 'Texture Properties'
            };

            if (type === 'sprite-frame') {
                propertyContainer['spriteFrame'] = {
                    value: this.spriteFrameImporter.parseUserData(Object.values(subMetas).find(sm => sm.importer === 'sprite-frame')?.userData || {}),
                    type: 'cc.Object',
                    displayName: 'Sprite Frame Properties'
                };
            }
        } else if (type === 'texture cube') {
            propertyContainer['textureCube'] = {
                value: this.erpTextureCubeImporter.parseUserData(Object.values(subMetas).find(sm => sm.importer === 'erp-texture-cube')?.userData || {}),
                type: 'cc.Object',
                displayName: 'Texture Cube Properties'
            };
        }

        return propertyContainer;
    }
}
