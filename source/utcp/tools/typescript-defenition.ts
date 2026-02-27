import { utcpTool } from '../decorators';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';
import { ToolsUtils } from '../utils/tools-utils';
import { IInstanceReference, InstanceReferenceSchema } from '../schemas';

export class GetClassInfoTool {

    private _definitions: string[] = [];
    private _definedNames: Set<string> = new Set();
    private _commonTypesDefinition: string = 
        'interface IExposedAttributes { type?: string, visible?: boolean, multiline?: boolean, min?: number, max?: number, step?: number, unit?: string, radian?: boolean }\n' +
        'function property(options: IExposedAttributes) {}\n' +
        'type InstanceReference<T> = { id: string; type: string };\n' +
        'class Vec2 { x: number; y: number; }\n' +
        'class Vec3 { x: number; y: number; z: number; }\n' +
        'class Vec4 { x: number; y: number; z: number; w: number; }\n' +
        'class Color { r: number; g: number; b: number; a: number; }\n' +
        'class Rect { x: number; y: number; width: number; height: number; }\n' +
        'class Size { width: number; height: number; }\n' +
        'class Quat { x: number; y: number; z: number; w: number; }\n' +
        'class Mat3 { m00: number; m01: number; m02: number;\n' +
        '\tm03: number; m04: number; m05: number;\n' +
        '\tm06: number; m07: number; m08: number; }\n' +
        'class Mat4 { m00: number; m01: number; m02: number; m03: number;\n' +
        '\tm04: number; m05: number; m06: number; m07: number;\n' +
        '\tm08: number; m09: number; m10: number; m11: number;\n' +
        '\tm12: number; m13: number; m14: number; m15: number; }\n' +
        'class Gradient { alphaKeys: Array<{ alpha: number, time: number }>, colorKeys: Array<{ /* always 3 elements: r, g and b values */color: Array<number>, time: number }>, mode: number }';

    @utcpTool(
        "inspectorGetSettingsDefinition",
        "Generates TypeScript definition for specific settings.",
        { type: 'object' , properties: { settingsType: { type: 'string', enum: ['CommonTypes', 'CurrentSceneGlobals', 'ProjectSettings'] } }, required: ['settingsType'] },
        { type: 'object', properties: { definition: { type: 'string' } }, required: ['definition'] }, 
        "GET",  ['code', 'typescript', 'inspection', 'definition', 'common', 'types', 'settings', 'scene', 'globals', 'project']
    )
    async inspectorGetSettingsDefinition(params: { settingsType: string }): Promise<{ definition: string }> {
        switch (params.settingsType) {
            case 'CommonTypes':
                return { definition: this._commonTypesDefinition };
            case 'CurrentSceneGlobals':
                return this.inspectorGetInstanceDefinition({ reference: { id: 'CurrentSceneGlobals' } });
            case 'ProjectSettings':
                return this.inspectorGetInstanceDefinition({ reference: { id: 'ProjectSettings' } });
            default:
                throw new Error(`Unknown settings type: '${params.settingsType}'.`);
        }
    }
    
    @utcpTool(
        "inspectorGetInstanceDefinition",
        "Generates TypeScript definition based on properties and descriptions of instance (Node, Component, Asset).",
        { type: 'object', properties: { reference: InstanceReferenceSchema }, required: ['reference'] },
        { type: 'object', properties: { definition: { type: 'string' } }, required: ['definition'] }, 
        "GET",  ['code', 'typescript', 'inspection', 'definition', 'class', 'info', 'meta', 'instance', 'node', 'component', 'asset', 'data']
    )
    async inspectorGetInstanceDefinition(params: { reference: IInstanceReference }): Promise<{ definition: string }> {
        this._definitions = [];
        this._definedNames.clear();

        let props: { [key: string]: IPropertyValueType } | undefined = undefined;
        let className = params.reference.id;
        const instanceInfo = await ToolsUtils.inspectInstance(params.reference.id);
        if (instanceInfo) {
            className = instanceInfo.type;
            if (instanceInfo.assetInfo) {
                className += 'Importer';
            }
            if (instanceInfo.props) {
                props = instanceInfo.props;
            }
            this.processClass(className, props);
        } else {
            throw new Error(`Class, Instance or special keyword not found: '${params.reference.id}'.`);
        }

        return { definition: this._definitions.join('\n') };
    }

