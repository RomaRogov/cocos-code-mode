import packageJSON from '../../../package.json';
import { utcpTool } from '../decorators';
import { ISceneTreeItem, SceneTreeItemSchema, Base64ImageSchema, IBase64Image, InstanceReferenceSchema, IInstanceReference } from '../schemas';

export class SceneTools {

    @utcpTool(
        'nodeGetTree',
        'Get the hierarchy tree of specific node or scene root if no reference is provided. Children have recursive structure.',
        {
            type: 'object',
            properties: {
                reference: InstanceReferenceSchema
            }
        },
        SceneTreeItemSchema, "GET",  ['scene', 'graph', 'node', 'hierarchy', 'tree']
    )
    async nodeGetTree(args: { reference?: IInstanceReference }): Promise<ISceneTreeItem> {
        let treeBase;
        if (args.reference) {
             treeBase = await Editor.Message.request('scene', 'query-node-tree', args.reference.id);
        } else {
             // Default queries the whole scene
             treeBase = await Editor.Message.request('scene', 'query-node-tree');
        }
        
        if (!treeBase) {
            throw new Error(`Node tree not found for ${args.reference?.id || 'entire scene'}`);
        }

        const formatNode = (node: any): ISceneTreeItem => {

           const comps = node.components ? node.components.map((c: any) => ({
               reference: { id: c.value, type: c.type }
           })) : [];

           let children: ISceneTreeItem[] = [];
            children = node.children ? node.children.map(formatNode).filter((c: any) => c !== null) : [];

           return {
                reference: { id: node.uuid, type: 'cc.Node' },
                name: node.name,
                active: node.active,
                components: comps,
                children: children
           };
        };
        
        const result: ISceneTreeItem = formatNode(treeBase);
        result.path = (treeBase as any).path || undefined;
        return result;
    }

    @utcpTool(
        'nodeGetAtPath',
        'Get nodes at specific path in the scene hierarchy. Usually returns one node, but can return multiple nodes with the same name.',
        {
            type: 'object',
            properties: {
                hierarchyPath: { type: 'string', description: 'Path to the node in the scene hierarchy"' },
            },
            required: ['hierarchyPath']
        }, { type: 'object', properties: { references: { type: 'array', items: InstanceReferenceSchema } } }, "GET",  ['scene', 'node', 'get', 'path', 'find', 'look', 'instance', 'hierarchy']
    )
    async nodeGetAtPath(args: { hierarchyPath: string }): Promise<{ references: IInstanceReference[] }> {
        const nodeTree = await Editor.Message.request('scene', 'query-node-tree');
        if (!nodeTree) {
            throw new Error(`Scene is empty or could not retrieve scene tree.`);
        }

        const sceneRootName = (nodeTree.name as unknown as string);
        if (args.hierarchyPath.startsWith('/')) {
            args.hierarchyPath = args.hierarchyPath.slice(1);
        }
        if (args.hierarchyPath.startsWith(`${sceneRootName}`)) {
            args.hierarchyPath = args.hierarchyPath.slice(sceneRootName.length);
        }
        if (args.hierarchyPath === '') {
            return { references: [{ id: (nodeTree.uuid as unknown as string) }] };
        }

        const pathParts = args.hierarchyPath.split('/').filter(p => p.length > 0);
        let currentNodes = [nodeTree];
        for (const part of pathParts) {
            const nextNodes: any[] = [];
            for (const node of currentNodes) {
                const matchingChildren = (node.children || []).filter((child: any) => child.name === part);
                nextNodes.push(...matchingChildren);
            }
            currentNodes = nextNodes;
            if (currentNodes.length === 0) {
                break;
            }
        }

        return { references: currentNodes.map((node: any) => ({ id: node.uuid, type: 'cc.Node' })) };
    }

