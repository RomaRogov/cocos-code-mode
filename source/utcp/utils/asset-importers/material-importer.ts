import { BaseAssetImporter } from './base-importer';
import { IAssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';

export class MaterialImporter extends BaseAssetImporter {
    name = 'material';

    async getProperties(assetInfo: any): Promise<{ [key: string]: IPropertyValueType }> {
        const materialDump = await Editor.Message.request('scene', 'query-material', assetInfo.uuid);
        
        if (!materialDump) {
            throw new Error('Material dump not found');
        }

        const propertyContainer: { [key: string]: IProperty } = {};

        // Get Effect Info
        const collator = new Intl.Collator(undefined, { numeric: true });
        const effects = Object.values(await Editor.Message.request('scene', 'query-all-effects'))
            .filter((effect) => !(effect as any).hideInEditor)
            .sort((a, b) => collator.compare((a as any).name, (b as any).name));

        let effectName = materialDump.effect ?? 'builtin-standard';

        propertyContainer['effect'] = {
            value: effectName,
            type: 'Enum',
            userData: { enumName: 'MaterialEffectAssetName' },
            enumList: effects.map((effect: any) => ({ name: effect.name.replace('../', ''), value: effect.name })),
            visible: true,
            readonly: false
        };

        if (materialDump.data) {
            const techniqueOptions = materialDump.data.map((t: any, i: number) => ({ name: t.name || i.toString(), value: i }));
            
            propertyContainer['technique'] = {
                value: materialDump.technique,
                type: 'Enum',
                enumList: techniqueOptions,
                visible: true,
                readonly: false
            };
            
            const currentTechniqueIndex = materialDump.technique || 0;
            const currentTechnique = materialDump.data[currentTechniqueIndex];
            
            if (currentTechnique && currentTechnique.passes) {
                const passes: any[] = [];

                function checkDefineVisibility(defines: any[], defineMap: { [key: string]: any }): boolean {
                    for (const def of defines) {
                        if (def.startsWith('!')) {
                            if (defineMap[def.substring(1)]) {
                                return false;
                            }
                        } else {
                            if (!defineMap[def]) {
                                return false;
                            }
                        }
                    }
                    return true;
                }

                currentTechnique.passes.forEach((pass: any, passIndex: number) => {
                    const passProps: { [key:string]: any } = {};
                    
                    // Create a map of defines for quick lookup
                    const defineMap: { [key: string]: any } = {};
                    
                    if (pass.defines) {
                        // Prepare define map
                        pass.defines.forEach((def: any) => {
                            defineMap[def.name] = def.value;
                        });
                        
                        // Process defines
                        pass.defines.forEach((def: any) => {
                            // Transform define type based on logic
                            let type = def.type;
                            let enumList = def.enumList;

                            switch (def.type) {
                                case 'Number':
                                    type = 'Enum';
                                    enumList = [];
                                    if (def.range && def.range.length >= 2) {
                                        for (let i = def.range[0]; i <= def.range[1]; i++) {
                                            enumList.push({ name: `Variant${i}`, value: i });
                                        }
                                    }
                                    break;
                                case 'String':
                                    type = 'Enum';
                                    enumList = [];
                                    if (def.options) {
                                        enumList = def.options.map((str: string) => ({ name: str, value: str }));
                                    }
                                    break;
                                case 'Enum':
                                    break;
                                default:
                                    type = 'Boolean';
                                    break;
                            }

                            const defProp = {
                                type: type,
                                extends: [],
                                value: def.value,
                                tooltip: def.tooltip,
                                enumList: enumList,
                                visible: checkDefineVisibility(def.defines || [], defineMap)
                            };
                            passProps[def.name] = defProp;
                        });
                    }

                    // Process properties
                    if (pass.props) {
                        pass.props.forEach((prop: any) => {
                            // Inject extends: ['cc.ValueType'] for known value types to prevent custom class generation
                            let extendsData = prop.extends || [];
                            if (['Vec2', 'Vec3', 'Vec4', 'Color', 'Rect', 'Size', 'Quat', 'Mat3', 'Mat4'].includes(prop.type)) {
                                if (!extendsData.includes('cc.ValueType')) {
                                    extendsData = [...extendsData, 'cc.ValueType'];
                                }
                            }

                            const valProp = {
                                ...prop,
                                displayName: prop.displayName || prop.name,
                                visible: checkDefineVisibility(prop.defines || [], defineMap),
                                extends: extendsData
                            };
                            passProps[prop.name] = valProp;
                        });
                    }

                    const passHasProps = Object.keys(passProps).length > 0;

                    passProps['phase'] = {
                        extends: [],
                        type: 'String',
                        value: pass.phase || '',
                        visible: true,
                        readonly: true
                    };

                    passes.push({
                        extends: ['cc.MaterialPass'],
                        value: passProps,
                        type: `cc.MaterialPass${passHasProps ? passIndex : ''}`
                    });
                });
                
                const passesProp: any = {
                    value: passes,
                    type: 'cc.MaterialPasses',
                    visible: true
                };
                propertyContainer['passes'] = passesProp;
            }
        }

        return propertyContainer;
    }

    async setProperty(assetInfo: IAssetInfo, path: string, value: any): Promise<boolean> {
        // 1. Get the current material dump
        const materialDump = await Editor.Message.request('scene', 'query-material', assetInfo.uuid);
        if (!materialDump) {
            return false;
        }

        let handled = false;

        // 2. Handle simple root properties
        if (path === 'effectAsset' || path === 'effect') {
            const effects = await Editor.Message.request('scene', 'query-all-effects');
            if (value && value.name) {
                value = value.name;
            }
            if (typeof value === 'object' && 'uuid' in value) {
                value = value.uuid;
            }
            if (effects[value]) {
                value = effects[value].name;
                handled = true;
            } else {
                const effect = effects.find((eff: any) => eff.name === value);
                if (effect) {
                    value = effect.name;
                    handled = true;
                } else {
                    // Effect not found
                    throw new Error(`Effect '${value}' not found`);
                }
            }
        } else if (path === 'technique') {
            materialDump.technique = value;
            handled = true;
        } else {
            // 3. Handle data/props traversal
            const techniqueIndex = materialDump.technique || 0;
            const technique = materialDump.data[techniqueIndex];
            
            if (technique && technique.passes) {
                const parts = path.split('.');
                let targetPassIndices: number[] = [];
                let propPathParts: string[] = [];

                // Check for explicit pass path "passes.0.propName..."
                if (parts[0] === 'passes' && !isNaN(parseInt(parts[1]))) {
                    targetPassIndices = [parseInt(parts[1])];
                    propPathParts = parts.slice(2);
                } else {
                    // Implicit: Search all passes in current technique
                    targetPassIndices = technique.passes.map((_: any, i: number) => i);
                    propPathParts = parts;
                }

                if (propPathParts.length > 0) {
                    const propName = propPathParts[0];
                    const subProps = propPathParts.slice(1);

                    const setDeepProperty = (target: any, pathParts: string[], val: any): boolean => {
                        let current = target;
                        
                        // Navigate to the parent of the target property
                        for (let i = 0; i < pathParts.length - 1; i++) {
                            const key = pathParts[i];
                            
                            // 1. Try to access key directly
                            if (current[key] !== undefined) {
                                current = current[key];
                                continue;
                            }
                            
                            // 2. Try to drill into .value (if current is a wrapper)
                            if (current.value && typeof current.value === 'object' && current.value[key] !== undefined) {
                                current = current.value[key];
                                continue;
                            }

                            // 3. Special case for arrays where we might be accessing by index but current is a wrapper
                            if (current.value && Array.isArray(current.value) && current.value[key] !== undefined) {
                                current = current.value[key];
                                continue;
                            }

                            // Path not found
                            return false;
                        }
                        
                        const lastKey = pathParts[pathParts.length - 1];
                        
                        // Helper to set on the final object
                        const setOnObject = (obj: any): boolean => {
                             if (obj[lastKey] === undefined) return false;

                             const targetProp = obj[lastKey];
                             
                             // Check if the target is a Property Wrapper (Object with .value)
                             // We avoid Arrays or nulls
                             if (targetProp && typeof targetProp === 'object' && !Array.isArray(targetProp) && 'value' in targetProp) {
                                 targetProp.value = val;
                             } else {
                                 // It's a raw value (primitive or struct without wrapper)
                                 obj[lastKey] = val;
                             }
                             return true;
                        };

                        // 1. Try direct set
                        if (setOnObject(current)) return true;

                        // 2. Try set on .value (if wrapper)
                        if (current.value && typeof current.value === 'object') {
                            if (setOnObject(current.value)) return true;
                        }

                        return false;
                    };


                    targetPassIndices.forEach(passIndex => {
                        const pass = technique.passes[passIndex];
                        if (!pass) return;

                        // 1. Search in props (Array)
                        if (pass.props) {
                            const prop = pass.props.find((p: any) => p.name === propName);
                            if (prop) {
                                if (subProps.length === 0) {
                                    if (typeof value === 'string' && prop.type && 
                                        (prop.type.toLowerCase().includes('texture') || prop.type.toLowerCase().includes('sampler'))) {
                                        prop.value = { uuid: value };
                                    } else {
                                        prop.value = value;
                                    }
                                    handled = true;
                                } else {
                                    // Validate if prop.value is object for deep set
                                    if (prop.value && typeof prop.value === 'object') {
                                        if (setDeepProperty(prop, subProps, value)) {
                                            handled = true;
                                        }
                                    }
                                }
                            }
                        }

                        // 2. Search in defines (Array)
                        if (pass.defines) {
                            const define = pass.defines.find((d: any) => d.name === propName);
                            if (define) {
                                if (subProps.length === 0) {
                                    define.value = value;
                                    handled = true;
                                }
                            }
                        }
                        
                        // 3. Search in states (Object)
                        if (pass.states && pass.states.value) {
                             // Check direct state property (e.g., "priority", "primitive")
                             if (pass.states.value[propName]) {
                                 const stateProp = pass.states.value[propName];
                                 if (subProps.length === 0) {
                                      stateProp.value = value;
                                      handled = true;
                                 } else {
                                      if (stateProp.value && typeof stateProp.value === 'object') {
                                          if (setDeepProperty(stateProp, subProps, value)) {
                                              handled = true;
                                          }
                                      }
                                 }
                             }
                        }
                    });
                }
            }
        }

        // 4. Apply changes
        if (handled) {
             await Editor.Message.request('scene', 'apply-material', assetInfo.uuid, materialDump);
             Editor.Message.broadcast('material-inspector:change-dump');
             return true;
        }
        
        return false;
    }
}
