import { ImporterManager } from './importer-manager';
import { MaterialImporter } from './material-importer';
import { TextureImporter } from './texture-importer';
import { ScriptImporter } from './script-importer';
import { PhysicsMaterialImporter } from './physics-material-importer';
import { FbxImporter } from './fbx-importer';
import { GltfImporter } from './gltf-importer';
import { DirectoryImporter } from './directory-importer';
import { AutoAtlasImporter } from './auto-atlas-importer';
import { PrefabImporter } from './prefab-importer';
import { ImageImporter } from './image-importer';
import { SpriteFrameImporter } from './sprite-frame-importer';
import { TextureCubeImporter } from './texture-cube-importer';
import { ErpTextureCubeImporter } from './erp-texture-cube-importer';
import { RenderTextureImporter } from './render-texture-importer';
import { ProjectSettingsImporter } from './project-settings-importer';

export * from './base-importer';
export * from './importer-manager';
export * from './material-importer';
export * from './texture-importer';
export * from './script-importer';
export * from './physics-material-importer';
export * from './fbx-importer';
export * from './gltf-importer';
export * from './directory-importer';
export * from './auto-atlas-importer';
export * from './prefab-importer';
export * from './image-importer';
export * from './sprite-frame-importer';
export * from './texture-cube-importer';
export * from './erp-texture-cube-importer';
export * from './render-texture-importer';
export * from './project-settings-importer';

export function registerAllImporters() {
    const manager = ImporterManager.getInstance();
    
    // Project Settings
    manager.registerImporter(new ProjectSettingsImporter());

    // Material
    manager.registerImporter(new MaterialImporter());
    
    // Scripts
    manager.registerImporter(new ScriptImporter()); // typescript

    // Prefab
    manager.registerImporter(new PrefabImporter());
    
    // Textures & Images
    manager.registerImporter(new ImageImporter());
    manager.registerImporter(new TextureImporter());
    manager.registerImporter(new SpriteFrameImporter());
    manager.registerImporter(new TextureCubeImporter());
    manager.registerImporter(new ErpTextureCubeImporter());
    manager.registerImporter(new RenderTextureImporter());
    
    // Other
    manager.registerImporter(new PhysicsMaterialImporter());
    manager.registerImporter(new FbxImporter());
    manager.registerImporter(new GltfImporter());
    manager.registerImporter(new DirectoryImporter());
    manager.registerImporter(new AutoAtlasImporter());
}
