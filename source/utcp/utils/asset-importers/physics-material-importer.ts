import { BaseAssetImporter } from './base-importer';
import { IAssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';

export class PhysicsMaterialImporter extends BaseAssetImporter {
    name = 'physics-material';

    async getProperties(assetInfo: IAssetInfo): Promise<{ [key: string]: IPropertyValueType }> {
        const materialMeta = await Editor.Message.request('scene', 'query-physics-material', assetInfo.uuid);
        
        if (!materialMeta) {
            throw new Error(`Physics material meta not found for ${assetInfo.uuid}`);
        }

        return materialMeta;
    }

    async setProperty(assetInfo: IAssetInfo, path: string, value: any): Promise<boolean> {
        let materialMeta = await Editor.Message.request('scene', 'query-physics-material', assetInfo.uuid);
        if (!materialMeta) {
            return false;
        }

        // Apply change
        if (path.includes('.')) {
            const parts = path.split('.');
            let current = materialMeta;
            for (let i = 0; i < parts.length - 1; i++) {
                current = current[parts[i]];
                if (current === undefined) current = current[parts[i]].value;
                if (current === undefined) return false;
            }
            const lastCurrent = current[parts[parts.length - 1]];
            if (typeof lastCurrent === 'object' && 'value' in lastCurrent) {
                current[parts[parts.length - 1]].value = value;
            } else {
                current[parts[parts.length - 1]] = value;
            }
        } else {
            if (typeof materialMeta[path] === 'object' && 'value' in materialMeta[path]) {
                materialMeta[path].value = value;
            } else {
                materialMeta[path] = value;
            }
        }

        materialMeta = await Editor.Message.request('scene', 'change-physics-material', materialMeta);

        await Editor.Message.request('scene', 'apply-physics-material', assetInfo.uuid, materialMeta);
        return true;
    }
}