    private processClass(className: string, providedProps?: { [key: string]: IPropertyValueType }, extendsClass?: string) {
        if (this._definedNames.has(className)) {
            return;
        }

        this._definedNames.add(className);

        if (!providedProps) return;

        // Don't let AI mess out with UUID
        if ('uuid' in providedProps && this.isProperty(providedProps.uuid)) {
            providedProps.uuid.readonly = true;
        }

        // Collect fields first to potentially hoist nested definitions
        const fields: string[] = [];

        for (const propName of Object.keys(providedProps)) {
            const prop = providedProps[propName];
            
            // Filter out primitive properties which can't be inspected or invisible ones
            if (prop === undefined || prop === null || 
                (this.isProperty(prop) && 'visible' in prop && !prop.visible)) continue;

            // IProperty Handling (Complex types, Metadata)
            if (this.isProperty(prop)) {
                const p = prop as IProperty;
                const decoratorParts: string[] = [];
                const isArray = !!p.isArray;
                
                // Determine item definition for Arrays
                let itemDef: any = p;
                if (isArray) {
                    if (p.elementTypeData) {
                        itemDef = p.elementTypeData;
                    } else if (Array.isArray(p.value) && p.value.length > 0) {
                         // Try to infer from first element
                         itemDef = p.value[0];
                    } else {
                        // Cannot infer structure for empty array without schema
                        // Fallback to basic type handling
                        itemDef = null; 
                    }
                }
                
                // Analyze Identity (based on itemDef if array, or p if single)
                const defToAnalyze = itemDef || p;
                const itemExtends = defToAnalyze.extends || [];
                const rawType = defToAnalyze.type || 'any';
                
                const isValueType = itemExtends.includes('cc.ValueType');
                const isReference = itemExtends.includes('cc.Object') || 
                                    (!isValueType && (rawType === 'Node' || rawType === 'Component' || rawType === 'cc.Node' || rawType === 'cc.Component'));
                
                let tsType = this.resolveTsType(rawType).replace(/^cc\./, '');

                // Process Enum/BitMask
                const targetList = defToAnalyze.enumList || defToAnalyze.bitmaskList;
                if ((rawType === 'Enum' || rawType === 'BitMask') && targetList) {
                     const cleanClassName = className.replace(/^cc\./, '').replace(/[^a-zA-Z0-9_]/g, '_');

                     if (p.displayName && typeof p.displayName === 'string') {
                        if (p.displayName.startsWith('i18n:')) {
                             p.displayName = Editor.I18n.t(p.displayName.slice(5)); // Remove 'i18n:' prefix
                        }
                        if (p.displayName.trim().length === 0) {
                            p.displayName = propName;
                        }
                     } else {
                        p.displayName = propName.charAt(0).toUpperCase() + propName.slice(1);
                     }
                     
                     let enumName = `${cleanClassName}${p.displayName.replace(/[^a-zA-Z0-9_]/g, '')}${rawType}`;

                     if (defToAnalyze.userData && typeof defToAnalyze.userData === 'object' && 'enumName' in defToAnalyze.userData) {
                         enumName = defToAnalyze.userData['enumName'];
                     }
                     
                     this.generateEnumDefinition(enumName, targetList);
                     tsType = enumName;
                } 
                // Process Struct or Standard Type
                else {
                    // Recursion: Only recurse if we have a valid item definition (itemDef)
                    // If isArray is true but itemDef is undefined, we skip recursion (treat as Array<any> or Array<p.type>)
                    if (itemDef && !isReference && !isValueType && !this.isPrimitiveType(rawType) && itemDef.value && typeof itemDef.value === 'object') {
                         let nestedName = tsType;
                         if (!nestedName || nestedName === 'Object' || nestedName === 'any') {
                             const suffix = isArray ? 'Item' : 'Type';
                             nestedName = `${className}${propName.charAt(0).toUpperCase() + propName.slice(1)}${suffix}`;
                         }
                         
                         const extendsForNested = itemDef.extends && itemDef.extends.length > 0 ? itemDef.extends[0].replace(/^cc\./, '') : undefined;
                         this.processClass(nestedName, itemDef.value as any, extendsForNested !== nestedName ? extendsForNested : undefined);
                         tsType = nestedName;
                    }
                }
                
                // Wrap reference type
                if (isReference) {
                    if (tsType === 'any') tsType = 'Object';
                    tsType = `InstanceReference<${tsType}>`;
                }
                
                // Wrap array type
                if (isArray) {
                     tsType = `Array<${tsType}>`;
                }

                // Decorators & Attributes
                let decoratorType = null;

                // Valuable types for decorators is only CCInteger and CCFloat
                if (p.type === 'Integer') decoratorType = 'CCInteger';
                else if (p.type === 'Float' || p.type === 'Number') decoratorType = 'CCFloat';
                
                if (decoratorType) {
                     decoratorParts.push(isArray ? `type: [${decoratorType}]` : `type: ${decoratorType}`);
                }

                // Attributes that can help AI get more context
                const attrs = ['min', 'max', 'step', 'unit', 'radian', 'multiline'];
                attrs.forEach(attr => { 
                    const val = (p as any)[attr];
                    if (val !== undefined && val !== null) decoratorParts.push(`${attr}: ${val}`);
                });

                if (p.tooltip) {
                    let tooltip = p.tooltip;
                    if (tooltip.startsWith('i18n:')) {
                        tooltip = Editor.I18n.t(tooltip.slice(5)); // Remove 'i18n:' prefix
                    }
                    
                    if (tooltip.trim().length > 0) {
                        if (tooltip.match(/<br\s*\/?>/i) || tooltip.includes('\n')) {
                            const lines = tooltip.split(/<br\s*\/?>|\n/i).map(l => l.trim()).filter(l => l.length > 0);
                            if (lines.length > 0) {
                                fields.push(`\t/**`);
                                lines.forEach(line => fields.push(`\t * ${line}`));
                                fields.push(`\t */`);
                            }
                        } else {
                            fields.push(`\t/** ${tooltip} */`);
                        }
                    }
                }

                if (decoratorParts.length > 0) {
                    fields.push(`\t@property({ ${decoratorParts.join(', ')} })`);
                }

                const prefix = !!p.readonly ? 'readonly ' : '';
                fields.push(`\t${prefix}${propName}: ${tsType};`);
                continue;
            }

            // Raw Value Handling (Primitives and simple objects)
            if (this.isPrimitive(prop)) {
                fields.push(`\t${propName}: ${typeof prop};`);
                continue;
            }

            // Array Handling
            if (Array.isArray(prop)) {
                if (prop.length === 0) {
                    fields.push(`\t${propName}: Array<any>;`);
                } else {
                    const firstItem = prop[0];
                    if (this.isPrimitive(firstItem)) {
                         fields.push(`\t${propName}: Array<${typeof firstItem}>;`);
                    } else if (typeof firstItem === 'object') {
                         // Raw object in array -> Recursion
                         const nestedClassName = `${className}${propName.charAt(0).toUpperCase() + propName.slice(1)}Item`;
                         this.processClass(nestedClassName, firstItem as unknown as { [key: string]: IPropertyValueType });
                         fields.push(`\t${propName}: Array<${nestedClassName}>;`);
                    } else {
                         fields.push(`\t${propName}: Array<any>;`);
                    }
                }
                continue;
            }
             
            // Fallback for raw object (struct)
             if (typeof prop === 'object') {
                const cleanClassName = className.replace(/^cc\./, '').replace(/[^a-zA-Z0-9_]/g, '_');
                const nestedClassName = `${cleanClassName}${propName.charAt(0).toUpperCase() + propName.slice(1)}Type`;
                this.processClass(nestedClassName, prop as unknown as { [key: string]: IPropertyValueType });                 
                fields.push(`\t${propName}: ${nestedClassName};`);
            }
        }

        const shortName = className.includes('.') ? className.split('.').pop()! : className;
        const classDef = [
            `export class ${shortName} ${extendsClass ? `extends ${extendsClass}` : ''} {`,
            ...fields,
            `}`
        ].join('\n');

        this._definitions.push(classDef);
    }

