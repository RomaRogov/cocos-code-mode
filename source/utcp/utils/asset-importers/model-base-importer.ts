import { BaseAssetImporter } from './base-importer';
import { IAssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';
import { IProperty, IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';

export abstract class ModelBaseImporter extends BaseAssetImporter {
    
    async setProperty(assetInfo: IAssetInfo, path: string, value: any): Promise<boolean> {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        if (!meta || !meta.userData) {
            return false;
        }
        
        const userData = meta.userData;
        let handled = false;

        // Support for nested paths (e.g. meshOptimize.enable)
        if (path.includes('.')) {
            const parts = path.split('.');
            let current = userData;
            for (let i = 0; i < parts.length - 1; i++) {
                // If the path segment doesn't exist, we might need to create it if it's a known object
                // But for now, assume structure exists or fail
                if (!current[parts[i]]) {
                    // Try to be smart? No, just fail for now.
                    return false;
                }
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

        if (handled) {
            await Editor.Message.request('asset-db', 'save-asset-meta', assetInfo.uuid, JSON.stringify(meta));
            return true;
        }
        return false;
    }

    async getProperties(assetInfo: IAssetInfo): Promise<{ [key: string]: IPropertyValueType }> {
        const assetMeta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
        
        if (!assetMeta) {
            throw new Error(`Asset meta not found for ${assetInfo.uuid}`);
        }

        const userData = assetMeta.userData;
        if (!userData) {
            throw new Error(`UserData not found for asset ${assetInfo.uuid}`);
        }

        const properties = this.parseUserData(userData);
        console.log('ModelBaseImporter properties:', properties);
        this.addSpecificUserData(userData, properties);
        console.log('ModelBaseImporter properties after specific:', properties);
        return properties;
    }

    protected abstract addSpecificUserData(userData: any, container: { [key: string]: IProperty }): void;

    protected parseUserData(userData: any): { [key: string]: IProperty } {
        const propertyContainer: { [key: string]: IProperty } = {};

        // Common Normals/Tangents settings
        const normalOptions = [
            { name: 'Optional', value: 0 },
            { name: 'Exclude', value: 1 },
            { name: 'Require', value: 2 },
            { name: 'Recalculate', value: 3 }
        ];

        propertyContainer.normals = {
            value: userData.normals,
            userData: { enumName: 'cc.ModelDataIncludeMode' },
            type: 'Enum',
            enumList: normalOptions
        };
        propertyContainer.tangents = {
            value: userData.tangents,
            userData: { enumName: 'cc.ModelDataIncludeMode' },
            type: 'Enum',
            enumList: normalOptions
        };
        propertyContainer.morphNormals = {
            value: userData.morphNormals,
            userData: { enumName: 'cc.ModelDataIncludeMode' },
            type: 'Enum',
            enumList: normalOptions,
            tooltip: 'Required if you need to use normal map on morph targets'
        };

        // Booleans
        propertyContainer.skipValidation = { value: !!userData.skipValidation, type: 'Boolean', displayName: 'Skip Validation' };
        propertyContainer.disableMeshSplit = { value: !!userData.disableMeshSplit, type: 'Boolean', displayName: 'Disable Mesh Split' };
        propertyContainer.allowMeshDataAccess = { value: !!userData.allowMeshDataAccess, type: 'Boolean', displayName: 'Allow Data Access' };
        propertyContainer.addVertexColor = { value: !!userData.addVertexColor, type: 'Boolean', displayName: 'Add Vertex Color' };
        propertyContainer.promoteSingleRootNode = { value: !!userData.promoteSingleRootNode, type: 'Boolean', displayName: 'Promote Single Root Node' };

        // Optimization Sections as Objects
        propertyContainer.meshOptimize = this.createMeshOptimizeObject(userData.meshOptimize);
        propertyContainer.meshSimplify = this.createMeshSimplifyObject(userData.meshSimplify);
        propertyContainer.meshCluster = this.createMeshClusterObject(userData.meshCluster);
        propertyContainer.meshCompress = this.createMeshCompressObject(userData.meshCompress);
        propertyContainer.lods = this.createLODsObject(userData.lods);

        return propertyContainer;
    }

    private createMeshOptimizeObject(data: any): IProperty {
        const props: { [key: string]: IProperty } = {};
        if (!data) {
            data = {
                enable: false,
                vertexCache: false,
                vertexFetch: false,
                overdraw: false
            };
        }
        
        props.enable = { value: !!data.enable, type: 'Boolean', tooltip: 'It is recommended to enable these options for models with high vertex count.'};
        props.vertexCache = { value: !!data.vertexCache, type: 'Boolean' };
        props.vertexFetch = { value: !!data.vertexFetch, type: 'Boolean'};
        props.overdraw = { value: !!data.overdraw, type: 'Boolean'};

        return {
            value: props,
            type: 'cc.MeshOptimizeOptions',
            displayName: 'Mesh Optimize'
        };
    }

    private createMeshSimplifyObject(data: any): IProperty {
        const props: { [key: string]: IProperty } = {};
        if (!data) {
            data = {
                enable: false,
                targetRatio: 1,
                autoErrorRate: false,
                errorRate: 1,
                lockBoundary: false
            };
        }
        
        props.enable = { value: !!data.enable, type: 'Boolean' };
        props.targetRatio = { value: data.targetRatio, type: 'Float', min: 0, max: 1, step: 0.01, tooltip: 'The target ratio of the simplified mesh data. It is recommended to set this value to 0.5.' };
        props.autoErrorRate = { value: !!data.autoErrorRate, type: 'Boolean' };
        props.errorRate = { value: data.errorRate, type: 'Float', min: 0, max: 1, step: 0.01, tooltip: 'The max error rate of the simplified mesh data. This value also alters the result size. It is recommended to tune until you get a good result.', visible: !data.autoErrorRate };
        props.lockBoundary = { value: !!data.lockBoundary, type: 'Boolean' };

        return {
            value: props,
            type: 'cc.MeshSimplifyOptions',
            displayName: 'Mesh Simplify'
        };
    }

    private createMeshClusterObject(data: any): IProperty {
        const props: { [key: string]: IProperty } = {};
        if (!data) {
            data = {
                enable: false,
                generateBounding: false
            };
        }
        
        props.enable = { value: !!data.enable, type: 'Boolean' };
        props.generateBounding = { value: !!data.generateBounding, type: 'Boolean', tooltip: 'Whether to generate bounding sphere and normal cone for the clustered mesh data.' };

        return {
            value: props,
            type: 'cc.MeshClusterOptions',
            displayName: 'Mesh Cluster'
        };
    }

    private createMeshCompressObject(data: any): IProperty {
        const props: { [key: string]: IProperty } = {};
        if (!data) {
            data = {
                enable: false,
                encode: false,
                compress: false,
                quantize: false
            };
        }
        
        props.enable = { value: !!data.enable, type: 'Boolean' };
        props.encode = { value: !!data.encode, type: 'Boolean' };
        props.compress = { value: !!data.compress, type: 'Boolean' };
        props.quantize = { value: !!data.quantize, type: 'Boolean' };

        return {
            value: props,
            type: 'cc.MeshCompressOptions',
            displayName: 'Mesh Compress'
        };
    }

    private createLODsObject(data: any): IProperty {
        const props: { [key: string]: IProperty } = {};
        if (!data) {
            data = {
                enable: false,
                options: []
            };
        }
        
        props.enable = { value: !!data.enable, type: 'Boolean', displayName: 'Enable' };
        
        if (data.options && Array.isArray(data.options)) {
            data.options.forEach((opt: any, index: number) => {
                const lodProps: { [key: string]: IProperty } = {};
                lodProps.screenRatio = { value: opt.screenRatio, type: 'Number', displayName: 'Screen Ratio' };
                lodProps.faceCount = { value: opt.faceCount, type: 'Number', displayName: 'Face Count', readonly: true };
                
                props[`lod${index}`] = {
                    value: lodProps,
                    type: 'cc.LodOptions',
                };
            });
        }

        return {
            value: props,
            type: 'cc.LodGroups',
            displayName: 'LODs'
        };
    }
}
