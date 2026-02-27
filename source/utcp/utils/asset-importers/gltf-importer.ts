import { ModelBaseImporter } from './model-base-importer';
import { IProperty } from '@cocos/creator-types/editor/packages/scene/@types/public';

export class GltfImporter extends ModelBaseImporter {
    name = 'gltf';

    protected addSpecificUserData(userData: any, container: { [key: string]: IProperty }): void {
        // GLTF specific properties if any
    }
}
