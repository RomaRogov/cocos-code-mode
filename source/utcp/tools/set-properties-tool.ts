import { utcpTool } from '../decorators';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';
import { ToolsUtils } from '../utils/tools-utils';
import { ImporterManager } from '../utils/asset-importers';
import { AssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { IInstanceReference, InstanceReferenceSchema, ISuccessIndicator, SuccessIndicatorSchema } from '../schemas';

declare const Editor: any;

export class SetPropertyTool {
    @utcpTool(
        "inspectorSetSettingsProperties",
        "Sets a property on the specific settings. If a property path or type is not confirmed via inspectorGet* tools, you MUST NOT call any setter.",
        { type: 'object',
            properties: {
                settingsType: { type: 'string', enum: ['CurrentSceneGlobals', 'ProjectSettings'] },
                propertyPath: { type: 'string', description: "Plain path to the property (e.g., 'ambient.skyLightingColor.r'). Don't support code execution." },
                value: { type: ['array', 'object', 'string', 'number', 'boolean', 'null'], additionalProperties: true }
            },
            required: ['settingsType', 'propertyPath', 'value']
        },
        SuccessIndicatorSchema, "POST", ['property', 'set', 'scene', 'settings', 'project', 'modify', 'config']
    )
    async setCurrentSceneProperties(params: { settingsType: string, propertyPaths: string[], values: any[] }): Promise<ISuccessIndicator> {
        return await this.setInstanceProperties({
            reference: { id: params.settingsType }, propertyPaths: params.propertyPaths, values: params.values
        });
    }


    @utcpTool(
        "inspectorSetInstanceProperties",
        "Sets a property on instance of Node, Component or Asset. If a property path or type is not confirmed via inspectorGet* tools, you MUST NOT call any setter.",
        {
            type: 'object',
            properties: {
                reference: InstanceReferenceSchema,
                propertyPaths: { type: 'array', items: { type: 'string' }, description: "Plain paths to the properties (e.g., ['position.x', 'rotation.y']). Don't support code execution. Arrays are reached by indexes. (e.g. 'sharedMaterials.0')" },
                values: { type: 'array', items: { type: ['array', 'object', 'string', 'number', 'boolean', 'null'], additionalProperties: true } }
            },
            required: ['reference', 'propertyPaths', 'values']
        },
        SuccessIndicatorSchema, "POST", ['property', 'set', 'instance', 'node', 'component', 'asset', 'modify', 'meta']
    )
    async setInstanceProperties(params: { reference: IInstanceReference, propertyPaths: string[], values: any[] }): Promise<ISuccessIndicator> {
        let { reference: { id: uuid }, propertyPaths, values } = params;

        if (!propertyPaths || !values) {
            throw new Error(`Property paths and values are required.`);
        }

        if (propertyPaths.length !== values.length) {
            throw new Error(`Property paths count (${propertyPaths.length}) does not match values count (${values.length}).`);
        }

        let info = await ToolsUtils.inspectInstance(uuid, false);
        if (!info) {
            throw new Error(`Target ${uuid} not found or not supported.`);
        }

        uuid = info.uuid;

        const { type, props, assetInfo } = info;

        if (!props) {
            throw new Error(`Could not retrieve properties for ${type} of instance ${uuid}.`);
        }

        for (let i = 0; i < propertyPaths.length; i++) {
            await this.setProperty(info, propertyPaths[i], values[i]);
        }

        return { success: true };
    }

    private async setProperty({ uuid, type, props, assetInfo }: { uuid: string, type: string, props: { [key: string]: IPropertyValueType } | null, assetInfo: AssetInfo | null }, propertyPath: string, value: any): Promise<void> {
        // Find property definition in the dump
        let targetProp: IProperty | null = null;
        try {
            targetProp = this.findPropertyInDump(props, propertyPath);
        } catch (e: any) {
            throw new Error(`Property '${propertyPath}' resolution failed: ${e.message}. Please recheck TypescriptDefinition of ${uuid}. Arrays are reached by indexes.`);
        }

        if (!targetProp) {
            throw new Error(`Property '${propertyPath}' not found on ${type} of instance ${uuid}.`);
        }

        // Normalize value based on property definition
        value = this.normalizeValue(value, targetProp);

        if (assetInfo) {
            try {
                const success: boolean | undefined = await ImporterManager.getInstance().getImporter(assetInfo.importer)?.setProperty(assetInfo, propertyPath, value);
                if (!success) {
                    throw new Error(`Importer failed to set property.`);
                }
            } catch (e) {
                throw new Error(`Failed to set property on Asset ${uuid}: ${e}`);
            }
            return;
        }

        if (type === 'cc.SceneGlobals') {
            // Scene Globals are part of the scene node but under _globals
            propertyPath = `_globals.${propertyPath}`;
            // uuid is already set to the Scene UUID from inspectInstance
        } else if (type !== 'cc.Node') {
            const nodeUuid = (props as any).node.value.uuid;
            const nodeInfo = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeInfo) {
                throw new Error(`Parent Node ${nodeUuid} for Component ${uuid} not found.`);
            }
            const componentIndex = nodeInfo.__comps__.findIndex((comp: any) => comp.value.uuid.value === uuid);
            propertyPath = `__comps__.${componentIndex}.${propertyPath}`;
            uuid = nodeUuid;
        }

        await this.applyValue(uuid, propertyPath, targetProp, value);
    }

    private normalizeValue(value: any, prop: IProperty): any {
        // Try to parse string values into proper types
        if (typeof value === 'string') {
            const isStringProp = prop.type === 'String';
            if (!isStringProp) {
                const t = value.trim();
                if (t === 'true') return true;
                if (t === 'false') return false;

                if (!isNaN(Number(t)) && t !== '') {
                    return Number(t);
                }

                if ((t.startsWith('{') || t.startsWith('[')) && (t.endsWith('}') || t.endsWith(']'))) {
                    try { return JSON.parse(t); } catch (e) { }
                }
            }
        }
        return value;
    }

    private findPropertyInDump(root: { [key: string]: IPropertyValueType } | AssetInfo | null, path: string): IProperty | null {
        if (!path) return null;
        if (!root) return null;

        const parts = path.split('.');

        let current: any = { value: root }; // Wrap to unify traversal

        // Helper to check if object looks like a property definition
        const isProperty = (obj: any) => obj && typeof obj === 'object' && ('type' in obj || 'extends' in obj);

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            // Current is expected to be an IProperty or object containing IProperty data
            let val = current.value;
            // If current is just the dictionary (root), use it directly
            if (current === root || (typeof current === 'object' && !('value' in current))) {
                val = current;
            }

            if (val === undefined || val === null) return null;

            // 1. Array Index
            if (Array.isArray(val)) {
                const idx = parseInt(part);
                if (!isNaN(idx)) {
                    // Existing index
                    if (val[idx] !== undefined) {
                        const elem = val[idx];
                        if (isProperty(elem)) {
                            current = elem;
                        } else if (current.elementTypeData) {
                            // Hydrate from schema
                            current = { ...current.elementTypeData, value: elem };
                        } else {
                            // Fallback for primitive arrays without schema
                            current = { value: elem, type: 'Unknown' };
                        }
                        continue;
                    }
                    // Extending array support: Allow index == length if schema exists.
                    // Don't allow gaps (idx > length).
                    if (idx === val.length) {
                        if (current.elementTypeData) {
                            current = current.elementTypeData;
                            continue;
                        } else {
                            throw new Error(`Array extension at '${part}' failed: No elementTypeData.`);
                        }
                    }
                    throw new Error(`Array index '${idx}' out of bounds (length: ${val.length}) at '${part}'.`);
                }
                throw new Error(`Invalid array index '${part}' at '${path}'.`);
            }

            // 2. Object Key
            if (typeof val === 'object') {
                if (part in val) {
                    const propCandidate = val[part as keyof typeof val];
                    if (isProperty(propCandidate)) {
                        current = propCandidate;
                    } else {
                        // Not a property, probably a raw value in a struct (like position.x = 0)
                        // Try to find schema in default value if available
                        let schema = null;
                        if (current.default && current.default.value && typeof current.default.value === 'object' && part in current.default.value) {
                            schema = current.default.value[part];
                        }

                        if (schema) {
                            current = { ...schema, value: propCandidate };
                        } else {
                            // No schema found, treat as untyped value
                            current = { value: propCandidate, type: 'Unknown' };
                        }
                    }
                    continue;
                }
                throw new Error(`Key '${part}' not found ${i == 0 ? '' : 'in ' + parts.slice(0, i).join('.')}.`);
            }

            throw new Error(`Path segment '${part}' '${i == 0 ? '' : 'at ' + parts.slice(0, i).join('.')}' failed resolution.`);
        }

        return current as IProperty;
    }

    private async applyValue(uuid: string, path: string, prop: IProperty, value: any) {
        // Handle direct references
        if (prop.extends?.includes('cc.Object')) {
            value = await this.convertObjectReferenceToCocos(value, prop);
        }

        // Handle array of references
        if (Array.isArray(value) && prop.elementTypeData?.extends?.includes('cc.Object')) {
            const convertedArray: any[] = [];
            value.forEach(async (item, index) => {
                convertedArray[index] = await this.convertObjectReferenceToCocos(item, prop.elementTypeData!);
            });
            value = convertedArray;
        }

        const dump = { value, type: prop.type };

        await Editor.Message.request('scene', 'set-property', {
            uuid,
            path,
            dump
        });

        await Editor.Message.request('scene', 'snapshot');
    }

    private async convertObjectReferenceToCocos(value: any, prop: IProperty): Promise<{ uuid: string }> {
        const extendsInfo = prop.extends || [];

        // Accept plain UUID string or { uuid: string } structure
        if (typeof value === 'string') {
            value = { uuid: value };
        }
        
        // Reference object with id is sent
        if (typeof value === 'object' && value !== null && 'id' in value) {
            value = { uuid: value.id };
        }

        // Special case for asset subtype check
        if (extendsInfo.includes('cc.Asset')) {
            const assetInfo: AssetInfo | null = await Editor.Message.request('asset-db', 'query-asset-info', value.uuid);
            if (!assetInfo) {
                throw new Error(`Asset with id ${value.uuid} not found.`);
            }
            let foundSubAsset = false;
            if (assetInfo.type !== prop.type) {
                Object.values(assetInfo.subAssets || {}).forEach(subAsset => {
                    if (subAsset.type === prop.type) {
                        value = { uuid: subAsset.uuid };
                        foundSubAsset = true;
                    }
                });
            } else {
                foundSubAsset = true;
            }

            if (!foundSubAsset && assetInfo.type !== prop.type) {
                throw new Error(`Reference type mismatch: expected ${prop.type}, got ${assetInfo.type}.`);
            }
        }
        return value;
    }
}
