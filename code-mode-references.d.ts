// Instance reference should newer be kept in memory
type InstanceReference = { id: string; type: string };
interface IAssetTree {
    filesystemPath?: string;
    reference: InstanceReference;
    name: string;
    children: IAssetTree[];
}
interface IHierarchyTree {
    path?: string;
    reference: InstanceReference;
    name: string;
    active: boolean;
    components: InstanceReference[];
    children: IHierarchyTree[];
}

interface IExposedAttributes { type?: string, visible?: boolean, multiline?: boolean, min?: number, max?: number }
// Decorator for properties
declare function property(options: IExposedAttributes): any

// Cocos types
type Vec2 = Vector2;
type Vec3 = Vector3;
type Vec4 = Vector4;
type Quat = Quaternion;
type Mat3 = {
    m00: number; m01: number; m02: number;
    m03: number; m04: number; m05: number;
    m06: number; m07: number; m08: number;
}
type Mat4 = {
    m00: number; m01: number; m02: number; m03: number;
    m04: number; m05: number; m06: number; m07: number;
    m08: number; m09: number; m10: number; m11: number;
    tm12: number; m13: number; m14: number; m15: number;
}
type Color = { r: number; g: number; b: number; a: number; }
type Rect = { x: number; y: number; width: number; height: number; }
type Size = { width: number, height: number };
// The single difference between Unity and Cocos gradient is color represented as flat 3 numbers array (r, g, b)
type Gradient = { colorKeys: Array<{ color: Array<number>, time: number }>, alphaKeys: Array<{ alpha: number, time: number }>, mode: number }

/**
 * Cocos Editor Tools
 */
declare namespace CocosEditor {
    /** Generates TypeScript definition for specific settings. */
    function inspectorGetSettingsDefinition(args: {
        settingsType: "CommonTypes" | "CurrentSceneGlobals" | "ProjectSettings"
    }): { definition: string };

    /** Generates TypeScript definition based on properties of instance. */
    function inspectorGetInstanceDefinition(args: { reference: InstanceReference }): { definition: string };

    /** Gets plain object of properties for the specific settings. */
    function inspectorGetSettingsProperties(args: {
        settingsType: "CurrentSceneGlobals" | "ProjectSettings"
    }): { dump: any };

    /** Gets plain object of properties for any instance. */
    function inspectorGetInstanceProperties(args: { reference: InstanceReference }): { dump: any };

    /** Sets a property on the specific settings. */
    function inspectorSetSettingsProperties(args: {
        settingsType: "CurrentSceneGlobals" | "ProjectSettings",
        propertyPaths: string[],
        values: any[]
    }): { success: boolean, error?: string };

    /** Sets a property on instance of Node, Component or Asset. */
    function inspectorSetInstanceProperties(args: {
        reference: InstanceReference,
        propertyPaths: string[],
        values: any[]
    }): { success: boolean, error?: string };

    /** Get the asset and subAsset hierarchy tree. */
    function assetGetTree(args: {
        reference?: InstanceReference,
        assetPath?: string
    }): IAssetTree;

    /** Get asset reference by given local path and name. */
    function assetGetAtPath(args: { assetPath: string }): { reference: InstanceReference };

    /** Create empty asset or folder of given type. */
    function assetCreate(args: {
        assetPath: string,
        preset: "folder" | "material" | "effect" | "scene" | "prefab" | "typescript" | "animation-clip" | "render-texture" | "physics-material" | "animation-graph" | "animation-graph-variant" | "animation-mask" | "auto-atlas" | "effect-header" | "label-atlas" | "terrain",
        options?: { overwrite?: boolean, rename?: boolean }
    }): { reference: InstanceReference };

    /** Import an external file as an asset into the project. */
    function assetImport(args: {
        sourceFilesystemPath: string,
        targetAssetPath: string,
        imageType?: "raw" | "texture" | "normal-map" | "sprite-frame" | "texture-cube",
        options?: { overwrite?: boolean, rename?: boolean }
    }): { reference: InstanceReference };

    /** Perform operations on assets (move, copy, delete, open). */
    function assetOperate(args: {
        operation: "move" | "copy" | "delete" | "open" | "refresh" | "reimport",
        reference: InstanceReference,
        targetAssetPath?: string,
        options?: { overwrite?: boolean, rename?: boolean }
    }): { reference: InstanceReference };

    /** Returns preview image of the asset. */
    function assetGetPreview(args: {
        reference: InstanceReference,
        imageSize?: number,
        jpegQuality?: number,
        transparentColor?: Color
    }): { type: string, data: string, mimeType: string };

    /** Get list of globally available component types. */
    function nodeGetAvailableComponentTypes(args: {
        includeInternal: boolean,
        filter?: string
    }): { componentTypes: string[] };

    /** Get components of specific type on a node. */
    function nodeComponentsGet(args: {
        reference: InstanceReference,
        componentType?: string
    }): { references: InstanceReference[] };

    /** Remove referenced component from node it is attached to. */
    function nodeComponentRemove(args: { reference: InstanceReference }): { success: boolean, error?: string };

    /** Add a component to a referenced node. */
    function nodeComponentAdd(args: {
        reference: InstanceReference,
        componentType: string
    }): { reference: InstanceReference };

    /** Get the hierarchy tree of specific node or scene root. */
    function nodeGetTree(args: { reference?: InstanceReference }): IHierarchyTree;

    /** Get nodes at specific path in the scene hierarchy. */
    function nodeGetAtPath(args: { hierarchyPath: string }): { references?: InstanceReference[] };

    /** Create a new node with predefined primitive geometry. */
    function nodeCreatePrimitive(args: {
        name?: string,
        primitiveType?: "Capsule" | "Cone" | "Cube" | "Cylinder" | "Plane" | "Quad" | "Sphere" | "Torus",
        parentReference?: InstanceReference
    }): { reference: InstanceReference };

    /** Create a new node in the scene. */
    function nodeCreate(args: {
        name: string,
        parentReference?: InstanceReference,
        assetReference?: InstanceReference
    }): { reference: InstanceReference };

    /** Perform operation on referenced node, including prefab operations. */
    function nodeOperate(args: {
        operation: "move" | "copy" | "delete" | "create_prefab" | "revert_prefab" | "apply_prefab" | "unwrap_prefab" | "unwrap_prefab_completely" | "open_prefab",
        reference: InstanceReference,
        newParentReference?: InstanceReference,
        newPrefabPath?: string,
        siblingIndex?: number
    }): {
        success?: boolean,
        createdPrefabAssetReference?: InstanceReference,
        updatedNodeReference?: InstanceReference,
        copiedNodeReference?: InstanceReference
    };

    /** Common editor operations for scene and prefab view. */
    function editorOperate(args: {
        operation: "save_scene_or_prefab" | "close_scene_or_prefab" | "play_preview" | "pause" | "step" | "stop" | "refresh"
    }): { success: boolean, error?: string };

    /** Get last N editor log entries. */
    function editorGetLogs(args: {
        count: number,
        showStack?: boolean,
        order: "newest-to-oldest" | "oldest-to-newest"
    }): { logLines: string[] };

    /** Returns preview image of scene view. */
    function editorGetScenePreview(args: {
        imageSize?: { width?: number, height?: number },
        jpegQuality?: number,
        cameraPosition: Vector3,
        targetPosition: Vector3
    }): { type: string, data: string, mimeType: string };
}