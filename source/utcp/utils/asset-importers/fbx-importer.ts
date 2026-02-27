import { ModelBaseImporter } from './model-base-importer';
import { IProperty } from '@cocos/creator-types/editor/packages/scene/@types/public';

export class FbxImporter extends ModelBaseImporter {
    name = 'fbx';

    protected addSpecificUserData(userData: any, container: { [key: string]: IProperty }): void {
        const fbx = userData.fbx || {};
        
        container.animationBakeRate = {
            value: fbx.animationBakeRate,
            type: 'Enum',
            enumList: [
                { name: 'Auto', value: 0 },
                { name: 'BakeRate24', value: 24 },
                { name: 'BakeRate25', value: 25 },
                { name: 'BakeRate30', value: 30 },
                { name: 'BakeRate60', value: 60 }
            ],
            tooltip: 'Specify the animation bake sample rate in frames per second (fps).'
        };

        container.preferLocalTimeSpan = {
            value: !!fbx.preferLocalTimeSpan,
            type: 'Boolean',
            tooltip: 'When exporting FBX animations, whether prefer to use the time range recorded in FBX file.<br>If one is not preferred, or one is invalid for use, the time range is robustly calculated.<br>Some FBX generators may not export this information.'
        };

        container.smartMaterialEnabled = {
             value: !!fbx.smartMaterialEnabled,
             type: 'Boolean',
             tooltip: 'Convert DCC materials to engine builtin materials which match the internal lighting model.'
        };

        container.legacyFbxImporter = {
             value: !!userData.legacyFbxImporter,
             type: 'Boolean',
        };
    }
}