    @utcpTool(
        'nodeCreatePrimitive',
        'Create a new node with predefined primitive geometry MeshRenderer. If no parent is specified, root node is used. Returns reference to the new node.',
         {  type: 'object',
            properties: {
                name: { type: 'string' },
                primitiveType: { type: 'string', enum: [
                    'Capsule', 'Cone', 'Cube', 'Cylinder', 'Plane', 'Quad', 'Sphere', 'Torus',
                ] },
                parentReference: InstanceReferenceSchema
            },
            required: ['name', 'primitiveType']
         }, 
         { type: 'object', properties: { reference: InstanceReferenceSchema }, required: ['reference'] }, "POST",  ['scene', 'node', 'create', 'add']
    )
    async sceneCreatePrimitiveNode(args: { name: string, primitiveType: string, parentReference?: IInstanceReference }): Promise<{ reference: IInstanceReference }> {
        const primitiveMap: Record<string, string> = {
            'Capsule': "db://internal/default_prefab/3d/Capsule.prefab",
            'Cone': "db://internal/default_prefab/3d/Cone.prefab",
            'Cube': "db://internal/default_prefab/3d/Cube.prefab",
            'Cylinder': "db://internal/default_prefab/3d/Cylinder.prefab",
            'Plane': "db://internal/default_prefab/3d/Plane.prefab",
            'Quad': "db://internal/default_prefab/3d/Quad.prefab",
            'Sphere': "db://internal/default_prefab/3d/Sphere.prefab",
            'Torus': "db://internal/default_prefab/3d/Torus.prefab",
        };

        if (!primitiveMap[args.primitiveType]) {
            throw new Error(`Unsupported primitive type: ${args.primitiveType}`);
        }

        const prefabUrl = primitiveMap[args.primitiveType];
        const assetUuid = await Editor.Message.request('asset-db', 'query-uuid', prefabUrl);
        if (!assetUuid) {
            throw new Error(`Failed to find asset for primitive type ${args.primitiveType} at ${prefabUrl}`);
        }
        return await this.sceneCreateNode({
            name: args.name,
            parentReference: args.parentReference,
            assetReference: { id: assetUuid, type: 'cc.Prefab' },
            unwrapPrefab: true
        });
    }

    @utcpTool(
        'nodeCreate',
        'Create a new node in the scene. If no parent is specified, root node is used. Returns reference to the new node.',
        {
            type: 'object',
            properties: {
                name: { type: 'string' },
                parentReference: InstanceReferenceSchema,
                assetReference: InstanceReferenceSchema,
                unwrapPrefab: { type: 'boolean', default: false }
            },
            required: ['name']
        },
        { type: 'object', properties: { reference: InstanceReferenceSchema }, required: ['reference'] }, "POST",  ['scene', 'node', 'create', 'add']
    )
    async sceneCreateNode(args: { name: string, parentReference?: IInstanceReference, assetReference?: IInstanceReference, unwrapPrefab?: boolean }): Promise<{ reference: IInstanceReference }> {
        const options: any = {
            name: args.name
        };
        if (args.parentReference) {
            options.parent = args.parentReference.id;
        } else {
            // Force root if no parent provided
            options.parent = (await Editor.Message.request('scene', 'query-node-tree')).uuid;
        }

        let assetUuid: string | null = null;

        // 1. Determine Asset UUID
        if ((args.assetReference && 'id' in args.assetReference)) {
            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', args.assetReference.id);
            if (!assetInfo) {
                throw new Error(`Asset reference not found: ${args.assetReference.id}`);
            }

            let prefabFound = assetInfo.type === 'cc.Prefab';
            // If not a prefab, check if it has a prefab sub-asset (like in case of FBX)
            if (!prefabFound) {
                for (let subAsset of Object.values(assetInfo.subAssets)) {
                    if (subAsset.type === 'cc.Prefab') {
                        assetUuid = subAsset.uuid;
                        prefabFound = true;
                        break;
                    }
                }
            } else {
                assetUuid = assetInfo.uuid;
            }

            if (!prefabFound) {
                throw new Error(`Provided asset reference ${args.assetReference.id} is not a prefab and does not contain a prefab sub-asset.`);
            } else {
                if (!args.unwrapPrefab) {
                    options.unlinkPrefab = false;
                    options.type = 'cc.Prefab';
                }
            }
        }

        if (assetUuid) {
            options.assetUuid = assetUuid;
        }

        // 2. Create Node
        const result = await Editor.Message.request('scene', 'create-node', options);
        const newNodeUuid = Array.isArray(result) ? result[0] : result;

        if (!newNodeUuid) {
            throw new Error(`Failed to create node ${args.name}${args.assetReference ? ` from asset ${args.assetReference.id}` : ''}.`);
        }

        await Editor.Message.request('scene', 'snapshot');

        return { reference: { id: newNodeUuid, type: 'cc.Node' } };
    }