    // Type Guard for IProperty
    private isProperty(val: any): val is IProperty {
         return val && typeof val === 'object' && 'value' in val;
    }

    // Based on info from CCClass
    private isPrimitiveType(type: string): boolean {
        return ['Integer', 'Float', 'Number', 'String', 'Boolean'].includes(type);
    }

    // Check if value is primitive
    private isPrimitive(value: unknown): boolean {
        return value === null || (typeof value !== "object" && typeof value !== "function");
    }

    // Helper for Enum or BitMask generation
    private generateEnumDefinition(name: string, items: any[]) {
        if (this._definedNames.has(name)) return;
        this._definedNames.add(name);

        const lines: string[] = [];
        lines.push(`export enum ${name} {`);
        items.forEach((item) => {
            let cleanName = item.name.replace(/[^a-zA-Z0-9_]/g, '_');
            if (/^[0-9]/.test(cleanName)) {
                cleanName = `_${cleanName}`;
            }
            
            if (typeof item.value === 'string') {
                lines.push(`\t${cleanName} = '${item.value}',`);
            } else {
                lines.push(`\t${cleanName} = ${item.value},`);
            }
        });
        lines.push(`}`);
        this._definitions.unshift(lines.join('\n'));
    }
    
    private resolveTsType(type: string): string {
        switch (type) {
            case 'Integer':
            case 'Float':
            case 'Number':
            case 'Enum': // Enums handled specifically, but fallback for safety
            case 'BitMask':
                return 'number';
            case 'String':
                return 'string';
            case 'Boolean':
                return 'boolean';
            default:
                return type; // e.g. Vec3, Color, Node
        }
    }

}

