import { IAssetImporter } from './base-importer';
import { AssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';

declare const Editor: any;

export class ProjectSettingsImporter implements IAssetImporter {
    get name(): string {
        return 'project-settings';
    }

    get className(): string {
        return 'ProjectSettings';
    }

    async getProperties(assetInfo: AssetInfo): Promise<{ [key: string]: IPropertyValueType }> {
        try {
            // Get actual config
            const projectConfig = await Editor.Message.request('project', 'query-config', 'project') || {};
            
            // Build manual properties
            return this.buildProperties(projectConfig);
        } catch (e) {
            console.warn('[ProjectSettingsImporter] Failed to query project settings:', e);
            return {};
        }
    }

    async setProperty(assetInfo: AssetInfo, path: string, value: any): Promise<boolean> {
        try {
            // Handle Custom Layers
            if (path.startsWith('customLayers')) {
                return this.setLayerProperty(path, value);
            }

            // Handle Sorting Layers
            if (path.startsWith('sortingLayers')) {
                return this.setSortingLayerProperty(path, value);
            }

            // Handle Physics Collision Groups
            if (path.startsWith('physics.collisionGroups')) {
                return this.setCollisionGroupProperty(path, value);
            }

            // Handle General Settings
            if (path.startsWith('general')) {
                return this.setGeneralProperty(path, value);
            }

            // Handle Default Material (Reference Unwrap)
            if (path === 'physics.defaultMaterial' && value && typeof value === 'object' && value.uuid) {
                value = value.uuid;
            }

            // Handle Collision Matrix (Object vs Array)
            // If path is physics.collisionMatrix.5, it maps to physics.collisionMatrix["5"] which is fine.

            await Editor.Message.request('project', 'set-config', 'project', path, value);
            return true;
        } catch (e) {
            console.warn('[ProjectSettingsImporter] Failed to set project settings:', e);
            return false;
        }
    }


    private async setGeneralProperty(path: string, value: any): Promise<boolean> {
        const config = await Editor.Message.request('project', 'query-config', 'project');
        const general = config.general || {};
        
        const parts = path.split('.');
        const key = parts[1];
        
        if (key === 'designResolution') {
             // sub-properties: general.designResolution.width
             if (parts.length === 3) {
                 const subKey = parts[2];
                 general.designResolution[subKey] = value;
             } else {
                 // general.designResolution (Replace size values)
                 if (value && typeof value === 'object') {
                     if ('width' in value) general.designResolution.width = value.width;
                     if ('height' in value) general.designResolution.height = value.height;
                 }
             }
        } else if (key === 'fitWidth' || key === 'fitHeight') {
             general.designResolution[key] = value;
        } else {
             general[key] = value;
        }
        
        await Editor.Message.request('project', 'set-config', 'project', 'general', general);
        return true;
    }

    private async setCollisionGroupProperty(path: string, value: any): Promise<boolean> {
        // path: physics.collisionGroups.0.name or physics.collisionGroups.0
        const parts = path.split('.');
        const indexStr = parts[2];
        if (!indexStr) return false;
        const index = parseInt(indexStr);
        if (isNaN(index)) return false;

        const config = await Editor.Message.request('project', 'query-config', 'project');
        const physics = config.physics || {};
        const groups = physics.collisionGroups || [];

        let newName = "";
        if (typeof value === 'string') newName = value;
        else if (typeof value === 'object' && value.name) newName = value.name;

        // Note: 'index' variable here refers to the ARRAY INDEX in the configuration list,
        // NOT the collision group index (1 << groupIndex).
        
        if (index < groups.length) {
             // Modification
             if (newName) groups[index].name = newName;
        } else if (index === groups.length) {
             // Creation: Find first available group index (0..31)
             const usedIndices = new Set(groups.map((g: any) => g.index));
             // Usually 0 is Default.
             if (!usedIndices.has(0)) usedIndices.add(0); // Treat 0 as used usually
             
             let nextGroupIndex = 1;
             while (usedIndices.has(nextGroupIndex)) {
                 nextGroupIndex++;
             }
             
             if (nextGroupIndex > 31) {
                 console.warn('Max collision groups reached (32).');
                 return false;
             }

             groups.push({
                 index: nextGroupIndex,
                 name: newName || `Group ${nextGroupIndex}`
             });
        } else {
            return false;
        }

        physics.collisionGroups = groups;
        await Editor.Message.request('project', 'set-config', 'project', 'physics', physics);
        return true;
    }

    private async setSortingLayerProperty(path: string, value: any): Promise<boolean> {
        // path: sortingLayers.0 or sortingLayers.0.name
        const parts = path.split('.');
        const indexStr = parts[1];
        if (!indexStr) return false;
        const index = parseInt(indexStr);
        if (isNaN(index)) return false;

        const config = await Editor.Message.request('project', 'query-config', 'project');
        const sortingInfo = config['sorting-layer'] || { layers: [], increaseId: 0 };
        const layers = sortingInfo.layers || [];

        // Determine what we are setting
        let patchData: any = {};
        if (parts.length === 2) {
             if (typeof value === 'string') patchData = { name: value };
             else patchData = value;
        } else if (parts.length === 3) {
             const field = parts[2];
             patchData[field] = value;
        } else {
            return false;
        }

        if (index < layers.length) {
             // Modification
             layers[index] = { ...layers[index], ...patchData };
        } else if (index === layers.length) {
             // Creation
             const newId = (sortingInfo.increaseId || 0) + 1;
             sortingInfo.increaseId = newId;
             
             let newValue = patchData.value;
             if (newValue === undefined) {
                 const maxVal = layers.reduce((max: number, l: any) => (l.value !== undefined && l.value > max) ? l.value : max, -1);
                 newValue = maxVal + 1;
             }
             
             const newLayer = {
                 id: newId,
                 name: patchData.name || `Layer ${newId}`,
                 value: newValue
             };
             layers.push(newLayer);
        } else {
            return false;
        }
        
        sortingInfo.layers = layers;
        // Update the full sorting-layer object to ensure increaseId and set-config sync
        await Editor.Message.request('project', 'set-config', 'project', 'sorting-layer', sortingInfo);
        return true;
    }

    private async setLayerProperty(path: string, value: any): Promise<boolean> {
        // parsing path: customLayers.0.name or customLayers.0
        const parts = path.split('.');
        const indexStr = parts[1];
        if (!indexStr) return false;
        const index = parseInt(indexStr);
        if (isNaN(index)) return false;
        
        let newName = "";
        if (typeof value === 'string') newName = value;
        else if (typeof value === 'object' && value.name) newName = value.name;

        await Editor.Message.request('project', 'set-config', 'project', `layer.${index}`, { name: newName, value: 1 << (index + 1) });
        return true;
    }

    private buildProperties(data: any): { [key: string]: IPropertyValueType } {
        const result: { [key: string]: IPropertyValueType } = {};

        result['sortingLayers'] = {
            value: data && data['sorting-layer'] && data['sorting-layer'].layers ? this.buildSortingLayerProperties(data['sorting-layer'].layers) : [],
            extends: [],
            type: 'SortingLayerItem',
            isArray: true,
            tooltip: 'Sorting layers for sprites'
        };

        result['customLayers'] = {
            value: data && data.layer ? this.buildLayerProperties(data.layer) : [],
            extends: [],
            type: 'LayerItem',
            isArray: true,
            tooltip: 'User defined rendering layers'
        };

        result['physics'] = {
            value: data && data.physics ? this.buildPhysicsProperties(data.physics) : {},
            type: 'PhysicsSettings'
        };

        result['general'] = {
            value: data && data.general ? this.buildGeneralProperties(data.general) : {},
            type: 'GeneralSettings'
        };
        
        return result;
    }

    private buildGeneralProperties(general: any): { [key: string]: IPropertyValueType } {
        const result: { [key: string]: IPropertyValueType } = {};
        
        result['designResolution'] = {
            value: { width: general.designResolution?.width ?? 1280, height: general.designResolution?.height ?? 720 },
            type: 'cc.Size',
            extends: ['cc.ValueType']
        };
        result['fitWidth'] = { value: general.designResolution?.fitWidth ?? false, type: 'Boolean' };
        result['fitHeight'] = { value: general.designResolution?.fitHeight ?? false, type: 'Boolean' };

        result['downloadMaxConcurrency'] = { value: general.downloadMaxConcurrency ?? 15, type: 'Integer', min: 1 };
        result['highQuality'] = { value: general.highQuality ?? false, type: 'Boolean' };

        return result;
    }

    private buildPhysicsProperties(physics: any): { [key: string]: IPropertyValueType } {
        const result: { [key: string]: IPropertyValueType } = {};
        
        // Simple props
        const props = [
            { key: 'allowSleep', type: 'Boolean' },
            { key: 'autoSimulation', type: 'Boolean' },
            { key: 'sleepThreshold', type: 'Float' },
            { key: 'fixedTimeStep', type: 'Float', options: { min: 0 } },
            { key: 'maxSubSteps', type: 'Integer', options: { min: 1 } },
        ];

        for (const p of props) {
            if (p.key in physics) {
                 result[p.key] = { value: physics[p.key], type: p.type, ...p.options };
            }
        }
        
        if (physics.gravity) {
            result['gravity'] = { value: physics.gravity, type: 'cc.Vec3', extends: ['cc.ValueType' ] };
        }

        result['defaultMaterial'] = { 
            value: physics.defaultMaterial ? { uuid: physics.defaultMaterial } : null,
            type: 'cc.PhysicsMaterial', 
            extends: ['cc.Object'] 
        };

        // Collision Groups
        const groups = physics.collisionGroups || [];
        result['collisionGroups'] = {
             value: groups.map((g: any) => ({
                 value: {
                     index: { value: g.index, type: 'Integer', readonly: true },
                     name: { value: g.name, type: 'String' }
                 },
                 type: 'CollisionGroupItem'
             })),
             type: 'CollisionGroupItem',
             isArray: true,
             elementTypeData: {
                type: 'CollisionGroupItem',
                value: {
                    index: { value: 0, type: 'Integer', readonly: true },
                    name: { value: '', type: 'String' }
                }
             }
        };

        // Collision Matrix
        const bitmaskList: { name: string, value: number }[] = [];
        // Default group 0
        const defaultGroup = groups.find((g: any) => g.index === 0);
        bitmaskList.push({ name: defaultGroup ? defaultGroup.name : 'DEFAULT', value: 1 << 0 });
        
        for (const g of groups) {
            if (g.index !== 0) {
                 bitmaskList.push({ name: g.name, value: 1 << g.index });
            }
        }

        const matrixObj = physics.collisionMatrix || {};
        const matrixArr = [];
        // Calculate max index to display
        const indices = [0, ...groups.map((g: any) => g.index), ...Object.keys(matrixObj).map(k => parseInt(k))];
        const maxIndex = Math.max(...indices);
        
        for (let i = 0; i <= maxIndex; i++) {
            matrixArr.push({
                value: matrixObj[i] || 0,
                type: 'BitMask',
                bitmaskList: bitmaskList
            });
        }

        result['collisionMatrix'] = {
            value: matrixArr,
            type: 'BitMask',
            isArray: true,
            elementTypeData: {
                type: 'BitMask',
                value: 0,
                bitmaskList: bitmaskList
            }
        };

        return result;
    }

    private buildSortingLayerProperties(layers: Array<{ id: number, name: string, value: number }>): Array<IPropertyValueType> {
        return layers.map(layer => ({
            extends: [],
            value: {
                id: {
                    value: layer.id,
                    type: 'Integer',
                    readonly: true
                },
                name: {
                    value: layer.name,
                    type: 'String'
                },
                value: {
                    value: layer.value,
                    type: 'Integer'
                }
            },
            type: 'SortingLayerItem'
        }));
    }

    private buildLayerProperties(layers: Array<{ name: string, value: number }>): Array<IPropertyValueType> {
         return layers.map(layer => ({
            extends: [],
            value: {
                name: {
                    value: layer.name,
                    type: 'String'
                },
                value: {
                    value: layer.value,
                    type: 'Integer',
                    readonly: true
                }
            },
            type: 'LayerItem'
        }));
    }
}