    @utcpTool(
        'nodeOperate',
        'Perform operation on referenced node, including prefab operations.',
        {
            type: 'object',
            properties: {
                operation: { type: 'string', enum: ['move', 'copy', 'delete', 'create_prefab', 'revert_prefab', 'apply_prefab', 'unwrap_prefab', 'unwrap_prefab_completely', 'open_prefab'] },
                reference: InstanceReferenceSchema,
                newParentReference: InstanceReferenceSchema,
                newPrefabPath: { type: 'string', description: 'For create_prefab: target db:// path', nullable: true },
                siblingIndex: { type: 'integer', description: 'For move/copy: target index in parent children array', nullable: true }
            },
            required: ['operation', 'reference']
        },
        { type: 'object', 
            properties: {
                success: { type: 'boolean' },
                createdPrefabAssetReference: InstanceReferenceSchema,
                updatedNodeReference: InstanceReferenceSchema,
                copiedNodeReference: InstanceReferenceSchema
            }
        }, "POST",  ['scene', 'node', 'remove', 'move', 'copy', 'delete', 'prefab', 'apply', 'revert', 'unwrap', 'create']
    )
    async nodeOperate(args: { operation: string, reference: IInstanceReference, newParentReference?: IInstanceReference, newPrefabPath?: string, siblingIndex?: number }): 
        Promise<{ success?: boolean, createdPrefabAssetReference?: IInstanceReference, updatedNodeReference?: IInstanceReference, copiedNodeReference?: IInstanceReference }> {
        if (await Editor.Message.request('scene', 'query-node', args.reference.id) === null) {
            throw new Error(`Target node ${args.reference.id} not found`);
        }

        switch (args.operation) {
            case 'move':
                if (!args.newParentReference) {
                    throw new Error("newParentReference required for move");
                }

                await Editor.Message.request('scene', 'set-parent', {
                    parent: args.newParentReference.id,
                    uuids: args.reference.id,
                    keepWorldTransform: true
                });

                if (args.siblingIndex !== undefined) {
                    await this.setSiblingIndex(args.reference.id, args.siblingIndex);
                }

                await Editor.Message.request('scene', 'snapshot');
                
                return { success: true };

            case 'copy':
                 const duplicateResult = await Editor.Message.request('scene', 'duplicate-node', [args.reference.id]);
                 if (!duplicateResult || duplicateResult.length === 0) {
                    throw new Error(`Node ${args.reference.id} duplication failed`);
                 }
                 
                 const newNodes = duplicateResult as string[];
                 const newNodeId = newNodes[0]; 
                 
                 if (args.newParentReference) {
                     await Editor.Message.request('scene', 'set-parent', {
                        parent: args.newParentReference.id,
                        uuids: newNodes,
                        keepWorldTransform: true
                     });
                 }

                 if (args.siblingIndex !== undefined) {
                     await this.setSiblingIndex(newNodeId, args.siblingIndex);
                 }

                 await Editor.Message.request('scene', 'snapshot');
                 
                 return { success: true, copiedNodeReference: { id: newNodeId, type: 'cc.Node' } };

            case 'delete':
                await Editor.Message.request('scene', 'remove-node', {
                    uuid: args.reference.id
                });

                const nodeCheck = await Editor.Message.request('scene', 'query-node', args.reference.id);
                if (nodeCheck !== null && nodeCheck !== undefined) {
                    throw new Error(`Node ${args.reference.id} still exists after removal`);
                }

                await Editor.Message.request('scene', 'snapshot');

                return { success: true };

            case 'create_prefab':
                if (!args.newPrefabPath) {
                    throw new Error("newPrefabPath required for create_prefab");
                }
                const parentInfo = await this.getParentAndSiblingIndex(args.reference.id);

                const createdPrefabUuid = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: packageJSON.name,
                    method: 'createPrefabFromNode',
                    args: [args.reference.id, args.newPrefabPath]
                });
                
                if (!createdPrefabUuid) {
                    throw new Error("Failed to create prefab asset.");
                }
                const updatedNodeId = await this.getUpdatedUuid(parentInfo.parentUuid, parentInfo.siblingIndex);

                await Editor.Message.request('scene', 'snapshot');

                return { success: true, createdPrefabAssetReference: { id: createdPrefabUuid, type: 'cc.Prefab' }, updatedNodeReference: { id: updatedNodeId, type: 'cc.Node' } };
                 
            case 'revert_prefab':
                const revertSuccess = await Editor.Message.request('scene', 'restore-prefab', { uuid: args.reference.id });

                await Editor.Message.request('scene', 'snapshot');

                return { success: revertSuccess };

