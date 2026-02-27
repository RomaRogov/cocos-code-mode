import { ImporterManager } from './asset-importers';
import { INode, IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';
import { AssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';

export class ToolsUtils {

    static async inspectInstance(targetId: string, adaptNode: boolean = true): Promise<{ uuid: string, type: string, props: { [key: string]: IPropertyValueType } | null, assetInfo: AssetInfo | null } | null> {
        if (targetId === 'CurrentSceneGlobals') {
            return this.inspectCurrentSceneSettings();
        }

        if (targetId === 'ProjectSettings') {
            return {
                uuid: 'ProjectSettings',
                type: 'ProjectSettings',
                props: await ImporterManager.getInstance().getImporter('project-settings')?.getProperties({} as any) || null,
                assetInfo: { uuid: 'ProjectSettings', type: 'ProjectSettings', importer: 'project-settings' } as any
            };
        }

        // Try Node
        try {
            const nodeDump = await Editor.Message.request('scene', 'query-node', targetId);
            const props = this.convertDumpToProperties('node', nodeDump, adaptNode);

            if (nodeDump) {
                return {
                    uuid: targetId,
                    type: nodeDump.__type__ || 'cc.Node',
                    props: props,
                    assetInfo: null
                };
            }
        } catch (e) {}

        // Try Component
        try {
            const compDump = await Editor.Message.request('scene', 'query-component', targetId);
            if (compDump) {
                const props = this.convertDumpToProperties('component', compDump.value || compDump);

                return {
                    uuid: targetId,
                    type: compDump.type || 'cc.Component',
                    props: props,
                    assetInfo: null
                };
            }
        } catch (e) {}
        
        // Try Asset
        try {
             const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', targetId);
             const props = assetInfo ? await ImporterManager.getInstance().getImporter(assetInfo.importer)?.getProperties(assetInfo) : null;
             if (assetInfo) {
                 return {
                     uuid: targetId,
                     type: assetInfo.type, 
                     props: props || null,
                     assetInfo: assetInfo
                 };
             }
        } catch (e) { console.warn('Failed to inspect asset:', e); }

        return null; 
    }

    private static async inspectCurrentSceneSettings(): Promise<{ uuid: string, type: string, props: { [key: string]: IPropertyValueType } | null, assetInfo: AssetInfo | null } | null> {
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree') as any;
            if (!tree || !tree.uuid) {
                 return null;
            }

            const sceneDump = await Editor.Message.request('scene', 'query-node', tree.uuid) as any;
            
            if (sceneDump && sceneDump._globals) {
                 const props = this.convertDumpToProperties('component', sceneDump._globals);
                 return {
                     uuid: tree.uuid,
                     type: 'cc.SceneGlobals',
                     props: props,
                     assetInfo: null
                 };
            }
        } catch (e) {
            console.warn('Failed to inspect CurrentSceneGlobals:', e);
        }
        return null;
    }

    private static convertDumpToProperties(dumpType: "node" | "component", dump: INode | IPropertyValueType | { [key: string]: IPropertyValueType; } | null, adaptNode: boolean = true): { [key: string]: IPropertyValueType } {
        if (!dump) return {};
        
        const result: { [key: string]: IPropertyValueType } = {};
        if (typeof dump === 'object' && dump !== null) {
             // Safe iteration for object
             for (const key of Object.keys(dump)) {
                 const val = (dump as any)[key];
                 if (val) {
                     result[key] = val;
                 }
             }
        }

        switch (dumpType) {
            // Specific adjustments for Node
            case 'node':
                if (!adaptNode) {
                    break;
                }
                
                // Adapt __comps__ to show component UUIDs only
                if (!('__comps__' in result)) {
                    throw new Error(`Missing __comps__ property for Node class.`);
                }
                const compsMap = (result.__comps__ as IProperty[]).map(comp => { return { value: { id: (comp.value as any).uuid.value } }});
                result['__comps__'] = { value: compsMap, extends: ['cc.Object'], type: 'cc.Component', isArray: true, tooltip: 'cc.Component is a basic type for component. Inspect specific component instance for it\'s definition. You can change actual instances properties via __comps__.i prefix of node' };

                if (!('children' in result)) {
                    throw new Error(`Missing children property for Node class.`);
                }
                result['children'] = { value: [], type: 'cc.Node', isArray: true, readonly: true };
                
                if (!('__type__' in result)) {
                    throw new Error(`Missing __type__ property for Node class.`);
                }
                result['__type__'] = { value: 'cc.Node', visible: false };
                break;
                
            case 'component':
                // Inspector hides 'enabled' property for Components, but we need it
                if ('enabled' in result && result.enabled &&
                    typeof result.enabled === 'object' && 'visible' in result.enabled) {
                    result.enabled.visible = true;
                }
            break;
        }

        return result;
    }

    public static unwrapProperties(properties: { [key: string]: IPropertyValueType }): any {
        const result: any = {};
        
        for (const [key, prop] of Object.entries(properties)) {
            // Check if prop is null/undefined
            if (prop === undefined || prop === null) {
                result[key] = prop;
                continue;
            }

            // Check if prop is IProperty (has value, type, default, etc)
            if (typeof prop !== 'object') {
                 result[key] = prop;
                 continue;
            }

            // It is an object. Check if it looks like IProperty.
            const p = prop as IProperty;
            let value = p.value;

            // Skip invisible properties
            if (p.visible === false) {
                continue;
            }
            
            // If value is undefined, try default
            if (value === undefined) {
                value = p.default;
            }

            const isLikelyIProperty = 'type' in p || 'value' in p || 'default' in p || 'visible' in p;
            
            if (!isLikelyIProperty) {
                 // It might be a nested object that is NOT wrapped (though rare in dump root)
                 if (Array.isArray(prop)) {
                     // Array of values?
                     result[key] = prop; 
                 } else {
                     // Nested object
                     result[key] = this.unwrapProperties(prop as any);
                 }
                 continue;
            }

            // Now 'value' holds the unwrapped value (or it's undefined/null).
            
            // Recursive unpack if value is an object (nested IProperties)
            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                     // Check if it's an array of IProperties
                     if (value.length > 0 && typeof value[0] === 'object' && value[0] &&
                         ('type' in value[0] || 'value' in value[0] || 'default' in value[0])) {
                         
                         // Recursively unwrap each element in the array
                         value = value.map((item: any) => {
                             // This item is efficiently an IProperty (or mostly likely).
                             let val = item.value;
                             if (val === undefined) val = item.default;
                             
                             // If it doesn't have value/default but is object, might be raw object? 
                             if (val === undefined && !('type' in item)) val = item;

                             // Verify deeply nested
                             if (val && typeof val === 'object' && !Array.isArray(val)) {
                                  // We need to verify if 'val' keys point to IProperties.
                                  const keys = Object.keys(val);
                                  if (keys.length > 0) {
                                      // Check first key
                                      const firstChild = val[keys[0]];
                                      if (firstChild && typeof firstChild === 'object' && 
                                         ('type' in firstChild || 'value' in firstChild || 'default' in firstChild)) {
                                          return this.unwrapProperties(val);
                                      }
                                  }
                             }
                             return val;
                         });
                     }
                } else {
                     // Nested object (Struct). Check if it contains IProperties.
                     const keys = Object.keys(value);
                     if (keys.length > 0) {
                         const firstVal = (value as any)[keys[0]];
                         if (firstVal && typeof firstVal === 'object' && 
                            ('type' in firstVal || 'value' in firstVal || 'default' in firstVal)) {
                             // It is a struct where values are IProperties
                             value = this.unwrapProperties(value as any);
                         }
                     }
                }
            }

            result[key] = value;
        }
        return result;
    }
/*
    static resolvePropertyPath(data: any, path: string): any {
        if (!path || !data) return data;
        
        let current = data;
        
        const parts = path.split('.');
        
        for (const part of parts) {
            if (current === null || current === undefined) return undefined;

            if (typeof current === 'object' && current !== null) {
                 if (Array.isArray(current)) {
                     const idx = parseInt(part);
                     if (!isNaN(idx) && current[idx] !== undefined) {
                         current = current[idx];
                         continue;
                     }
                 }
                 if (part in current) {
                     current = current[part];
                     continue;
                 }
            }
            
            return undefined;
        }

        return current;
    }
        */
}