            case 'apply_prefab':
                const applyError = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: packageJSON.name,
                    method: 'applyPrefabByNode',
                    args: [args.reference.id]
                });

                if (applyError != null) {
                    throw new Error(`Failed to apply prefab: ${applyError}`);
                }

                await Editor.Message.request('scene', 'snapshot');

                return { success: true };

            case 'unwrap_prefab':
                const unwrapError = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: packageJSON.name,
                    method: 'unlinkPrefabByNode',
                    args: [args.reference.id, false]
                });
                
                if (unwrapError != null) {
                    throw new Error(`Failed to unwrap prefab: ${unwrapError}`);
                }

                await Editor.Message.request('scene', 'snapshot');

                return { success: true };

            case 'unwrap_prefab_completely':
                const unwrapAllError = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: packageJSON.name,
                    method: 'unlinkPrefabByNode',
                    args: [args.reference.id, true]
                });
                
                if (unwrapAllError != null) {
                    throw new Error(`Failed to unwrap prefab completely: ${unwrapAllError}`);
                }

                await Editor.Message.request('scene', 'snapshot');

                return { success: true };

            case 'open_prefab':
                const nodeForPrefab: any = await Editor.Message.request('scene', 'query-node', args.reference.id);
                if (!nodeForPrefab) {
                    throw new Error(`Node ${args.reference.id} not found`);
                }
                 
                const pInfo = nodeForPrefab.__prefab__ || nodeForPrefab._prefab || (nodeForPrefab.value && (nodeForPrefab.value.__prefab__ || nodeForPrefab.value._prefab));
                const pValue = pInfo?.value || pInfo;
                const targetUuid = pValue?.assetUuid || pValue?.uuid;

                if (!targetUuid) {
                    throw new Error(`Node ${args.reference.id} is not linked to a prefab`);
                }

                try { 
                    await Editor.Message.request('asset-db', 'open-asset', targetUuid);
                } catch (error: any) {
                    throw new Error(`Failed to open prefab asset ${targetUuid}. Reason: ${error?.message || error}`);
                }

                return { success: true };

            default:
                throw new Error(`Unknown scene node operation: ${args.operation}`);
        }
    }

    // Helpers

    private async getParent(nodeUuid: string): Promise<string> {
        const node = await Editor.Message.request('scene', 'query-node', nodeUuid);
        if (node?.parent?.value?.uuid) return node.parent.value.uuid;
        if (node?.parent?.uuid) return node.parent.uuid;
        return await Editor.Message.request('scene', 'query-uuid');
    }

    // Helper to set sibling index
    private async setSiblingIndex(uuid: string, index: number) {
        // Get parent first
        const parentUuid = await this.getParent(uuid);
        if (!parentUuid) {
            throw new Error(`Node ${uuid} has no parent`);
        }

        // Get children of parent
        const parentNode = await Editor.Message.request('scene', 'query-node', parentUuid);
        const childrenArray = parentNode.children;
        if (!childrenArray || !Array.isArray(childrenArray)) {
            throw new Error(`Parent node ${parentUuid} has no children`);
        }

        const currentIndex = childrenArray.findIndex((child: any) => child.value.uuid === uuid);
        if (currentIndex === -1) {
            throw new Error(`Node ${uuid} not found in parent children`);
        }

        if (currentIndex === index) return true;

        // Calculate offset
        // We need to move the element at currentIndex to targetIndex.
        // The API move-array-element works with offset from current position.
        
        // Ensure index is within bounds [0, length-1]
        const targetIndex = Math.max(0, Math.min(index, childrenArray.length - 1));
        const offset = targetIndex - currentIndex;
        
        if (offset === 0) return true;

        return await Editor.Message.request('scene', 'move-array-element', {
            uuid: parentUuid,
            path: 'children',
            target: currentIndex,
            offset: offset,
        });
    }

    private async getParentAndSiblingIndex(uuid: string): Promise<{ parentUuid: string, siblingIndex: number }> {
        const parentUuid = await this.getParent(uuid);
        if (!parentUuid) {
            throw new Error(`Node ${uuid} has no parent`);
        }

        const parentNode = await Editor.Message.request('scene', 'query-node', parentUuid);
        const childrenArray = parentNode.children;
        if (!childrenArray || !Array.isArray(childrenArray)) {
            throw new Error(`Parent node ${parentUuid} has no children`);
        }
        const index = childrenArray.findIndex((child: any) => child.value.uuid === uuid);
        if (index === -1) {
            throw new Error(`Node ${uuid} not found in parent children`);
        }
        return { parentUuid, siblingIndex: index };
    }
    
    private async getUpdatedUuid(parentUuid: string, siblingIndex: number): Promise<string> {
        const parentNodeInfo = await Editor.Message.request('scene', 'query-node', parentUuid);
        if (!parentNodeInfo || !parentNodeInfo.children || !Array.isArray(parentNodeInfo.children) || !parentNodeInfo.children[siblingIndex]) {
            throw new Error(`Failed to retrieve updated node info after prefab creation.`);
        }
        return parentNodeInfo.children[siblingIndex].value.uuid;
    }
}